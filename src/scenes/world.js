// Milestone 7: ?world (&region=&loc=) renders a location ON its terrain -
// the location pixel flattened to average height, city tiles stamped into
// the terrain tilemap, marching-squares transitions elsewhere.
// Milestone 9: ?world is a floating-origin STREAMING world - terrain
// pixels build nearest-first around the camera within TerrainDistance 3,
// locations appear on their pixels, and crossing a pixel boundary
// recenters the world (streamingWorld.js).

import { FlatAnimator, armFlatAnim } from '../render/flatAnimation.js';   // FA1: the flats that move
import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook, makeLookGate, bindCursorToggle } from '../player/pointerLock.js';   // U45: bindCursorToggle is PlayerMouseLook.cursorActive
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel, getPixelFromPixelID, REGION_RACES, LOCATION_TYPES } from '../formats/mapsFile.js';
import { settlementsOf } from '../world/roadsProducer.js';   // ROADS 3 / AUDIT ROADS F2
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { buildTerrainGrid, buildTerrainIndices, isOutdoorWaterTile, TERRAIN_TILE_DIM, TERRAIN_SKIRT_DEPTH } from '../world/terrainSurface.js';
import { placeGrass } from '../render/groundSurfaces.js';   // EE7: the grass placer   // FD1: PlayerTileMapIndex == 0; EV4: the far ring's skirt depth
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1: the lights the PLAYER carries
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { applyClimate, getGroundArchive, getTerrainGroundArchive, getNatureArchive, SEASON, climateSeasonFromMinutes, INTERIOR_SEASON } from '../world/climateSwaps.js';   // A1: the season is the calendar's, and an interior's is Summer whatever the date
import { RMB_SIDE, layoutLocation } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, mirrorProjectionX, trs, identity, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { frustumPlanes, aabbOutside, localAabb, transformedAabb, flatBatchAabb, cullDisabled } from '../render/frustum.js';   // EV3: the frustum
import { withMoonAmbient } from '../render/enhancedSky.js';   // EV5: secunda rides the ambient
import { FarRingRenderer, ringDisabled } from '../render/farRing.js';   // EV8: the province's mountains on the horizon
import { loadPegasHorse, registerHorseSounds, horseGaitClip, horseModelMatrix, HORSE_CLIPS } from '../systems/pegasHorse.js';   // MW-D42: the enhanced ride
import { loadMorrowindArchives } from './dataSource.js';   // MW-D40: the player's own MW data, loose files included
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { isBulletinBoard } from '../world/rmbLayout.js';   // RMBLayout.cs:1013-1017 - the one model id a town sign wears
import { collectExteriorNpcs, exteriorNpcRecord } from '../characters/exteriorNpcs.js';   // C2 / AUDIT 26: RMBLayout's street StaticNPCs
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4
import { CityNavigation } from '../world/cityNavigation.js';   // T2 towns
import { TownPopulation } from '../systems/townPopulation.js';
import { GUARD_TEXTURE, MobilePerson, PERSON_TEXTURES, personWantsToStop } from '../characters/mobilePerson.js';
import { createTownTalk } from './townTalk.js';
import { createPlayerMagic } from './hostMagic.js';   // M2: spellcasting above ground
import { setDefaultEnchantCtx } from '../systems/enchantments.js';   // E2: the host's enchantCtx mount
import { applySpell } from '../systems/effects.js';   // E2: CastWhenStrikes' target arm
import { ChoiceWindow } from '../ui/talkWindow.js';   // TP-slice: the anchor/teleport prompt
import { preloadSpellbookArt, spellbookArtLoaded } from '../ui/spellbookWindow.js';   // U42: the classic art window (retires M2's keyed stand-in)
import { createSpellbookWindow } from '../ui/spellbookDoor.js';   // PX23: the book's one door
import { calculateCastCost } from '../systems/spellcost.js';   // M2   // T3b
import { rangedDamageSpells } from '../systems/spellcast.js';   // U42: the flight probe's picker
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C2): the ONE clock
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS, playerPainVoice, playPlayerVoice, makeEnemiesHostile } from './hostCombat.js';   // ROAD-B: GameManager.MakeEnemiesHostile
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 24 (wave 46): the arrow owes the flash too   // AUDIT 23 (C14)
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { RestWindow } from '../ui/restWindow.js';   // S40: rest above ground
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5)
import { healthStatusRows, statusInfoRows } from '../systems/healthStatus.js';   // BS1/F198: the Status health box
import { maxFatigue } from '../systems/statMods.js';   // AUDIT 23 (C5)
// V5: resting above ground. RestWindow and RestSession have been
// finished since U7; what was missing was a host outside the dungeon
// that opens one, and CanRest's whole town half.
import { restDecision } from '../systems/restSession.js';   // U48: the DISPATCH (DaggerfallUI.cs:651-688) above the rest window
import { isHouseOwned, shipCoords, ownsShip } from '../systems/banking.js';   // H1: the quest residence filter; GetShipCoords for the map-pixel scene clear; OwnsShip for the travel popup
import {
  clearSceneCache,           // P1: SaveLoadManager.ClearSceneCache, at PlayerGPS's map-pixel seam
  createSceneCache, cacheScene, restoreCachedScene, worldSceneName, LOOT_CONTAINER_TYPES,   // A10: the ship arm's Cache/RestoreCachedScene pair (TransportManager.cs:382-398)
} from '../systems/sceneCache.js';
import { WORLD_CONTEXT, makeAnchor, teleportPlan } from '../systems/teleportAnchor.js';   // A10: the Recall anchor's law - shape, IsSameInterior, the cross-context plan
import { isPlayerInTown } from '../systems/nearbyObjects.js';
import { createTravelMapWindow, travelMapDoorReady, preloadTravelMapArt, canFindPlace } from '../ui/travelMapDoor.js';   // W1's classic art window + U61's overworld, one door
import { racialRestBlock, racialFastTravelBlock, cureVampirism } from '../systems/vampirism.js';   // V2b: the vampire's rest and daylight gates; V2d: $CUREVAM's cure arm
import { cureLycanthropy, racialSuppressPopulationSpawns, racialSuppressInventory, racialSuppressTalk, lycanthropeMoveSound } from '../systems/lycanthropy.js';   // V2d: $CUREWER's cure arm; V4: the transformed gates; LM1: the 4-20s move-sound loop
import { setRacialQuestHost } from '../systems/racialQuests.js';   // V2d: the quest-start seam (the machine is this host's)
import { setCrimeGuildQuestHost, setCrimeGuildClock } from '../systems/crimeGuilds.js';   // CG2
import { randomCemeteryLocationIndex } from '../systems/infection.js';   // V2e: GetRandomCemetery's pick half
import { MEMBERSHIP_STATUS } from '../systems/quest/questLists.js';   // V2d: the vampire clan pool asks as a Member
import { playerInSunlight, playerInHolyPlace } from '../systems/passiveSpecials.js';   // V2c: the enchant ctx's two E1 flags
import { buildMapDict } from '../systems/mapDirectory.js';   // W1: ContentReader's map dict
import { ExteriorAutomapWindow } from '../ui/exteriorAutomapWindow.js';   // A2: the town map on M
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { createExteriorFoes } from './exteriorFoes.js';   // X-slice
import { placeFoeFreely } from '../systems/quest/sceneMount.js';   // B1: CreateFoe's raycast ring
import { mintQuestFoeWave, placeFoeEnv, entityOccupancy, questFoeGender } from './questFoeHost.js';   // B1
import { ENEMY_BASICS } from '../characters/enemyBasics.js';   // MERGE: FinalizeFoe's Flying lift reads the behaviour flag
import { intermittentEnemySpawn, MIN_WILDERNESS_SPAWN_DISTANCE, setEnemyAlert, areEnemiesNearby, passiveGuardSpawns } from '../systems/encounters.js';   // X-slice; the rest refusal raises the alert and asks the RESTING variant, the townsfolk idle the STRICT one; the catch-up loop's watch arm
import { snapshotPlayer, restorePlayer, composeSessionState, restoreSessionState } from '../systems/save.js';   // P-slice: the above-ground quicksave; B4: the ONE quest+talk composer
import { saveSlot, loadSlot, quickLoadSlot, mostRecentRestorable, QUICK_SAVE_NAME, requestScreenshot, capturePendingScreenshot } from '../systems/saveSlots.js';   // SAV4: the quicksave is a SLOT named QuickSave (SaveLoadManager.QuickSave/QuickLoad); SS1: the shot arms at save and lands at frame end
import { arrivalClampMinutes, playerTravelPosition } from '../systems/travel.js';   // F-slice; F114: the ship-aware travel origin
import { hasSpecialAbility, SPECIAL_ABILITY } from '../systems/rest.js';   // F-slice: the NoRegen restore gate
import { locationCompassDirection, buildingCompassDirection, findFactionByTypeAndRegion } from '../systems/talk.js';   // wave 26: %di's remote arm + the region-faction search; the LOCAL arm beside it
import { seasonValue, SEASONS, MINUTES_PER_DAY, dateFromClassicMinutes, dateTimeString, midDateTimeString, lunarPhasesFromMinutes, LUNAR_PHASES } from '../systems/gameDate.js';   // AUDIT 23 (wts-1); Q4-v: the notebook's header shapes; V2c: the enchant ctx's moon arms
import { regionPriceAdjustment, TRANSPORT_HORSE, TRANSPORT_SMALL_CART } from '../systems/shopStock.js';   // Q4-v: CreateGold's regional term (the shops' own producer); U41: Items.Contains(Transportation, ...)
import { getNameBankOfRegion } from '../characters/nameHelper.js';   // AUDIT 23 (characters-5)
import { createHitEffects } from './hitEffects.js';   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { createCityGuards } from './cityGuards.js';   // G1
import { createArrestFlow } from './arrestFlow.js';
import { clearCrimeOnLocationExit, addGold, goldAmount, deductGold, totalGoldAmount, deductGoldPieces } from '../systems/court.js';   // AUDIT 17e F6   // G2   // F-slice: travel gold; U41: GetGoldAmount + the pieces half of DeductFastTravelGold
import { makeInView } from '../player/cameraView.js';   // AUDIT 17e F24
import { mwViewFrame, mwViewWheel, mwViewDrawBody } from '../player/mwView.js';   // MW-D25: the Morrowind camera
import { mwCamera, PITCH_LIMIT } from '../player/mwCamera.js';   // MW-D30: persistence + the reference pitch clamp
import { pickActivatable, pickQuestFoe } from '../player/activate.js';   // G3: corpse loot; QG1: the foe-click door
import { spellRecordOfIndex } from '../systems/loot.js';   // QG1: CastSpellDo's classic-record read (the G4 registry)
import { preloadCharSheetArt } from '../ui/charsheet.js';   // U8a. AUDIT 44 (a11): no LevelUpScreen here - a level-up opens the SHEET, and the skin fork behind charSheetDoor decides which face it wears.
import { createCharSheetWindow, charSheetDoorReady } from '../ui/charSheetDoor.js';   // U52: the sheet's ONE seam, and the skin fork in front of it
import { QuestJournalWindow, preloadQuestJournalArt } from '../ui/questJournal.js';   // U43: the LogBook and NoteBook doors
import { createChronicleWindow } from '../ui/chronicleDoor.js';   // PX24d: the chronicle's one door
import { openPixelDial } from '../ui/pixelDial.js';   // PX15: the Tab compass rose
import { makeOpenBookHook, preloadBookArt } from '../ui/bookReader.js';   // B1
import { DeathScreen } from '../ui/deathScreen.js';   // AUDIT 21 hosts F6: dying above ground
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the classic HUD, which this host did not draw
import { initEscortFaces, addEscortFace, dropEscortFace, escortQuestEnded } from '../ui/hudEscortFaces.js';   // FE1: the quest escorts' portrait column
import { largeHudOptions, routeLargeHudClick, hudLargeNextMode, hudLargePrevMode, activeMouseOverLargeHUD, trackLargeHudPointer } from '../ui/hudLarge.js';   // U45: the classic bottom bar and its eleven panels; ROAD-Ar: and the guard that stops them being world clicks too
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { getInteractionMode } from '../player/interactionMode.js';   // U45: the mode panel's cycle reads it
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
import { preloadInventoryArt } from '../ui/nativeInventory.js';   // U8d: the native inventory
import { createInventoryWindow, inventoryDoorReady } from '../ui/inventoryDoor.js';   // U53: the pack's ONE seam, and the skin fork in front of it
import { createUseMagicItemWindow } from '../ui/useMagicItemWindow.js';   // UI1: the U key's window
import { TransportWindow, preloadTransportArt, transportArtLoaded } from '../ui/transportWindow.js';   // TR3: the picker
import { hasHorse, hasCart, TRANSPORT_MODES } from '../systems/transport.js';   // TR3: what the rows offer
import { shipTransition, REPOSITION } from '../systems/ship.js';   // TR4: board and disembark
import { RidingAnimator, loadRidingArt, ridingRect, RIDING_VOLUME_SCALE } from '../systems/riding.js';   // TR2: the sprite and its loop
import { isRiding } from '../systems/transport.js';   // TR2: is there a mount under us
import { useItem } from '../systems/useItem.js';   // UI1: MagicItemPicker_OnItemPicked's two arms
import { isEnchanted } from '../systems/inventory.js';   // UI1: the use path's enchanted test
import { createDroppedLoot } from './droppedLoot.js';   // U8e: the ground piles
import { preloadPaperDollArt } from '../ui/paperDoll.js';   // U8f: the avatar base
import { seedStartingEquipment, EQUIP_SLOTS } from '../systems/equip.js';   // U8h: the worn-weapon binding
import { createChargenFlow, createChargenWindow, finishChargen, loadSpellIndex, applyHeadlessChargen } from '../systems/chargenSession.js';   // S3c/U9
import { testPresetById, applyTestCharacter } from '../systems/testRoom.js';   // TR3: the Test Room's one home
import { preloadChargenArt } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { buildingDataForDoor, locationBuildings } from '../systems/talkTopics.js';   // E2: the shop identity   // H2: every building, with its key
import { hitSoundFor, swingSoundFor } from '../systems/soundClips.js';
import { isInvisible, entityIsParalyzed } from '../systems/effects.js';   // AUDIT 39: the S19 gate is host-agnostic in DFU
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD } from '../systems/soundClips.js';
import { StreamingWorldState, worldCoordToMapPixel, locationWorldRect, isInLocationRect, mapPixelToWorldCoords } from '../world/streamingWorld.js';
import { getBool, getInt, getFloat } from '../systems/settings.js';   // U31: StartCellX/Y + StartInDungeon, the classic start's own three keys   // F-slice: worldCoordToMapPixel for the travel start pixel
import { DEFAULT_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, TERRAIN_SIZE, ghostSampler } from '../world/terrainSampler.js';   // EV4: ghost rows for chunk-edge normals (the restride's own)
import { getLocationTerrainTileOrigin, setLocationTiles } from '../world/terrainTiles.js';
// The court release's RandomStartMarker arm (StreamingWorld's
// PositionPlayerToLocation), the law and its two location-type reads.
import { positionPlayerToLocation, locationStartMarkers, entranceOptionsForLocationType } from '../world/locationEntrance.js';
import { preloadPrisonScreenArt } from '../ui/prisonScreen.js';   // PRIS00I0 - the serving-time screen
import { TerrainGenClient } from '../world/terrainGenClient.js';   // EV7: the pixel kernel, off the main thread (samples/blend/tiles/grid/nature moved whole to terrainGen.js)
import { getPref } from '../systems/uiPrefs.js';
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { dungeonLocationFor } from '../world/smallerDungeons.js';   // AUDIT 28 F-B2: the quest layer sees the sized dungeon
import { audio } from '../systems/audio.js';
import { music } from '../systems/music.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { fetchBytes, loadMagicRegistries, seasonOverride, createSkyController, createPlayerTicker, createRestDeps, plainLines, wireInfectionVideos, createMusicDirector, motorStats, climbingDeps, createDetectFeed, foeNearbyRecord, lootNearbyRecord, nearbyLootRecords, claimFrame, frameAlive, frameHeld, applyFallLanding, ensureAudio, outdoorFogColor, applyMotorEffectFlags, adjustFallStart, offsetArrows, populatesWanderingNpcs, endRunToTitleMenu, exitToTitleMenu, subscribeFoePools, sensesContext, routeMouseDrag , raisePlayerSkills, liveEnchantFoes, liveEnchantFoeSinks } from './shared.js';   // TP1: PlayerEntity.RaiseSkills   // EC1: the live enchant pool + its sinks router
import { getNearbyObjects } from '../systems/nearbyObjects.js';   // X9: the dispel sweep filters the same scan
import { dispelNearby } from '../systems/mysticism.js';   // X9: the destroy law (destroyed, not killed)
import { PlayerMotor, startRestGroundedCheck } from '../player/motor.js';   // StartRestGroundedCheck's ONE home
import { exteriorSurfaces, downProbe, rayDistanceFor, ON_EXTERIOR_WATER } from '../player/exteriorSurface.js';   // ROAD-B (b3): PlayerMotor's three exterior surface methods
import { isOnFoot } from '../systems/transport.js';   // TransportManager.IsOnFoot - the raycast's reach and the mounted footstep gate
import { floorLanding } from '../player/enterExit.js';   // FixStanding for the exterior arrivals (2026-08-27)
import { jumpSpeedMultiplier, tallySkill, SKILLS } from '../systems/skills.js';
import { playerEntity, surfacePlayer, hurtPlayer, setDeathPresenter, setAvoidDeathHook } from '../characters/playerEntity.js';
import { SOUND } from '../systems/soundClips.js';
import { createWeaponRig } from '../combat/weaponRig.js';
import { ArrowFlight, playerArrowHitFoe } from '../combat/arrowFlight.js';   // C13: visible exterior arrows; AUDIT 39 (#64): and the shaft that LANDS
import { addItem, spendArrow, totalWeight } from '../systems/inventory.js';
import { calculateAttackDamage } from '../combat/formulas.js';   // X2-slice: enemy-arrow impacts
import { inflictPoison } from '../systems/poisons.js';   // X2-slice: poisoned enemy arrows
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { getStaticDoors } from '../world/staticDoors.js';
import { Collider } from '../player/collider.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
// Q4-v: THE QUEST BRIDGE - the machine goes live in this host.
import { createQuestBridge, tokensToRows } from './questBridge.js';
import { loadQuestPack } from './questData.js';
import { ensureFactionRep, getReputation, changeReputation } from '../systems/factionRep.js';
import { changeLegalRep, legalRepOf, CRIMES, setCrimeCommitted } from '../systems/court.js';   // PlayerEntity.Update:498-511 reads the region's LegalRep and levies Criminal_Conspiracy
import { isEquipped, unequipSlot } from '../systems/equip.js';
import { ServiceFlowWindow } from '../ui/guildServiceWindows.js';
import { makeItemPermanent } from '../systems/quest/item.js';
import { guildOfFaction, membershipOf, guildFactionIdOfGroup, joinedGuildOfGroup, activeMemberships, guildInitiationQuestEnded } from '../systems/guilds.js';   // V2e: the per-read vampire book pick; F96: the TG/DB initiation listener
import { GUILD_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';   // the membership book's key - the travel popup's free-ship read   // AUDIT 39 (#23): GetRegionFaction's Province filter
import { freeShipTravel, freeTavernRooms, avoidDeath, AVOID_DEATH_TEXT } from '../systems/guildServices.js';   // KnightlyOrder.FreeShipTravel, the second half of hasShip; FreeTavernRooms, the trip cost's inn nights
import { resolveVariantGuild, orderOf, getDivine } from '../systems/guildVariants.js';   // TN1: GetFactionName's HolyOrder arm
// TK-i: THE RUMOR MILL - the quest machine's rumor seams stop being silent.
import { RumorMill, tokensToString } from '../systems/rumorMill.js';
import { isFaction2RelatedToFaction1 } from '../systems/factionRelations.js';   // S44: the member this host used to stub as false
// AUDIT 39 (#109): SetFactionIdsAndRegionID's two setters bracket the
// common-rumor macro pass, as TalkManager.cs:1417-1419 brackets its own.
import { expandQuestMessage, setIdRegion, setIdFactions } from '../systems/quest/questMacros.js';
// TK-ii: THE TOPIC TREE - the quest topic/dialog-link seams land.
import { TopicTree, QUEST_INFO_RESOURCE_TYPE, QUESTION_TYPE } from '../systems/topicTree.js';
import { NPCSession } from '../systems/npcSession.js';
import { getPeopleOfCurrentRegion, getCourtOfCurrentRegion, getReactionToPlayer, lordNameForFaction, findFactions } from '../systems/talk.js';   // TN1: %fl1/%fl2/%ol1's one home; CQ1: the region's court   // AUDIT 39 (#23): GetRegionFaction
import { liveVampirism } from '../systems/racialLive.js';   // AUDIT 39 (#23): the PC's clan, off the curse entry
import { BUILDING_TYPES as TALK_BUILDING_TYPES, generateBuildingName } from '../world/buildingNames.js';   // IH1: %cbd regenerates the current building's name
import { AnswerPipeline, TALK_STRINGS, specialDungeonName } from '../systems/answerPipeline.js';
import { expandRandomTextRecord as expandTalkRecord } from '../systems/talkMacros.js';
import { OATH_RACE_INDEX } from '../systems/talkSession.js';
import { bumpSeed } from '../formats/dfRandom.js';
import { fullName as nameHelperFullName, GENDERS, BANK_TYPES } from '../characters/nameHelper.js';

// NameHelper.BankTypes -> the Races name TalkManagerMCP's Oath reads
const RACE_BY_NAME_BANK = Object.freeze(Object.fromEntries(
  Object.entries(BANK_TYPES).map(([race, bank]) => [bank, race])));
import { startDisease, endDisease, diseaseCount } from '../systems/diseases.js';   // AUDIT 24: the quest bridge's MakePcDiseased / CurePcDisease seams; U41: the popup's diseased warning
import { poisonCount } from '../systems/poisons.js';   // U41: the warning's other half
import { discoverRandomLocation, discoverLocation, undiscoverBuilding, discoverBuilding, discoveredBuildings, hasDiscoveredLocationId } from '../systems/discovery.js';   // G8 + TV: the guild map reveals + the entry writer; TK-ii: the quest-residence undiscover
import {
  WEATHER_TYPES, fogForWeather, scaleFogForDistance, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
import { PrecipitationRenderer } from '../render/precipitation.js';
import { ROTOR_HUB, rotorPhase, advanceRotor, mountRotor, MILL_SOUND, millSoundPosition } from '../world/windmills.js';   // WM2b: the sails; WM4c: the hum
import { BODY } from '../world/windmillMesh.js';   // WM2d: the tower, for the collider
import { remapSubMeshes } from '../world/texRemap.js';   // WM3: the one climate/dungeon remap seam
import { setWeather, currentWeather, tickWeather, weatherRespawn, applyClimateWeather, importClimateWeathers } from '../systems/weatherSim.js';   // W1: the live weather state (the save halves ride save.js); SAV3: the classic import's zone array
import { classicSaveToSnapshot, takePendingClassicSave, peekPendingClassicSave } from '../systems/classicSave.js';   // SAV3: the classic-save import arm
import { readTokens as readRscTokens, RSC } from '../formats/textRsc.js';   // SAV3: the classic rumors' token payloads
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
import { isEnhanced } from '../systems/uiSkin.js';   // WM2d: the mills are an enhanced-only addition

/** Internal_Strings_en 654 / 655, the two guild map-reveal notes
 *  (ThievesGuild.cs:115, DarkBrotherhood.cs:108). %map is the
 *  DiscoverRandomLocation name. */
const REVEAL_NOTE_TEXT = Object.freeze({
  // U44: the map ITEM's own note (DaggerfallInventoryWindow.cs:1834),
  // Internal_Strings.csv :810.
  readMap: 'Discovered the location of %map after studying a map.',
  readMapTG: 'The Thieves Guild have revealed the closely-guarded whereabouts of a treasure trove called %map.',
  readMapDB: 'The Dark Brotherhood revealed the secret of some treasure-laden crypts located somewhere called %map.',
});

/** AUDIT 39: Internal_Strings.csv :221, the line DaggerfallUI.cs:608
 *  puts in a MessageBox when the travel map is asked for with enemies
 *  about. Verbatim - it is the refusal, not a paraphrase of it. */
const CANNOT_TRAVEL_ENEMIES_TEXT = 'You cannot travel with enemies nearby.';

// Milestone 9 scene: floating-origin streaming world. Terrain pixels
// stream in nearest-first around the camera within TERRAIN_DISTANCE,
// locations appear on their pixels, and crossing a pixel boundary
// recenters the world (StreamingWorld + FloatingOrigin semantics in
// streamingWorld.js). Everything is stored pixel-local; per-frame
// placement is pixelTranslation(px, py) under the current compensation.
export async function bootWorld(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';
  // A1: THE TEXTURE SEASON IS THE CALENDAR'S, NOT A URL PARAM.
  // Every production site in the reference reads the world clock -
  // ClimateSwaps.cs:382-386, DaggerfallLocation.ApplyTimeAndSpace
  // (:135-139), StreamingWorld.cs:812 - and answers Winter or Summer
  // off DaggerfallDateTime.SeasonValue. ?season demotes to a debug
  // PIN (the ?cull=off shape) so a shot can still nail winter in
  // Second Seed. `let`, because the season turns under a standing
  // world: tickSeason below is DaggerfallLocation.Update's lastSeason
  // test, and applyWeather/weatherSun read this binding live.
  const seasonPin = seasonOverride(params);
  let season = seasonPin ?? climateSeasonFromMinutes(worldMinutes());

  audio.ensure(fetchBytes);   // AUDIT 18 F6: sound was booted ONLY by buildDungeonContext, so this host was silent until a dungeon was entered
  status('loading data');
  const [palBytes, blocksBytes, archBytes, mapsBytes, climateBytes, politicBytes, woodsBytes] =
    await Promise.all([
      fetchBytes('ART_PAL.COL'),
      fetchBytes('BLOCKS.BSA'),
      fetchBytes('ARCH3D.BSA'),
      fetchBytes('MAPS.BSA'),
      fetchBytes('CLIMATE.PAK'),
      fetchBytes('POLITIC.PAK'),
      fetchBytes('WOODS.WLD'),
    ]);
  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');
  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);
  const woods = new WoodsFile();
  if (!woods.load(woodsBytes)) throw new Error('WOODS.WLD failed to load');
  // EV7: the pixel kernel's off-thread home - a COPY of the WOODS
  // bytes crosses once; this thread's `woods` stays the fallback law.
  const terrainGen = new TerrainGenClient({ woods, woodsBytes });
  // ROADS 3: OUR network, from the player's own map. Built once here,
  // handed to both terrain kernels; a failure draws a world without
  // roads and says so, never no world.
  terrainGen.setRoads(settlementsOf(maps), (st) => {
    console.log(`[roads] ${st.roadNodes} towns, ${st.roadEdges} roads, ${st.trackEdges} tracks, ${st.unrouted} unrouted, ${st.ms}ms`);
    // AUDIT 45 F7: an unrouted pair is a finding, and it is named.
    for (const [a, b] of st.unroutedPairs ?? []) {
      console.warn(`[roads] no route: (${a.x},${a.y}) ${maps.getRegionName(a.region)} -> (${b.x},${b.y}) ${maps.getRegionName(b.region)}`);
    }
  });
  // EV8: the far province ring - enhanced only (the 1:1 lane keeps the
  // fog horizon DFU draws), ?ring=off the escape hatch. Built lazily
  // in the frame loop, where the live player pixel exists.
  const farRing = (isEnhanced() && !ringDisabled()) ? new FarRingRenderer(renderer.gl) : null;
  const _ringOrigin = [0, 0, 0];

  // One location per map pixel game-wide (pinned corpus invariant).
  status('indexing locations');
  const locationIndex = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < region.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !loc.exterior || !loc.exterior.exteriorData) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      locationIndex.set(`${p.x},${p.y}`, loc);
    }
  }

  // U31 / THE CLASSIC START. StartGameBehaviour (:371-401) does not
  // resolve the start by NAME - it reads a map pixel out of settings
  // (StartCellX/StartCellY, 109/158 = Privateer's Hold) and asks the
  // world what location is there. ?classic takes that path so the new
  // game begins where Daggerfall begins; every dev boot keeps the
  // region/loc names it has always used.
  //
  // NEVER TRAPS: a start cell with no location falls back to the named
  // location rather than throwing the player at a black screen.
  let startLoc = null;
  if (params.has('classic')) {
    const cell = `${getInt('Startup', 'StartCellX')},${getInt('Startup', 'StartCellY')}`;
    startLoc = locationIndex.get(cell) ?? null;
    if (!startLoc) console.warn(`[world] start cell ${cell} holds no location; falling back to ${regionName}/${locationName}`);
  }
  if (!startLoc) startLoc = maps.getLocationByName(regionName, locationName);
  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);
  const startPixel = longitudeLatitudeToMapPixel(
    startLoc.mapTableData.longitude, startLoc.mapTableData.latitude);

  const CITY_LIGHT_COLOR_F32 = new Float32Array(CITY_LIGHT_COLOR);
  // World clock (R5) + sky controller: panorama follows the current pixel's
  // climate AND the time of day (async, frame-late at boundaries).
  const sky = createSkyController(renderer.gl, params);
  // Weather (R12 presentation; W1 makes the STATE live). ?weather
  // PINS the sky for shots/probes - the R12 contract - and without it
  // the sim (systems/weatherSim.js: the Chronicles pg. 47 table, the
  // six-zone daily re-roll, the respawn re-roll) drives; applyWeather
  // re-derives every presentation half when the sim's answer changes.
  // A1: the winter term IS the calendar's winter now - one season,
  // read at SetSunlightScale (WeatherManager.cs:316-319) exactly as
  // the climate swaps read it, so the world that looks wintry dims
  // wintry because it IS Evening Star.
  const weatherOverride = WEATHER_TYPES.includes(params.get('weather'))
    ? params.get('weather') : null;
  if (weatherOverride) setWeather(weatherOverride);
  const weatherSeed = weatherRng(Number(params.get('wseed')) || 1);
  let weather = weatherOverride ?? currentWeather();
  // EV4: the distance haze follows the live Land View Distance (the
  // scale is 1 at DFU's default 3, so the classic path is untouched);
  // the exp weather rows pass through scaleFogForDistance unchanged.
  const fogDistance = getInt('Experimental', 'TerrainDistance', 1, 4);
  let weatherFog = scaleFogForDistance(fogForWeather(weather), fogDistance);
  let weatherSkyOffset = skyOffsetForWeather(weather, weatherSeed);
  let weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
  let precipMode = precipitationForWeather(weather);
  let precip = precipMode ? new PrecipitationRenderer(renderer.gl) : null;
  let lightning = weather === 'thunder'
    ? new LightningPlayer(Number(params.get('wseed')) || 1) : null;
  function applyWeather(w) {
    weather = w;
    weatherFog = scaleFogForDistance(fogForWeather(w), fogDistance);   // EV4
    weatherSkyOffset = skyOffsetForWeather(w, weatherSeed);   // SetRainOvercast's 50/50 pick, re-rolled per change
    weatherSun = weatherSunlightScale(w, season === SEASON.Winter);
    precipMode = precipitationForWeather(w);
    if (precipMode && !precip) precip = new PrecipitationRenderer(renderer.gl);
    lightning = w === 'thunder'
      ? (lightning ?? new LightningPlayer(Number(params.get('wseed')) || 1)) : null;
  }
  // AUDIT 23 (C2: hosts-8 = audio-1): ONE clock - see exterior.js's
  // twin note. ?tod SETS the world clock's time-of-day at boot,
  // ?timescale SCALES the world tick (DFU's TimeScale, default 12).
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
  const worldLightAnimator = new CityLightAnimator(4096, CITY_LIGHT_RANGE);

  // --- Shared caches (dataPipeline.js, extracted at P7) -----------------
  const pipeline = createDataPipeline({ renderer, arch, palette });
  // AUDIT 18 HOST GAP: the audio engine's bootstrap lived only in
  // buildDungeonContext, so every sound in this host was a silent
  // no-op until a dungeon was entered (DFU's sound reader is global
  // and the exterior prefab is audible from frame one).
  ensureAudio(fetchBytes);

  const { getTexture, uploadRecord, uploadRecordFrame, getGpuMesh, getWindmillMeshes, getMachineryParts, cpuModels } = pipeline;
  // WM2b/WM2d: the vendored mill's two parts, uploaded on the first mill
  // this session streams in and held for the rest of it. One pair of
  // meshes however many mills - the per-mill state is the angle alone.
  let millParts = null;

  // T2 towns: the person textures (climate People table pends - Breton
  // + guard, the T1 flag), loaded once on the first populated pixel.
  // StreamingWorld.cs:771-781's seven-LocationType PopulationManager
  // gate now lives in shared.js so the ?exterior host cannot miss it.
  // AUDIT 23 (characters-4): the streaming host can enter any climate,
  // so all three population races preload (PopulationManager reads
  // ClimateSettings.People per location).
  const personArchives = [...new Set(Object.values(PERSON_TEXTURES).flatMap((r) => [...r.male, ...r.female]).concat(GUARD_TEXTURE))];
  const personTex = new Map();
  let _personTexLoad = null;
  const ensurePersonTex = () =>
    (_personTexLoad ??= Promise.all(personArchives.map(async (a) => personTex.set(a, await getTexture(a)))));

  // --- Per-pixel build --------------------------------------------------
  const worldHeight = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;
  const tileSide = TERRAIN_SIZE / 128;
  const built = new Map(); // key -> pixel entry
  // EV3: one local AABB per model ARCHETYPE, scanned once ever - the
  // per-placement box is then eight corner transforms at build time.
  const archAabbs = new Map();
  const archAabb = (id, positions) => {
    let b = archAabbs.get(id);
    if (!b) archAabbs.set(id, b = localAabb(positions));
    return b;
  };
  // The sails sweep well past the tower's own box; the pad keeps a
  // mill's rotor from vanishing while its tower still shows.
  const MILL_SAIL_PAD = 30;
  // Player collision (P1): per-pixel triangle buckets in PIXEL-LOCAL
  // space, resolved through the live floating-origin translation; the
  // floor is the terrain heightmap, bilinear over the stored samples.
  const heightCell = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);
  // EV2: the containing pixel is COMPUTABLE - pixelTranslation is an
  // affine map, so its inverse names the one pixel that can hold
  // (x, z) and the 49-entry scan (with a fresh translation array per
  // entry, inside the collider's substeps) collapses to one Map.get.
  // The invariant it leans on - the current pixel's frame sits at the
  // origin under compensation - is the one streaming.test.js:139 fuzz
  // pins over 2000 crossings.
  const _htT = [0, 0, 0];
  const heightAt = (x, z) => {
    const c = state.compensation;
    const px = state.mapOrigin.x + Math.floor((x - c[0]) / TERRAIN_SIZE);
    const py = state.mapOrigin.y - Math.floor((z - c[2]) / TERRAIN_SIZE);
    const p = built.get(`${px},${py}`);
    if (p) {
      const t = state.pixelTranslation(p.px, p.py, _htT);
      const lx = x - t[0];
      const lz = z - t[2];
      if (lx < 0 || lz < 0 || lx >= TERRAIN_SIZE || lz >= TERRAIN_SIZE) return -Infinity;
      const fx = lx / heightCell;
      const fz = lz / heightCell;
      const ix = Math.min(HEIGHTMAP_DIMENSION - 2, Math.floor(fx));
      const iz = Math.min(HEIGHTMAP_DIMENSION - 2, Math.floor(fz));
      const sx = fx - ix;
      const sz = fz - iz;
      const at = (a, b) => p.samples[a * HEIGHTMAP_DIMENSION + b] * worldHeight;
      const h =
        at(ix, iz) * (1 - sx) * (1 - sz) + at(ix + 1, iz) * sx * (1 - sz) +
        at(ix, iz + 1) * (1 - sx) * sz + at(ix + 1, iz + 1) * sx * sz;
      return h + t[1];
    }
    return -Infinity;
  };
  const collider = new Collider(heightAt);
  // Building doors (P3): registered pixel-local at build, activated
  // against the live translation; each carries what the transition
  // needs (its block + building record + sibling exterior doors).
  const buildingDoors = []; // {door, pixelKey, dfBlock, recordIndex, climateBase, season (A1: INTERIOR_SEASON)}
  const TERRAIN_INDICES = buildTerrainIndices();
  // EV4: the far ring's strided twin - 33x33 plus its crack skirt, a
  // 16x triangle cut per pixel. Enhanced only: the 1:1 lane keeps full
  // resolution at every distance, exactly as DFU draws it. The ring
  // test reads the LIVE player pixel, so a pixel's class follows the
  // walk (restrideTerrain below swaps a built pixel's surface).
  const LOD_STRIDE = 4;
  const LOD_NEAR = 3;   // chebyshev distance where the far ring starts
  const lodOn = isEnhanced();
  const TERRAIN_INDICES_LOD = lodOn ? buildTerrainIndices(LOD_STRIDE) : null;   // AUDIT EV: the 1:1 lane never pays for the strided twin
  const strideFor = (px, py) => ((lodOn
    && Math.max(Math.abs(px - state.current.x), Math.abs(py - state.current.y)) >= LOD_NEAR)
    ? LOD_STRIDE : 1);

  // AUDIT EV F-SIM1 (2026-08-31): ONE build per pixel, ever in
  // flight. EV7 stretched a build across a worker round trip, which
  // opened an old microtask-thin window wide: a teleport (or a
  // leave-and-return crossing) re-enqueues a pixel whose build is
  // already flying - state.init marks the whole destination grid
  // loaded at enqueue time, so the in-flight publish survives the
  // audit-24 recheck AND the queue entry builds it again. The second
  // built.set overwrote the first entry: its terrain VAO, tilemap
  // texture and billboard batches leaked on the GPU for the session,
  // the collider bucket and door registry doubled, and a mill's hum
  // could orphan into an unstoppable loop. The cache answers a
  // finished pixel; the in-flight map answers a flying one with the
  // SAME promise, so every caller - pump, boot, teleport - shares one
  // build.
  const inFlight = new Map();
  async function buildPixel(px, py) {
    const key = `${px},${py}`;
    if (built.has(key)) return built.get(key);
    let flying = inFlight.get(key);
    if (flying) return flying;
    flying = buildPixelNow(px, py).finally(() => inFlight.delete(key));
    inFlight.set(key, flying);
    return flying;
  }

  async function buildPixelNow(px, py) {
    const key = `${px},${py}`;
    const dfLocation = locationIndex.get(key) || null;
    // EV7: the LOCATION half stays here - setLocationTiles reads
    // BlocksFile + MapsFile, file objects that do not cross a
    // postMessage boundary - and its tilemap + rect ride into the job
    // as plain data. The ~84k-perlin kernel itself (samples, blend,
    // tiles, grid, nature - terrainGen.js, buildPixel's old prologue
    // verbatim) runs on the terrain worker when one is up and on this
    // thread when one is not; either way the reply is the same shape
    // and everything below it - GL uploads, the location layout, the
    // collider, the single atomic built.set - stays on this thread.
    const seedTilemap = new Uint8Array(128 * 128);
    let locationRect = null;
    if (dfLocation) locationRect = setLocationTiles(dfLocation, maps, blocks, seedTilemap);
    const climate = getWorldClimateSettings(maps.getClimateIndex(px, py));
    const climateBase = climate.climateType;
    // EV4: the far ring builds strided with its skirt; the kernel's
    // ghost rows keep edge normals central differences either way.
    const stride = strideFor(px, py);
    const { samples, tilemap, positions, normals, tilemapBytes, avg, nature } = await terrainGen.generate({
      px, py, stride, tilemap: seedTilemap, locationRect, hasLocation: !!dfLocation, climateType: climateBase,
    });
    // WM3: this pixel's climate law, bound once - the one argument the
    // shared remap seam takes that differs between the climate hosts
    // and the dungeon.
    const climateArchive = (archive, record) => applyClimate(archive, record, climateBase, season);
    const groundArchive = getTerrainGroundArchive(climate, season);   // the TERRAIN member, Desert winter-guarded (TerrainMaterialProvider.cs:126-133)
    const natureArchive = getNatureArchive(climate.natureArchive, season);

    // R9 tilemap pass: shared-index height grid + per-pixel tilemap
    // texture + one cached texture array per ground archive.
    const groundTex = await getTexture(groundArchive);
    // EE3: the ground's half of the Enhanced Environments switch and its
    // URL door, set BEFORE the cache is asked - the guard below must ask
    // about the mode the upload will use, or a flipped switch skips the
    // upload for the new mode and draws the terrain with no texture.
    renderer.enhancedGround = isEnhanced() && getPref('enhancedEnvironments');
    renderer.groundMode = new URLSearchParams(globalThis.location?.search ?? '').get('ground');
    if (!renderer.tileArrayFor(groundArchive)   /* EE3 */) {
      const layers = [];
      for (let r = 0; r < groundTex.recordCount; r++) {
        layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
      }
      renderer.uploadTileArray(groundArchive, layers);
    }
    const terrain = renderer.createTerrainSurface(positions, normals,
      stride === 1 ? TERRAIN_INDICES : TERRAIN_INDICES_LOD);
    // EV3: the pixel's presentation bounds, pixel-local - seeded by the
    // terrain's own vertices, grown by every model and flat batch below.
    // EV4: dropped by the skirt depth so a future restride to the far
    // ring never hangs geometry below the culling box.
    const bounds = localAabb(positions);
    bounds[1] -= TERRAIN_SKIRT_DEPTH;
    const unionBox = (b) => {
      for (let i = 0; i < 3; i++) {
        if (b[i] < bounds[i]) bounds[i] = b[i];
        if (b[3 + i] > bounds[3 + i]) bounds[3 + i] = b[3 + i];
      }
    };
    const tilemapTex = renderer.uploadTilemapTexture(tilemapBytes, TERRAIN_TILE_DIM);
    // EE7: the pixel's grass, placed on its own tilemap and heightmap, on
    // the records the drawn build says are grass. Nothing when the mode
    // places none, or when ?grass=off - the kill switch.
    // Grass rides the NEAR RING only (EV4's stride-1 class): a pixel two
    // rings out draws its blades to a thinning threshold nobody can see
    // past, for a vertex cost that is very much seen. Built here when
    // the pixel is born near, and by restrideTerrain when it comes near
    // later; dropped when it recedes. tilemapBytes and samples stay on
    // the record for that.
    const grass = stride === 1 ? buildGrassFor(px, py, groundArchive, tilemapBytes, samples) : null;

    // Flat groups: pixel-local base positions.
    const groups = new Map();
    const pixelLights = []; // archive-210 lanterns, pixel-local (R3)
    const pixelAnimals = []; // A4: archive-201 town animals, pixel-local {pos, sound}
    const pixelNpcFlats = []; // AUDIT 26 (F019): the flats RMBLayout stands as StaticNPCs, pixel-local
    const pixelBoards = [];   // the block's BULLETIN BOARDS (model 41739), pixel-local boxes
    const light210 = await getTexture(LIGHTS_ARCHIVE);
    const lightSize = (record) =>
      scaledBillboardSize(light210.getSize(record), light210.getScale(record));
    const addFlat = (archive, record, x, y, z) => {
      const k = `${archive}_${record}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push([x, y, z]);
    };

    // Per-pixel climate swap table: pixels from the swapped archive, UVs
    // from the original (the SetDungeonTextures pattern; verbatim
    // MaterialReader.ChangeClimate semantics).
    const texRemap = new Map();
    const models = []; // { gpu, local } - local precomposed pixel-local matrix
    const windmills = []; // WM2b: { local, state } - mills whose rotor turns each frame
    let population = null;   // T2 towns: this pixel's wandering pool
    let locOrigin = null;    // the location origin, pixel-local
    let personBatches = null;
    let locBlocks = null;    // T3d: the layout blocks for the Where-is directory
    if (dfLocation) {
      // AUDIT 39 (#18): the skin reaches the layout, because the mill's
      // subrecord widens the block's building count and must not exist
      // on the classic one.
      const loc = layoutLocation(dfLocation, maps, blocks, { enhanced: isEnhanced() });
      locBlocks = loc.blocks;
      const tilePos = getLocationTerrainTileOrigin(dfLocation);
      const locLocal = [tilePos.x * tileSide, avg * worldHeight + 2.0 * 0.025, tilePos.y * tileSide];
      // T3d: EVERY location pixel keeps its origin (the population
      // gate below no longer owns it) - the Where-is directory
      // resolves doors and the player in the LOCATION frame.
      locOrigin = [locLocal[0], locLocal[1], locLocal[2]];
      for (const b of loc.blocks) {
        const originMatrix = trs(
          locLocal[0] + b.originX, locLocal[1], locLocal[2] + b.originZ, 0, 0, 0);
        // WM2d: THE MILLS THIS BLOCK STANDS. Classic Daggerfall places
        // none, so rmbLayout adds them; the tower joins the static model
        // list and only the SAIL needs a matrix per frame. Enhanced skin
        // only, the same door the enhanced skin owns. The phase is keyed on the
        // MAP PIXEL plus the mill's local position, never its world
        // position - the floating origin shifts the world under the
        // player and a world-keyed phase would re-seed every mill in
        // sight on every shift.
        if (b.layout.windmills.length && isEnhanced()) {
          const parts = await getWindmillMeshes(climateBase, season === SEASON.Winter);
          if (!millParts) {
            millParts = parts;
            console.log(`[windmills] first mill streamed in (${b.blockName})`);
          }
          for (const w of b.layout.windmills) {
            const local = multiply(originMatrix, w.matrix);
            const box = transformedAabb(archAabb('millBody', BODY.positions), local);
            for (let i = 0; i < 3; i++) { box[i] -= MILL_SAIL_PAD; box[3 + i] += MILL_SAIL_PAD; }
            unionBox(box);
            models.push({ gpu: parts.body, local, _box: box, _order: -1 });   // EV6: the mills group together
            collider.addMesh(key, BODY.positions, BODY.indices, local,
              () => state.pixelTranslation(px, py));
            windmills.push({ local, state: { angle: rotorPhase(px + local[12], py + local[14]) } });
          }
        }
        for (const placed of b.layout.models) {
          // WM2f: the mill's companion building is part of an enhanced-skin
          // departure; the 1:1 lane must not see it.
          if (placed.enhancedOnly && !isEnhanced()) continue;
          const gpu = await getGpuMesh(placed.modelIdNum);
          if (!gpu) continue;
          await remapSubMeshes(gpu.subMeshes, texRemap, climateArchive, pipeline);
          const local = multiply(originMatrix, placed.matrix);
          const cpu = cpuModels.get(placed.modelIdNum);
          const box = transformedAabb(archAabb(placed.modelIdNum, cpu.positions), local);
          unionBox(box);
          models.push({ gpu, local, _box: box, _order: placed.modelIdNum });   // EV6: sort key
          collider.addMesh(key, cpu.positions, cpu.indices, local,
            () => state.pixelTranslation(px, py));
          // THE BULLETIN BOARDS. RMBLayout stands model 41739
          // STANDALONE rather than combining it (:857, :935) for the
          // sole purpose of hanging DaggerfallBulletinBoard off it
          // (:966-970), which is the component PlayerActivate's ray
          // looks for (:393-398). This port has no components, so the
          // pixel keeps the boards it stood - pixel-local, like its
          // NPCs and lights - and the activation ray reads that list.
          if (isBulletinBoard(placed.modelIdNum)) pixelBoards.push({ box });
          // Building models expose their static doors for E-transitions.
          if (cpu.doors && cpu.doors.length) {
            // StaticDoor.blockIndex must be TRUTHFUL (RMBLayout.cs:848
            // passes blockData.Index): DaggerfallInterior.IsBadInteriorModel
            // keys the 31000-overlap repair on EntryDoor.blockIndex, and a
            // hardcoded 0 made it unreachable from this host.
            const staticDoors = getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, local);
            for (const door of staticDoors) {
              buildingDoors.push({
                door, pixelKey: key, dfBlock: b.dfBlock,
                // A1: the season a door carries INSIDE is the
                // interior's own constant, never the world's.
                // DaggerfallInterior.cs:51 declares climateSeason =
                // ClimateSeason.Summer and never assigns it, so a
                // reference interior is summer-skinned in the depths
                // of Evening Star; the exterior season stopping at the
                // threshold is the whole of that law.
                recordIndex: placed.recordIndex, climateBase, season: INTERIOR_SEASON,
              });
            }
          }
        }
        // No RMB ground plane on terrain (addGroundPlane = false).
        const blockFlats = collectBlockFlats(b.dfBlock, natureArchive);
        // AUDIT 26 (F019): ...and the same flats' STATIC NPCs
        // (RMBLayout.cs:366-378 / :442-454 - the non-zero FactionID
        // rule), pixel-local like everything else this host builds.
        for (const npc of collectExteriorNpcs(blockFlats)) {
          pixelNpcFlats.push({
            ...npc,
            x: locLocal[0] + b.originX + npc.x,
            y: locLocal[1] + npc.y,
            z: locLocal[2] + b.originZ + npc.z,
          });
        }
        for (const flat of blockFlats) {
          addFlat(flat.archive, flat.record,
            locLocal[0] + b.originX + flat.x, locLocal[1] + flat.y, locLocal[2] + b.originZ + flat.z);
          // A4: every archive-201 town animal is an audio source
          // (AddAnimalAudioSource on RMB flats, verbatim).
          if (flat.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[flat.record] != null) {
            pixelAnimals.push({
              pos: [locLocal[0] + b.originX + flat.x, locLocal[1] + flat.y, locLocal[2] + b.originZ + flat.z],
              sound: ANIMAL_SOUND_BY_RECORD[flat.record],
            });
          }
        }
        for (const light of collectCityLights(b.dfBlock, lightSize)) {
          pixelLights.push([
            locLocal[0] + b.originX + light.x,
            locLocal[1] + light.y,
            locLocal[2] + b.originZ + light.z,
          ]);
        }
      }

      // T2 towns: the streaming host's wandering population (the
      // standing host rule - every scene-side seam ships in every
      // motor host). The navgrid + persons live in the LOCATION frame
      // (horizontal from the location origin, vertical pixel-local);
      // the frame loop converts through the live floating-origin
      // translation. Persons ground on the flattened location terrain
      // (blendLocationTerrain planes the rect to avg - the same base
      // the RMB flats sit on). Location-type gate verbatim.
      if (populatesWanderingNpcs(dfLocation.mapTableData.locationType)) {
        await ensurePersonTex();
        const nav = new CityNavigation(loc.width, loc.height);
        for (const b of loc.blocks) {
          const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
          nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData,
            (tx, ty) => srcTiles[tx][ty].textureRecord);
        }
        personBatches = new Map();   // person -> batch (destroyed with the pixel)
        const personCollider = {
          // location-frame raycast through the live world collider
          raycast: (from, dir, l) => {
            const t = state.pixelTranslation(px, py);
            return collider.raycast(
              [from[0] + locOrigin[0] + t[0], from[1] + t[1], from[2] + locOrigin[2] + t[2]], dir, l);
          },
        };
        population = new TownPopulation(nav, {
          suppressSpawns: () => racialSuppressPopulationSpawns(playerEntity),   // V4: the transformed lycanthrope empties the streets
          totalBlocks: loc.width * loc.height,
          // AUDIT 23 (characters-4/5): billboard race = the climate's
          // People; the NAME bank = the REGION's (MobilePersonNPC.cs:214).
          race: ({ 0: 'Nord', 2: 'Redguard', 3: 'Breton' })[climate?.people] ?? 'Breton',
          nameBank: getNameBankOfRegion(dfLocation.regionIndex),
          makePerson: (archive, guard) => {
            const person = new MobilePerson(nav, {
              archive, guard,
              // audit 2026-08-17: identity re-rolls per spawn - resolve
              // by the person's LIVE archive, never the creation one
              frameCount: (rec, a) => personTex.get(a).getFrameCount(rec),
              collider: personCollider,
              groundY: () => locOrigin[1],
            });
            personBatches.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
            return person;
          },
        });
      }
    }

    // EV7: the nature layout arrived with the kernel's reply - laid
    // out over the same blended samples and finished tilemap, consumed
    // at the same point in the sequence it was always computed at.
    for (const f of nature) addFlat(natureArchive, f.record, f.x, f.y, f.z);

    const flatAnims = new FlatAnimator();   // FA1
    const batches = [];
    for (const [k, centers] of groups) {
      const [archive, record] = k.split('_').map(Number);
      const t = await getTexture(archive);
      if (record >= t.recordCount) continue;
      uploadRecord(archive, record);
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      const batch = renderer.createBillboardBatch(archive, record, size, centers);
      batch._box = flatBatchAabb(centers, size);   // EV3
      unionBox(batch._box);
      armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
      batches.push(batch);
    }

    // AUDIT 26 (F019): the pixel's street StaticNPCs - identity inputs
    // + the billboard extent the activation ray needs, resolved the
    // way the interior host resolves its people's
    // (interiorContext.js:298-316). FLATS.CFG is awaited because
    // SetLayoutData's exterior overload reads it for the gender
    // (StaticNPC.cs:185-194); loadFlats never throws and is warmed with
    // the scene, so this is a coalesced wait. The list rides the pixel,
    // so destroyPixel takes it away with everything else.
    await pipeline.loadFlats();
    const pixelNpcs = [];
    for (const flat of pixelNpcFlats) {
      const t = await getTexture(flat.archive);
      if (!t || flat.record >= t.recordCount) continue;
      const size = scaledBillboardSize(t.getSize(flat.record), t.getScale(flat.record));
      const pn = exteriorNpcRecord(flat, pipeline.flatsFile()?.getFlatData(flat.archive, flat.record) ?? null);
      pixelNpcs.push({ ...pn, width: size.w, height: size.h });
    }

    // EV6: the pixel's models sort by MESH at build - one archetype's
    // placements draw back to back and the VAO shadow skips the rebind.
    models.sort((a, b) => a._order - b._order);

    built.set(key, {
      px, py, terrain, tilemapTex, tilemap, groundArchive, models, windmills, batches, flatAnims, texRemap, lights: pixelLights, animals: pixelAnimals, skyBase: climate.skyBase, samples, natureCount: nature.length,
      grass, tilemapBytes,   // EE7: the pixel's blades, drawn with its terrain and destroyed with it; the bytes stay so the near ring can place them later
      _box: bounds,   // EV3: pixel-local presentation bounds (terrain + models + flats)
      _stride: stride,   // EV4: the terrain surface's current ring class
      population, locOrigin, personBatches,   // T2 towns
      npcs: pixelNpcs,   // AUDIT 26 (F019): RMBLayout's street StaticNPCs, pixel-local
      boards: pixelBoards,   // the block's bulletin boards (41739), pixel-local boxes
      locBlocks,   // T3d: the Where-is directory's block scan

      location: dfLocation ? dfLocation.name : null,
      centerHeight: samples[64 * HEIGHTMAP_DIMENSION + 64] * worldHeight,
      avgY: dfLocation ? avg * worldHeight : 0,
    });
    const entry = built.get(key);
    // AUDIT EV F-SIM2: the ring class was chosen at job-send time and
    // the player may have crossed during the worker round trip - and
    // the pixelChanged restride sweep cannot see an unpublished pixel.
    // Re-check at publish, or a wrong-class chunk stands until the
    // NEXT crossing (which a player who stops walking never makes).
    const wantStride = strideFor(px, py);
    if (wantStride !== entry._stride) restrideTerrain(entry, wantStride);
    return entry;
  }

  // EV4: a built pixel crosses between the full-res core and the far
  // ring without rebuilding anything but its terrain SURFACE - the
  // models, flats, collider, doors and population all stay. The grid
  // re-builds from the pixel's own cached samples (blended, so a
  // location's flattening survives the round trip); the culling box is
  // already deep enough for either class (the skirt drop at build).
  /** EE7: place and upload one pixel's grass, or null when the mode
   *  places none or ?grass=off. */
  function buildGrassFor(px, py, groundArchive, tilemapBytes, samples) {
    const grassOf = renderer.tileGrassFor(groundArchive);
    // ?grass=off is the kill switch; ?grass=<n> sets blades per tile,
    // which the world render gate uses to ask for a density a software
    // rasteriser can screenshot inside its timeout
    const door = new URLSearchParams(globalThis.location?.search ?? '').get('grass');
    if (!grassOf || door === 'off') return null;
    const perTile = door && Number.isFinite(Number(door)) ? Math.max(0.1, Number(door)) : 4;
    const placed = placeGrass({
      tilemap: tilemapBytes, grassOf, heights: samples, tileDim: TERRAIN_TILE_DIM, tileSize: 6.4,
      heightScale: MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE, seed: (px * 73856093) ^ (py * 19349663), perTile,
    });
    return renderer.createGrass(placed.data, placed.count);
  }

  function restrideTerrain(p, stride) {
    const grid = buildTerrainGrid(p.samples, stride, ghostSampler(woods, p.px, p.py));
    renderer.destroyMesh(p.terrain);
    p.terrain = renderer.createTerrainSurface(grid.positions, grid.normals,
      stride === 1 ? TERRAIN_INDICES : TERRAIN_INDICES_LOD);
    // EE7: the grass follows the ring - born when the pixel comes near,
    // gone when it recedes
    if (stride === 1 && !p.grass) p.grass = buildGrassFor(p.px, p.py, p.groundArchive, p.tilemapBytes, p.samples);
    else if (stride !== 1 && p.grass) { renderer.destroyGrass(p.grass); p.grass = null; }
    p._stride = stride;
  }

  /** @param {{collectLoose?:boolean}} [opts] - A1: a season re-skin
   *  tears the pixel down and builds it again, but the reference never
   *  UNLOADS terrain for a season change (DaggerfallLocation re-skins
   *  what already stands), so the loose-object sweep below - which is
   *  the unload's CollectLooseObjects and nothing else - sits out. */
  function destroyPixel(px, py, { collectLoose = true } = {}) {
    const key = `${px},${py}`;
    const p = built.get(key);
    if (!p) return;
    renderer.destroyMesh(p.terrain);
    renderer.destroyGrass(p.grass);   // EE7
    renderer.gl.deleteTexture(p.tilemapTex);
    for (const b of p.batches) renderer.destroyBatch(b);
    for (const w of p.windmills ?? []) { w.hum?.stop(); w.hum = null; }   // WM4c: the mill's hum leaves with its pixel
    if (p.personBatches) for (const b of p.personBatches.values()) renderer.destroyBatch(b);   // T2
    collider.removeBucket(key);
    // T3d fix: the pixel's doors leave with it - they accumulated
    // across every rebuild (duplicate E-targets + unbounded growth
    // on long streams; the directory's dedup had been masking it).
    for (let i = buildingDoors.length - 1; i >= 0; i--) {
      if (buildingDoors[i].pixelKey === key) buildingDoors.splice(i, 1);
    }
    // P2-slice (items-2): a loose pile dies WITH its pixel - the
    // reference's mid-session collection sweep (CollectLooseObjects);
    // only the F9 envelope brings one back.
    if (collectLoose) droppedLoot.collectPixel(key);
    // ...and so does an exterior CORPSE, which is the same kind of
    // loose object (GameObjectHelper.cs:836-839 tracks the marker) and
    // was the half of :1040-1052 the port never wired: nothing removed
    // a corpse batch, so both pools drew every kill of the session for
    // ever. The teleport core tears down every built pixel through
    // this function, which is exactly ClearStreamingWorld's
    // CollectLooseObjects(true).
    if (collectLoose) { cityGuards.collectPixel(key); exteriorFoes.collectPixel(key); }
    built.delete(key);
  }

  // --- Streaming state + player ------------------------------------------
  // D1: TerrainDistance goes LIVE - the launcher's "Land View
  // Distance" row (Experimental/TerrainDistance) sizes the streamed
  // grid, clamped 1..4 exactly as DFU clamps it (SettingsManager.cs
  // :952-963; StreamingWorld.cs:55-56 [Range(1,4)], default 3 = the
  // 7x7). Read once at scene mount - DFU applies it the same way, at
  // StartGameBehaviour.ApplyStartSettings (:283), never rebuilding a
  // live world mid-session.
  const state = new StreamingWorldState(getInt('Experimental', 'TerrainDistance', 1, 4));
  const queue = state.init(startPixel.x, startPixel.y);
  let building = false;

  // A1: THE SEASON TURNS UNDER A STANDING WORLD.
  // DaggerfallLocation.Update (:118-130) polls the world clock EVERY
  // FRAME - "Only process if climate, season, day/night, or weather
  // changed" - and on a SeasonValue that differs from lastSeason runs
  // ApplyTimeAndSpace (:133-148) -> ApplyClimateSettings: what already
  // stands is RE-SKINNED, never reloaded. This host bakes its climate
  // swaps into GL uploads at build time, so the equivalent here is to
  // rebuild the streamed pixels - the same destroyPixel-and-requeue
  // the streamer already runs on a crossing, and it fires at most
  // twice a game year (into winter at Evening Star, out at First
  // Seed). The rebuild is NOT an unload: the pixels stay in
  // state.loaded, which means "built or building" - releasing them
  // would let the next crossing list them a second time - and the
  // loose-object sweep sits out, because the reference's terrain is
  // still there and its piles and corpses with it.
  // SeasonValue can only move on a DAY boundary (GetSeasonValue reads
  // Month), so the poll compares days and builds a date only when one
  // turns over - a frame in the same day costs one division.
  let _seasonDay = Math.floor(worldMinutes() / MINUTES_PER_DAY);
  /** Re-read the cached season off the one clock. Answers true when it
   *  MOVED, so the caller can decide what to do about geometry that
   *  already stands - a teleport is about to rebuild the world anyway
   *  and only wants the cache straight BEFORE its pixels build.
   *  @param {number} [atMinutes] the clock to read. The frame reads the
   *   LIVE one; a fast travel reads the minute it is ABOUT to arrive
   *   at, because performFastTravel raises time only after
   *   TeleportToCoordinates (DaggerfallTravelPopUp.cs:333, :344) and
   *   the destination must not build in the departure month.
   *  @returns {boolean} */
  function refreshSeason(atMinutes = worldMinutes()) {
    if (seasonPin !== null) return false;   // ?season pins the world for a shot
    const day = Math.floor(atMinutes / MINUTES_PER_DAY);
    if (day === _seasonDay) return false;
    _seasonDay = day;
    const want = climateSeasonFromMinutes(atMinutes);
    if (want === season) return false;
    season = want;
    // SetSunlightScale (WeatherManager.cs:309-319) reads the same
    // SeasonValue, and its winter arm is the FIRST thing it applies.
    weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
    return true;
  }
  let _reskinPending = false;
  // ROAD-Ar (R0): the re-skin's MOTOR HOLD - the key of the pixel the
  // player stood on when the flip tore the world down, null when
  // nothing is held. DaggerfallLocation re-skins standing geometry in
  // place (:118-130 -> ApplyTimeAndSpace -> ApplyClimateSettings), so
  // the reference has no outage to survive; this host bakes its swaps
  // into GL uploads and has to rebuild the pixel, and destroyPixel
  // takes the collider bucket AND the terrain floor with it (heightAt
  // answers -Infinity for a key that has left `built`, and
  // Collider's `feet[1] < floor + SKIN` can never fire against that).
  // A live motor therefore free-falls through the whole rebuild - a
  // COLD one, because the flip is the first time the winter archives
  // are fetched - and AcrobatMotor bills the entire drop the moment
  // the ground returns. Every other full teardown in this host ends
  // in player.spawn; this one holds instead, which is nearer the
  // reference still: the player does not move at all.
  let _seasonHoldKey = null;
  function tickSeason() {
    if (refreshSeason()) _reskinPending = true;
    // A pixel whose textures are still crossing must PUBLISH before its
    // key can be torn down - the same hazard pump re-checks for after
    // its await (buildPixel publishes only at its very end, so a
    // teardown against a key that has no entry yet frees nothing and
    // the finished build orphans everything it made). The flip waits a
    // frame; the season turns twice a game year.
    if (!_reskinPending || building) return;
    _reskinPending = false;
    const keys = [...built.keys()];
    // ...and the hold is armed BEFORE the ground goes, on the pixel
    // the streamer says the player is standing on (the same pixel the
    // nearest-first rebuild below puts back first).
    if (walkMode && playerSpawned) _seasonHoldKey = `${state.current.x},${state.current.y}`;
    for (const key of keys) {
      const [bx, by] = key.split(',').map(Number);
      destroyPixel(bx, by, { collectLoose: false });
    }
    // Nearest-first, the load list's own order (StreamingWorldState
    // ._loadList): the pixel under the player comes back first.
    const rebuild = keys.map((key) => {
      const [px, py] = key.split(',').map(Number);
      return { px, py };
    }).sort((p, q) => {
      const ca = Math.max(Math.abs(p.px - state.current.x), Math.abs(p.py - state.current.y));
      const cb = Math.max(Math.abs(q.px - state.current.x), Math.abs(q.py - state.current.y));
      if (ca !== cb) return ca - cb;
      return ((p.px - state.current.x) ** 2 + (p.py - state.current.y) ** 2)
        - ((q.px - state.current.x) ** 2 + (q.py - state.current.y) ** 2);
    });
    queue.push(...rebuild);
    console.log(`[season] ${season === SEASON.Winter ? 'winter' : 'summer'} - re-skinning ${rebuild.length} pixels`);
  }

  status(`building player pixel ${startPixel.x},${startPixel.y}`);
  const first = queue.shift();
  const playerPixel = await buildPixel(first.px, first.py);

  // Camera: at the start location's origin, or the pixel centre.
  const cam = { pos: [TERRAIN_SIZE / 2, playerPixel.centerHeight + 40, TERRAIN_SIZE / 2], yaw: Math.PI, pitch: -0.1 };
  const lookFilter = new LookFilter();   // AUDIT 28 W7: one filter per camera
  const moveAxes = new MoveAxes();   // AUDIT 28 W8: MovementAcceleration
  const cameraRecoiler = new CameraRecoiler();   // AUDIT 28 W9: CameraRecoilStrength
  const headBobber = new HeadBobber();   // AUDIT 28 W10: HeadBobbing
  const ridingAnimator = new RidingAnimator();   // TR2: the mount's frames, loop and neigh
  /** U53's one-builder law: ONE place changes the mode, and both the
   *  T-key pick and the interior hosts' dismount take it. TR5. */
  const setTransportModeHere = (mode) => {
    player.setTransportMode(mode);   // F-E3: the height action rides with the mode
    ridingAnimator.mount(mode);
    ridingArt = null;
    // MW-D42: mounting a HORSE in the enhanced skin saddles the
    // player's own Pegas horse, once per session, if their attached
    // Morrowind data carries the mod (MW-D40's loose door). Absent
    // data, a failed parse, or the classic skin all leave `pegas`
    // null and the CFA sprite rides exactly as before - the mod's
    // assets are the PLAYER'S, read at runtime like ARENA2, never
    // bundled (the license is the architecture; see pegasHorse.js).
    if (mode === TRANSPORT_MODES.Horse) tryLoadPegas();
  };
  let ridingArt = null;   // TR2: the four CFA frames of the mount under you
  let pegas = null;          // MW-D42: the loaded 3D mount, or null (the sprite lane)
  let pegasSounds = new Set();
  let pegasWanted = false;
  async function tryLoadPegas() {
    if (pegasWanted || !isEnhanced()) return;
    pegasWanted = true;
    try {
      const archives = await loadMorrowindArchives();
      const horse = loadPegasHorse({ renderer, archives });
      if (!horse.ok) {
        if (horse.stage !== 'data') console.warn(`[pegas] no 3D horse (${horse.stage}): ${horse.error ?? ''}`);
        return;
      }
      pegasSounds = await registerHorseSounds(audio, archives);
      pegas = horse;
      console.log(`[pegas] the horse is saddled (variant ${horse.variant}, ${pegasSounds.size} mod sounds)${horse.notes.length ? ' - ' + horse.notes.join('; ') : ''}`);
    } catch (err) {
      console.warn('[pegas] load failed; the sprite rides:', err?.message);
    }
  }
  let rightHeld = false;   // AUDIT 28 F-C2: HasAction(SwingWeapon) - the raw button, ungated
  // P1: grounded first-person is the default; ?fly restores the fly cam.
  // The motor freezes until the start pixel's collider exists.
  // C9 fix: shotMode must be declared BEFORE walkMode reads it - the
  // old order (U2b) put it 70 lines down and every bare ?world boot
  // died in the TDZ (?play and ?fly short-circuited past the read, so
  // the played paths never saw it; the &shot&world probe caught it).
  const shotMode = params.has('shot');
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const startKey = `${startPixel.x},${startPixel.y}`;
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
  // AUDIT 23 (C5): the exhaustion collapse - exterior.js's twin.
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
        // Both of this host's pools answer it, the watch and the
        // encounter foes, exactly as the rest deps ask them.
        enemiesNearby: areEnemiesNearby([...(cityGuards?.guards ?? []), ...(exteriorFoes?.foes ?? [])]),
        swimming: !!player.swimming, entity: playerEntity,
        day: !isNight(minuteNow()), inside: false,
      });
      const lines = out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.'];
      if (!townTalk.overlay) townTalk.showOverlay(new ActionTextBox(lines));
      if (out.kind === 'rest') {
        playerTicker.advance(60);
        playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
        playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
        playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
        tallySkill(playerEntity, SKILLS.Medical);
        surfacePlayer();
      } else {
        hurtPlayer(playerEntity, playerEntity.health, { bypassShield: true });   // SetHealth(0)
      }
    } finally { _inExhaustion = false; }
  }
  const drainExteriorFatigue = (n) => {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    surfacePlayer();
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0) onExhaustedExterior();
  };
  const playerTicker = createPlayerTicker(playerEntity, {
    // CG2: PlayerEnterExit.IsPlayerInside - the crime-guild letter's
    // gate. The same predicate this host already hands the quest
    // machine at :1064, so the two cannot disagree about where the
    // player is standing.
    isInside: () => (modes?.mode ?? 'exterior') !== 'exterior',
    onExhausted: onExhaustedExterior,
    say: (msg) => console.log('[player]', msg),
    onLevelUp: () => {
      console.log('[player] You have gained a level!');
      // DFU posts dfuiOpenCharacterSheetWindow (RaiseSkills :1414) -
      // the SHEET is where classic levels you up, and the door picks
      // the skin's face for it.
      townTalk.showOverlay(makeCharSheetWindow());
    },
  });   // AUDIT 18: the per-minute tick every host owes
  // AUDIT 21 (hosts lane, F6): this host's death presenter. Guard damage,
  // fall damage and the ticker's disease/poison sink all reach the one damage
  // door in playerEntity.js; the door calls this. Registered here rather than
  // passed down four call chains, because there is one player and one death.
  setDeathPresenter(() => {
    // DC1: the sequence starts from the LIVE eye and capsule, the way
    // PlayerEntity_OnDeath reads mainCamera.localPosition.y and
    // playerController.height at the death - a crouched death sinks
    // from the crouched eye toward a quarter of the CROUCHED capsule
    // below the feet, not the standing pair.
    if (!(townTalk.overlay instanceof DeathScreen)) townTalk.showOverlay(new DeathScreen({ eyeHeight: player.eye[1] - player.pos[1], capsuleHeight: player.height, onReset: () => endRunToTitleMenu(renderer) }));   // D1
  });
  // F117: Stendarr's rank-in-fifty, consulted by the door before the
  // presenter. This host has no submersion model, so submerged is the
  // default false - which is also true of every death it can present.
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
  // The STREAMING host moves between locations, so all three are live.
  // `_musicLoc` is refreshed on the same pixel crossing that swaps talk
  // topics - outside any location rect it is null, which is DFU's
  // IsPlayerInLocationRect == false and its locationIndex == -1.
  let _musicLoc = null;
  // AUDIT 24 (the seven-slice sweep): the seam above USED to answer
  // `_musicLoc !== null` - "this map pixel carries a location" - and
  // called that DFU's IsPlayerInLocationRect. It is not. C#'s own
  // comment at PlayerGPS.cs:687 says so in as many words: "Player can
  // be inside a map pixel with location but not inside location rect".
  // The real test is a WORLD-COORDINATE one against the town's
  // footprint widened by one full city block, and a map pixel is up to
  // seven times that area. Every consumer read the widened answer: the
  // quest machine's `when pc enters/exits`, CreateFoe's `send` gate,
  // isPlayerInTown, and the music director's location context.
  const _musicInLocationRect = () => {
    if (!_musicLoc) return false;
    const px = playerTravelPixel();
    const wc = state.worldCoords(walkMode ? player.pos : cam.pos);
    return isInLocationRect(wc.x, wc.z, locationWorldRect(_musicLoc, px.x, px.y));
  };
  // F062: PlayerGPS.isPlayerInLocationRect (:57), the tracked bool the
  // transition pair edges on. ResetState (:398-401) drops it WITHOUT
  // firing exit - the teleport core is the port's ResetState.
  let _wasInLocationRect = false;
  const _musicLocationType = () => _musicLoc?.mapTableData?.locationType ?? 0xffff;
  const _musicLocationIndex = () => _musicLoc?.locationIndex ?? -1;
  const musicDirector = createMusicDirector();
  ensureAudio(fetchBytes);
  // C9: the exterior FP weapon (host rule - every motor host carries
  // it). AUDIT 17e F38 / RETIRING A FLAG DELETES THE SENTENCE: the
  // 'no HUD-text layer yet' flag that stood here was retired by T3b
  // three lines below, but survived to be re-published as live work
  // by the grep-regenerated open-flags list.
  // T3b: the town interaction seam (modes/talk/pickpocket) - the same
  // module the exterior host mounts (the standing host rule). It is
  // also this host's first HUD-text layer; the rig's say routes there.
  // RP1: the People faction, the NPC race and the map-discovery key all
  // read the CURRENT region now. The flag that stood here said this
  // waited on "the current-pixel region wiring [landing] with travel" -
  // and _questRegionIndex below IS that wiring, shipped: it is the same
  // PlayerGPS.CurrentRegionIndex read the quest bridge, the map table
  // and the name bank already go through.
  // TK-v: the talk ENGINE the host window draws through. Assigned
  // after all four are built (they reference each other), so townTalk
  // reads it lazily through the getter below.
  let talkEngineRef = null;
  const townTalk = createTownTalk({
    talkEngine: () => talkEngineRef,
    renderer, canvas, fetchBytes, playerEntity, palette,
    // RP1: a GETTER, not startLoc's number - see the note above. It is
    // declared below this call, so the arrow defers the read to call
    // time, which is what makes it live in the first place.
    regionIndex: () => _questRegionIndex(),
    onCrime: () => _crimeResponse(),   // G1: late-bound - the guards mount below
    // QP1: GetBuildingList's questor half lands in the pool. Late-bound
    // like onCrime - npcSession mounts below, and the first topics set
    // (the streaming update) runs long after boot.
    onBuildingList: (buildings) => npcSession.buildQuestorPool(buildings),
  });
  townTalk.ensureLoaded();
  preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: INFO00I0 warms at boot
  preloadBookArt({ renderer, fetchBytes, palette });   // B1: BOOK00I0 warms at boot
  preloadTransportArt({ renderer, fetchBytes, palette });   // TR3: MOVE00I0 + MOVE01I0
  preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));   // I3/I4
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
  // FE1: the escort faces panel's session mount. Init CLEARS - DFU's
  // OnNewGame and OnStartLoad handlers both do (HUDEscortingNPCFaces
  // .cs:306-316) - and a load refills through restoreSessionState's
  // escortingFaces arm. getFactionData is the same persistent-store
  // read the quest world hook makes: the fixed-NPC portrait index is
  // FACTION.TXT's own `face` field.
  initEscortFaces({
    fetchBytes, palette, renderer,
    getFactionData: (id) => _questStore()?.dict.get(id) ?? null,
  });
  preloadInventoryArt({ renderer, fetchBytes, palette });   // U8d: INVE00I0/01I0 warm at boot
  preloadChargenArt({ renderer, fetchBytes, palette });   // U10: CHAR0*/PICK00/TMAP00 warm at boot
  preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11: SPOP/BUTTONS warm at boot
  preloadTravelMapArt({ renderer, fetchBytes, palette })   // W1: TRAV0I00/01/03/04 + the FMAP palette warm at boot
    .catch((e) => console.warn('[travelmap] classic travel map art unavailable:', e?.message ?? e));
  preloadSpellbookArt({ renderer, fetchBytes, palette })   // U42: SPBK00I0/01I0 + the ICON/MASK sheets warm at boot
    .catch((e) => console.warn('[spellbook] classic spellbook art unavailable:', e?.message ?? e));
  preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture }, { where: paperDollWhere() });   // U8f/U8g + UI3: SCBG/BODY/FACE + the item-record pipeline ( Breton male 0 is the PRE-chargen default, reloaded on the chosen identity)
  preloadPrisonScreenArt({ renderer, fetchBytes, palette })   // PRIS00I0 - the serving-time screen
    .catch((e) => console.warn('[court] prison screen art unavailable:', e?.message ?? e));
  // S3d: the INTERIM dagger seed is the FALLBACK only - a character
  // who runs chargen gets AssignStartingGear's real kit instead, so
  // seeding here would leave a stray dagger in the bag.
  if (playerEntity.chargenDone) seedStartingEquipment(playerEntity);
  // S3c/U9 / THE FOUR HOSTS RULE: chargen lived only in the dungeon
  // host, so booting straight into a town left the player on the
  // pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
  // whole session. Both exterior hosts now run it through the shared
  // session, and the paperdoll reloads on the chosen identity.
  let spellsByIndex = null;   // M2: the host-level SPELLS.STD map
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
    transferToCemetery: transferToCemeteryArm,   // V2e: the world host's arm (hoisted; defined by fastTravelTo)
  });
  // Q4-v: InitAtGameStart runs ONCE when a NEW character finishes
  // chargen (DFU's OnStartGame path into QuestListsManager). Chargen
  // resolves asynchronously and the bridge is composed further down
  // the boot, so the moment is recorded and fired by whichever side is
  // ready LAST. An already-made character (chargenDone at boot) is a
  // continuing session, not a new game - no init, exactly as DFU only
  // raises OnStartGame from the starting flows.
  let questBridge = null;
  let _questStartPending = false, _questStarted = false;
  const questInitAtGameStart = () => {
    if (_questStarted) return;
    if (!questBridge) { _questStartPending = true; return; }
    _questStarted = true;
    questBridge.initAtGameStart();
  };
  // TR3: THE TEST ROOM's boot - the same headless seam as ?class=
  // below, with the preset's identity seeded first (applyCharacter
  // honors it) and the armory landing after the class kit. The preset
  // resolves BEFORE the branch so an unknown id really does fall
  // through to the wizard rather than stranding the interim entity:
  // the never-traps law, at the front door.
  const testPreset = !playerEntity.chargenDone && params.has('test') ? testPresetById(params.get('test')) : null;
  if (!playerEntity.chargenDone && params.has('test') && !testPreset) {
    console.warn(`[testroom] no preset "${params.get('test')}" - the wizard stands`);
  }
  if (testPreset) {
    (async () => {
      const preset = testPreset;
      const sbi = await loadSpellIndex(fetchBytes);
      spellsByIndex = sbi;
      const { added } = await applyTestCharacter(playerEntity, preset, { fetchBytes, spellsByIndex: sbi });
      preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
        { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
      surfacePlayer();
      questInitAtGameStart();
      console.log(`[testroom] ${preset.label}: ${added} armory items in the pack`);
      // The Morrowind rigs, WITHOUT the trip to the pause card - the
      // room exists to look at them. Only when the data is attached;
      // without it the classic sprite stands exactly as everywhere
      // else, and the pause card's button still names why.
      const { morrowindDataCount } = await import('./dataSource.js');
      if (morrowindDataCount() > 0) {
        const { buildArmsFor } = await import('../combat/weaponRig.js');
        const res = await buildArmsFor(playerEntity);
        if (!res.ok) console.warn(`[testroom] arms refused - ${res.stage}: ${res.error}`);
      }
    })().catch((e) => console.warn('[testroom] boot failed; the wizard stands in', e));
  } else if (!playerEntity.chargenDone && params.has('class')) {
    // AUDIT 17f: ?class=N is the headless skip - parsed here for the
    // DUNGEON the host might build, but never honoured for the host's
    // own chargen, so a town boot had no way past the overlay.
    loadSpellIndex(fetchBytes).then((sbi) => { spellsByIndex = sbi; return applyHeadlessChargen(playerEntity, Number(params.get('class')), { fetchBytes, spellsByIndex: sbi }); })
      .then(() => {
        preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
          { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
        surfacePlayer();
        questInitAtGameStart();   // Q4-v: OnStartGame for the headless character
      })
      .catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  } else if (!playerEntity.chargenDone && !params.has('load')
    && !(params.has('classicload') && peekPendingClassicSave())) {
    // AUDIT 24: ...and not when a SAVE is about to be loaded. The save
    // carries chargenDone, but it arrives after the boot walk, so the
    // wizard would mount over the game the player asked to resume.
    // SAV3: a classic import is a load by another door - same gate,
    // but ONLY with a real pending SaveGames: a stale ?classicload
    // typed into the URL has nothing to import and must not leave the
    // player wizard-less on an interim entity.
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
          questInitAtGameStart();   // Q4-v: OnStartGame for the new character
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
  // T3d: the Where-is directory follows the player's LOCATION PIXEL
  // (DFU's TalkManager builds its list for PlayerGPS.CurrentLocation).
  // On pixel crossing, townTalk's topics swap to the new pixel's
  // named-building data; doors and the player resolve in the pixel's
  // LOCATION frame (the floating origin is a pure translation, so the
  // compass answers survive - the invariance is pinned). Names ride
  // the pixel's OWN region; the People faction stays on the boot
  // region (the recorded cross-region flag).
  let _topicsKey = false;   // false = never synced (null topics is a real state)
  /** The player in the LOCATION frame the building directory is built
   *  in - syncTopics owns that frame, so it hands the same closure to
   *  the talk topics and to the compass reads below (one writer, one
   *  space). Null outside a location, which is the wilderness. */
  let _talkPlayerPos = () => null;
  function syncTopics() {
    let cur = null;
    for (const p of built.values()) {
      const t = state.pixelTranslation(p.px, p.py);
      const lx = cam.pos[0] - t[0], lz = cam.pos[2] - t[2];
      if (lx >= 0 && lz >= 0 && lx < TERRAIN_SIZE && lz < TERRAIN_SIZE) { cur = p; break; }
    }
    const key = cur ? `${cur.px},${cur.py}` : null;
    if (key === _topicsKey) return;
    // AUDIT 26 F062: the crime clear MOVED to the frame loop's rect
    // edge - AUDIT 17e read this pixel crossing as OnExitLocationRect,
    // but DFU's event fires on leaving the WIDENED TOWN RECT
    // (PlayerGPS.cs:702-716), well inside the same map pixel; guards
    // were chasing a fleeing player all the way to the pixel border.
    _topicsKey = key;
    const dfLocation = key ? locationIndex.get(key) : null;
    _musicLoc = dfLocation ?? null;   // AUDIT 19: the music context's location half
    // TV-slice: entering a location's pixel DISCOVERS it (PlayerGPS
    // DiscoverCurrentLocation on the location-rect entry) - the write
    // half of the travel map's visibility law; fast-travel arrivals
    // land here too, so one writer covers both.
    if (dfLocation) {
      discoverLocation(dfLocation.mapTableData.mapId, {
        regionName: maps.getRegionName(dfLocation.regionIndex), locationName: dfLocation.name,
      });
    }
    if (!cur || !dfLocation || !cur.locBlocks) { _talkPlayerPos = () => null; townTalk.setTopics(null); return; }
    const { px, py } = cur;
    const lo = cur.locOrigin;
    _talkPlayerPos = () => {
      const t = state.pixelTranslation(px, py);
      const pos = walkMode && playerSpawned ? player.pos : cam.pos;
      return [pos[0] - t[0] - lo[0], pos[1] - t[1] - lo[1], pos[2] - t[2] - lo[2]];
    };
    townTalk.setTopics({
      exteriorBuildings: dfLocation.exterior.buildings,
      // QP1: the questor pool's SetLayoutData identities - the same
      // locationIndex npcSession's own guard reads (_questLoc()), and
      // the mapId SetLayoutData stamps into every NPCData.
      locationIndex: dfLocation.locationIndex ?? 0,
      mapId: dfLocation.mapTableData?.mapId ?? 0,
      blocks: cur.locBlocks,
      doors: buildingDoors.filter((e) => e.pixelKey === key).map((e) => ({
        dfBlock: e.dfBlock, recordIndex: e.recordIndex,
        position: [e.door.matrix[12] - lo[0], e.door.matrix[13] - lo[1], e.door.matrix[14] - lo[2]],
      })),
      locationName: dfLocation.name,
      regionName: maps.getRegionName(dfLocation.regionIndex),
      regionIndex: dfLocation.regionIndex,
      playerPos: () => _talkPlayerPos(),
    });
  }
  /** GetBuildingCompassDirection (TalkManager.cs:1203-1236) - %di's
   *  LOCAL arm, the one both consumers ask for by that name: the
   *  answer pipeline's GetKeySubjectLocationCompassDirection and
   *  questMacros' %di over a Place's building. ONE closure, because
   *  the frame and the directory are this host's to hand over. */
  const talkBuildingCompassDirection = (buildingKey) => buildingCompassDirection({
    listBuildings: townTalk.directory,
    playerPos: _talkPlayerPos(),
    isPlayerInside: (modes?.mode ?? 'exterior') !== 'exterior',
    currentBuildingKey: modes?.interiorBuilding?.buildingKey ?? 0,
  }, buildingKey);
  surfacePlayer();   // the probe surface exists from boot (T3b: pickpocket gold reads)
  let _livePersons = [];
  // G1: the city watch (SpawnCityGuards verbatim) - the streaming
  // host's guards ride the world collider (terrain heightAt included).
  // AUDIT 24 (wave 39): ONE blood pool for the host, shared by both
  // enemy pools - a splash is a world billboard and the host owns the
  // draw. EnemyBlood is per-entity in DFU only because Unity hangs a
  // component off each enemy; there is one archive and one clock.
  const hitEffects = createHitEffects({ renderer, getTexture, uploadRecordFrame });
  // ROAD-B: THE AREA, for GameManager.MakeEnemiesHostile.
  // DFU's ActiveGameObjectDatabase is ONE database for the scene, so
  // "all enemies in an area" is every live enemy this host can reach -
  // the two exterior pools AND the inside host's pool when the player
  // is in a building or a dungeon. That is the same join
  // `questFoeInstances` makes below (MT-iv recorded the identical
  // miss there: an action that walked only the outdoor pools could
  // never touch a foe standing in a dungeon, and the quest actions
  // that call this one - Enemies.cs:54 - run wherever the player is).
  const _liveEnemyDatabase = () => [
    ...exteriorFoes.foes, ...cityGuards.guards, ...(modes?.insideFoes?.() ?? []),
  ];
  const _makeEnemiesHostile = () => makeEnemiesHostile(_liveEnemyDatabase());
  const cityGuards = createCityGuards({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, hitEffects,
    playerWeaponSheathed: () => !!weaponRig.playerWeapon.sheathed,   // AUDIT 24 (wave 42): pacification's drawn-weapon penalty
    say: (l) => townTalk.say(l),   // C-slice: equipment breaks speak
    currentMinute: () => Math.floor(playerTicker.classicMinutes),   // AUDIT 23 (hosts-3): the poison clock
    currentPixelKey: () => `${playerTravelPixel().x},${playerTravelPixel().y}`,   // TrackLooseObject's stamp - the pile seam's key, one shape
    // ROAD-B B4: PlayerEnterExit's three entry latches, for SpawnCityGuards'
    // indoor gate (PlayerEntity.cs:628-641). The mode host owns all three
    // (it is the one that runs TransitionInterior); this host owns the
    // exterior pool the gate decides against.
    enterExitFlags: () => ({
      isPlayerInside: (modes?.mode ?? 'exterior') !== 'exterior',
      insideOpenShop: modes?.insideOpenShop ?? false,
      insideTavern: modes?.insideTavern ?? false,
      insideResidence: modes?.insideResidence ?? false,
    }),
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
  // X-slice: the encounter-foe pool - S32's above-ground arms go
  // LIVE. Same damage door shape as the guards; no crime machinery.
  const exteriorFoes = createExteriorFoes({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio, hitEffects,
    playerWeaponSheathed: () => !!weaponRig.playerWeapon.sheathed,   // AUDIT 24 (wave 42): pacification's drawn-weapon penalty
    currentMinute: () => Math.floor(playerTicker.classicMinutes),
    currentPixelKey: () => `${playerTravelPixel().x},${playerTravelPixel().y}`,   // TrackLooseObject's stamp
    playerSinks: playerTicker.sinks,   // AUDIT 24 (wave 30): OnMonsterHit's fatigue rider drains through the host's one set of doors
    makeAreaHostile: _makeEnemiesHostile,   // ROAD-B: DaggerfallEntityBehaviour.cs:255-258
    say: (l) => townTalk.say(l),
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      hurtPlayer(playerEntity, dmg);
      audio.playOneShot(hitSoundFor(wpn), 1.1);
      // EnemyAttack.SendDamageToPlayer (:404-406) SendMessages
      // "RemoveHealth" for EVERY attacker, and PlayerFootsteps
      // .RemoveHealth (:348-364) answers with the 40% pain cry.
      playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
      surfacePlayer();
    },
    // X2-slice: the shoot frame looses a REAL arrow through the C13
    // flight (the enemy meta hunts the player mid-capsule), ringing
    // ArrowShoot from the archer.
    onArrow: (from, dir, f) => {
      arrows.fire(from, dir, { enemy: true, shooterFoe: f, weapon: f.entity.weapon });
      audio.play3d(SOUND.ArrowShoot, from, 1, { maxDistance: 16 });
    },
    // X3-slice: casters - the S16 lists assign once the SPELLS.STD
    // map lands, and the release seams ride the ONE engine: the AoC
    // explosion and the enemy missile (aimed at the walking player's
    // mid-capsule at fire time, the dungeon shape).
    spellsByIndex: () => spellsByIndex,
    magicHooks: {
      explodeAt: (...a) => magic.explodeAt(...a),
      fireMissile: (from, spell, casterLevel, foe) => {
        if (!(walkMode && playerSpawned)) return;
        const d = [player.pos[0] - from[0], player.pos[1] + 0.9 - from[1], player.pos[2] - from[2]];
        const l = Math.hypot(...d) || 1;
        magic.fireEnemyMissile(from, [d[0] / l, d[1] / l, d[2] / l], spell, casterLevel, foe);
      },
    },
  });

  // The classic catch-up loop (PlayerEntity.Update:486-492): per
  // elapsed game minute, one intermittent roll; break on a spawn.
  // Fast travel resets the anchor (PreventEnemySpawns parity - DFU
  // suppresses the whole post-travel window).
  let _lastEncMinutes = null;
  function runEncounterTick(playerFeet) {
    const now = Math.floor(playerTicker.classicMinutes);
    if (_lastEncMinutes == null) _lastEncMinutes = now;
    // THE FLAG, AT LAST WITH A READER. PlayerEntity.Update wraps this
    // whole loop - the spawn roll AND the passive guard rolls inside
    // it - in `if (!preventEnemySpawns)` (:479-482), and clears the
    // flag at the tail of the same update (:524-525). This function IS
    // that loop in this host, so it owns both halves: nowhere else can
    // clear the flag without racing the frame's own draw order, and a
    // flag cleared before the loop that reads it is no flag at all.
    //
    // The three writers are the clock JUMPS - fast travel, the
    // vampirism transformation, and the jail skip (both its arms:
    // DaggerfallCourtWindow.cs:473 across the sentence, :484 on every
    // release). A thirty-day sentence would otherwise walk thirty days
    // of encounter rolls the instant the courthouse door opened.
    const span = playerEntity.preventEnemySpawns ? 0 : Math.min(now - _lastEncMinutes, 1440);
    // :484 - `bool updatedGuards = false`, declared OUTSIDE the loop
    // and inside the preventEnemySpawns guard: the sweep below runs at
    // most once per Update, not once per caught-up minute.
    let _updatedGuards = false;
    for (let l = 0; l < span; l++) {
      const key = `${playerTravelPixel().x},${playerTravelPixel().y}`;
      const hit = intermittentEnemySpawn({
        gameMinutes: _lastEncMinutes + l + 1, inside: false,
        // F061: IsPlayerInLocationRect is the WIDENED TOWN RECT
        // (PlayerGPS.cs:687-699), not "this pixel has a location" -
        // in the wilderness ring of a town's pixel the wilderness
        // tables roll, day and night.
        inLocationRect: _musicInLocationRect(),
        climateIndex: maps.getClimateIndex(playerTravelPixel().x, playerTravelPixel().y),
        playerLevel: playerEntity.level,
      });
      if (hit) {
        // RE1: DFU's own placement. This used to walk eight compass
        // points at minDistance and take the first with ground under
        // it - so an encounter arrived due NORTH of the player unless
        // north was blocked, could stand inside a wall the ray never
        // tested, and could share a spot with something already
        // standing there. PlayerEntity's arms all go out through
        // CreateFoeSpawner, which is PlaceFoeFreely, which is the
        // function the quest arm and the enchantment arms already use.
        // The band and the line-of-sight flag ride in on the hit -
        // they are the spawner's arguments and differ per arm.
        _standEncounterFoe(hit, playerFeet);
        break;
      }
      // PlayerEntity.Update:498-511 - the SAME minute's second arm,
      // which the port had never called: SpawnCityGuards(FALSE) had no
      // production caller at all, so the witness law (a civilian sees
      // the crime, a guard NPC in sight converts, otherwise guards
      // arrive after 5-10s) and the passive response to a hated or
      // banished character never ran. The rolls are independent and
      // each levies Criminal_Conspiracy first, exactly as DFU orders
      // it - the watch stands down the moment crimeCommitted clears.
      const _region = _questRegionIndex();   // PlayerGPS.CurrentRegionIndex
      const _owed = passiveGuardSpawns({
        legalRep: legalRepOf(playerEntity, _region),
        severePunishmentFlags: playerEntity.regionConditions?.[_region]?.severePunishmentFlags ?? 0,
      });
      for (let s = 0; s < _owed; s++) {
        setCrimeCommitted(playerEntity, CRIMES.Criminal_Conspiracy);   // V4: through the one setter (SuppressCrime)
        _witnessResponse();
      }
      // ROAD-B: :513-516, the THIRD statement of the same minute -
      // "If enemy guards have been spawned, any new NPC guards should
      // be made into enemyMobiles". `updatedGuards` makes it run at
      // most ONCE per Update however many minutes the loop catches
      // up, so it is the local latch here and not a per-minute call:
      // the conversion is a sweep of the whole population, and DFU
      // deliberately does not repeat it inside one frame.
      //
      // The port had no caller for this at all, so a town whose watch
      // was already out kept minting ordinary wandering guards the
      // player could walk straight past.
      if (!_updatedGuards) {
        _updatedGuards = true;
        cityGuards.makeNpcGuardsIntoEnemies({ pool: _guardPool(), playerFeet })
          .catch((e) => console.error('[guards]', e));
      }
    }
    // :522 - `lastGameMinutes = gameMinutes`, OUTSIDE the guard: the
    // suppressed window is skipped, not replayed later.
    _lastEncMinutes = now;
    // :524-525 - "Allow enemy spawns again if they have been disabled".
    if (playerEntity.preventEnemySpawns) playerEntity.preventEnemySpawns = false;
  }
  const _guardPool = () => _livePersons.map(({ person, pos }) => ({
    pos, fwdYaw: person.facingYaw, guard: person.guard,
    disable: () => {
      for (const p of built.values()) {
        const it = p.population?.pool.find((i) => i.person === person);
        if (it) { it.person.release(); it.active = false; it.scheduleEnable = false; it.scheduleRecycle = false; it.visible = false; return; }
      }
    },
  }));
  /** SpawnCityGuards(FALSE) - the WITNESS arm, the other half of the
   *  same member: no crime was just seen to be committed, so the pool
   *  is searched for someone who CAN see the player. A guard NPC that
   *  can converts on the spot (and takes every later pool entry with
   *  it, DFU's own quirk); a civilian who can starts the 5-10 second
   *  arrival countdown the pool's update already consumes. */
  /** ROAD-B: the ONE entry to PlayerEntity.SpawnCityGuards for this
   *  host, both arms. The INDOOR arm (:628-642) runs first and, when
   *  it takes the call, RETURNS - a crime in an open shop, a tavern or
   *  a residence is answered at that building's own lowest outer door
   *  by the interior's own watch pool, and the street law below never
   *  runs. Every other case falls through here exactly as C# falls
   *  through the `if`. This host's FLAGGED note (below, at the mode
   *  machine's `spawnCityGuards` key) said the arm was unreachable
   *  because "this host's pool is the exterior street"; the pool it
   *  needed is worldModes' own, and this is the routing. */
  function _spawnGuards(immediate) {
    if (modes?.spawnCityGuardsInside?.(immediate)) return;
    const feet = walkMode && playerSpawned ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(!!immediate, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  function _witnessResponse() { _spawnGuards(false); }
  function _crimeResponse() { _spawnGuards(true); }
  // G2: arrest + court through the townTalk overlay seam.
  //
  // AUDIT 21 F8 RETIRED THE OPEN FLAG THAT STOOD HERE. It said the prison
  // day-skip was a no-op until the shared calendar lands, and it was false
  // twice over: the clock landed in AUDIT 21 F2 (worldTick owns one now), and
  // the no-op was no longer inert once DAYS drive diseases - a thirty-day
  // sentence cost the player and the world nothing. createArrestFlow now
  // defaults advanceDays to the real clock, so there is no argument left for a
  // host to forget.
// AUDIT 39 (#21): a GETTER, not startLoc's number. LowerRepForCrime
  // (PlayerEntity.cs:2286-2299), SurrenderToCityGuards (:2313) and
  // RaiseReputationForDoingSentence (:2301-2303) all read
  // PlayerGPS.CurrentRegionIndex at the MOMENT of the crime, and this
  // host fast-travels - a boot-time value filed every later crime's
  // legal-rep loss, fine and banishment under the province the session
  // started in. Same read, same reason, as townTalk's above.
  const arrestFlow = createArrestFlow({
    townTalk, playerEntity, regionIndex: () => _questRegionIndex(),
    onCourtScreen: () => cameraRecoiler.reset(),
    // ReleaseFromPrison's last two lines (DaggerfallCourtWindow.cs:488-489).
    // GameManager.ClearEnemies destroys every active enemy object and every
    // pending foe spawner; above ground that is the encounter pool. The
    // WATCH is not swept here - it does not need to be, because the crime
    // clearing one line earlier already despawns it (cityGuards' own
    // crime-clear law), which is DFU's order too.
    clearEnemies: () => { for (const f of [...exteriorFoes.foes]) { if (!f.dead) exteriorFoes.removeFoe(f); } },
    positionPlayerAtLocationEntrance: () => positionPlayerAtLocationEntrance(),
  });
  const weaponRig = createWeaponRig({
    activateHeld: () => held(keys, 'ActivateCenterObject'),   // AUDIT 28 W12: the drawn bow's un-draw key
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say: (l) => townTalk.say(l),
    // MW-D8: the Morrowind arm rides the player's eye. Required, not
    // optional - a host that forgets it gets the classic sprite and a
    // named reason rather than an arm at the world origin.
    // MW-D10: pitch too - rule 54 pitches the rig's NECK by 0.75 of it
    // and the lens by all of it, so the arms lag the look the way they
    // do in Morrowind. A host that omits it gets arms that never move.
    // MW-D15 / rule 32(a): sneaking rides the camera dep beside the
    // pitch, because it is the same question - what the player's BODY is
    // doing - and the pitch already proved that is the seam every host
    // has. Morrowind's Sneak STANCE, which is DFU's Sneak binding; its
    // Crouch is a collider height, not an animation state.
    camera: () => ({ pos: player.eyeAt(), yaw: cam.yaw, pitch: cam.pitch, sneaking: !!player.isSneaking,
      // IG1: the head bob's VERTICAL feeds the first-person offset (the
      // reference's head_bobbing.lua drives setFirstPersonOffset's z
      // only); bobOffset[1] is the raw vertical, un-rotated.
      bob: [0, player.bobOffset ? player.bobOffset[1] : 0],
      move: { forward: player.moveForward || 0, strafe: player.moveStrafe || 0, running: !!player.isRunning, speed: player.moveSpeed || 0,
        grounded: player.grounded !== false, jumping: !!player.jumping, swimming: !!player.swimming, levitating: !!player.levitating } }),   // MW-D26: the movement-settings vector, the reference's own selection source; MW-D39 added the jump-state inputs (grounded/jumping/swimming/levitating)
    spellArmed: () => magic.spellArmed(),   // M2
  });
  // M2: SPELLCASTING ABOVE GROUND - exterior.js's twin note applies.
  /** The per-foe doors, hoisted (AUDIT 24 wave 32): the cast engine takes
   *  them, and so does the broker fan-out below - one set of doors per
   *  entity, exactly as one EntityEffectManager per entity. */
  const foeSinks = (g) => ({
    hurt: (n) => { if (n > 0) (g._encounter ? exteriorFoes.damageFoe(g, n, player.pos) : cityGuards.hurtGuard(g, n, player.pos)); },   // X-slice: route by pool
    heal: (n) => { if (n > 0) g.entity.health = Math.min(g.entity.maxHealth ?? Infinity, g.entity.health + n); },
    drainMagicka: (n) => { if (n > 0) g.entity.magicka = Math.max(0, (g.entity.magicka ?? 0) - n); },
    restoreMagicka: (n) => { if (n > 0) g.entity.magicka = Math.min(g.entity.maxMagicka ?? Infinity, (g.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.max(0, (g.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.min(maxFatigue(g.entity), (g.entity.fatigue ?? 0) + n); },
  });
  // X11: hoisted out of the createPlayerMagic literal it used to be
  // written inline in. The enchantment door below needs the SAME set:
  // a caster reaches applySpell as `{ entity, sinks }` and the sinks
  // are what a Transfer effect heals the caster through (effects.js
  // :828/:842). That door passed `{ entity: attacker }` bare, so a
  // player-cast Transfer Health riding an enchantment drained the
  // target and healed nobody - found while wiring reflection, which
  // needs the caster's sinks for the same reason.
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
    renderer, audio, getTexture, uploadRecord, uploadRecordFrame,
    collider: { raycast: (o, d, m) => ((modes?.mode === 'interior' && modes?.interiorCollider) ? modes?.interiorCollider : collider).raycast(o, d, m) },
    playerEntity,
    playerSinks: playerSpellSinks,
    say: (l) => townTalk.say(l),
    now: () => playerTicker.classicMinutes,   // V2a: MorphSelf's once-a-day clock
    // QG1: the ready-spell doors - the machine's CastSpellDo /
    // CastEffectDo latches ride these two events (machine.js's own
    // contract since the Q arc; nothing raised them until now, so the
    // three corpus quests' `cast X spell do` triggers never fired).
    onNewReadySpell: (sp) => questBridge?.machine?.notifyNewReadySpell?.(sp),
    onCastReadySpell: (sp) => {
      questBridge?.machine?.notifyCastReadySpell?.(sp);
      // MW-D39: the spell goes, and so does the arm - the same cast
      // moment the dungeon host uses, through the rig's one door. An
      // animation, never a gate.
      weaponRig?.castSpellAnim?.(sp?.rangeType);
    },
    surfacePlayer,
    foes: () => (modes?.mode ?? 'exterior') === 'exterior' ? [...cityGuards.guards, ...exteriorFoes.foes] : [],   // X-slice: encounter foes are spell targets too
    foeSinks,
    absorbCtx: () => ((modes?.mode ?? 'exterior') === 'exterior'
      ? { inside: false, day: !isNight(minuteNow()) }
      : { inside: true, day: false }),
    // TP-slice: the Teleport effect's prompt (Teleport.cs:81-98, the
    // 4000 anchor/teleport box; AllowCancel is DFU's own QoL).
    // Anchor = the S33 native shape; Teleport = the quickload warp,
    // the anchor CONSUMED on arrival (:133/:255 both null it). A cast
    // inside a mode leaves it first (:151's immediate transition).
    // X7: the Identify SPELL's window. The effect refunds its own cost
    // in the engine and hands the two numbers here; the window itself
    // lives in worldModes with the rest of the overlay stack, so this
    // routes exactly as onTeleport does. A refusal (no art, or an
    // overlay already open) says so rather than eating the cast.
    // X9: the creature dispel, exterior arm. The encounter pool is
    // the one that can hold undead or daedra above ground; guards are
    // class enemies and carry no group bit at all, so they are exempt
    // by the same table that exempts them from Pacify Humanoid.
    onDispel: ({ group, chance }) => {
      const list = getNearbyObjects(detectFeed.scanNow(), group) ?? [];
      const gone = dispelNearby(list.map((no) => no.ref), () => Math.floor(Math.random() * 100) < chance);
      for (const f of gone) exteriorFoes.removeFoe(f);
      if (gone.length) townTalk.say(`${gone.length} dispelled.`);
    },
    // X10: the Dispel Magic picker, routed like onIdentify.
    onDispelMagic: (d) => {
      if (!modes?.openDispelPicker?.({ chance: d.chance })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    onIdentify: (d) => {
      if (!modes?.openIdentifyWindow?.({ chance: d.chance, refund: d.refund })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    // X11b: the Create Item picker, routed like the two above.
    onCreateItem: (d) => {
      if (!modes?.openCreateItemPicker?.({ rounds: d.rounds })) {
        townTalk.say('You cannot concentrate on that right now.');
      }
    },
    onTeleport: () => teleportPrompt(),
  });
  // E2: THE ENCHANTCTX MOUNT - the one place this host answers the
  // enchantment system's seams (setDefaultEnchantCtx folds under every
  // dispatch; the charter and the seam list live in enchantments.js).
  // The cast arms ride the M2 engine: applySpellToSelf is
  // CastWhenUsed's CasterOnly assign (castByItemSelf), setReadySpell
  // its click-to-cast ready (SetReadySpell(bundle, true) - free, so no
  // spell points), applySpellToTarget CastWhenStrikes' landing with
  // saves rolled. nearbyFoes serves the affinity scans off the live
  // pools; spawnFoe is SoulBound's break release. The interior mode
  // shares this mount (its foes list is empty, so the scan arms answer
  // none); the dungeon-mode ctx is dungeonContext's to mount. FS1:
  // that used to read "FLAGGED there with the rest of its enchant
  // wiring", and there was no flag there - setDefaultEnchantCtx has
  // exactly one caller in the tree, this one, so the standalone
  // ?dungeon host runs every CastWhenUsed / CastWhenStrikes / SoulBound
  // / affinity arm against no ctx at all. They are optional-chained, so
  // it is silent. The flag now exists where the work does. S40 filled isResting
  // in - the sentence that stood here said it "stays absent above
  // ground (no rest window here yet)", and this slice put one here.
  // V2c filled inSunlight/inHolyPlace in the same way: the answers
  // ride passiveSpecials' registered host seam (worldModes' mount).
  // X4: hoisted out of the enchant block below - the Detect feed and
  // the frame body need the same two live reads the enchant ctx does
  // (the player's feet, and exterior mode's foe pool), and one
  // definition beats two that can drift.
  const enchantFeet = () => (walkMode && playerSpawned ? player.pos : cam.pos);
  // EC1 - THE LIVE FOE POOL. This answered `[]` in every mode but
  // exterior, which is the mode the player does not fight in. DFU has
  // NO scene gate here at all: PlayerGPS.UpdateNearbyObjects
  // (PlayerGPS.cs:747-777) walks ActiveGameObjectDatabase
  // .GetActiveEnemyBehaviours() - every active enemy in the scene -
  // and CastWhenStrikes does not look a foe up at all
  // (CastWhenStrikes.cs:105), it assigns the bundle to the entity
  // behaviour the strike already handed it. The port needs the lookup
  // only because it needs the RECORD to reach that foe's sinks; the
  // gate was never DFU's.
  //
  // What the gate cost, in the streaming host, inside a dungeon: a
  // CastWhenStrikes weapon found no record for the foe it had just
  // struck and returned, so paralysis, Wizard's Fire and the other ten
  // classic strike spells did NOTHING; the vampiric drain and both
  // artifact affinity scans saw an empty room. Nothing threw and
  // nothing was logged - the enchantment simply had no effect where
  // the fighting is. The one ctx in play is this mount: no host passes
  // an enchantCtx at the strike site (formulas.js:465 defaults it
  // null), so mergeCtx folds this default under every dispatch.
  // The law itself is in shared.js, tested on its own - which pool is
  // live, and whose sinks a record from it must go through. This host
  // supplies the three live reads it asks for.
  const _mode = () => (modes?.mode ?? 'exterior');
  const _dungeonPool = () => (_mode() === 'dungeon' ? (modes?.dungeonCtx ?? null) : null);
  const enchantFoes = () => liveEnchantFoes(_mode(), modes?.dungeonCtx ?? null, () => [...cityGuards.guards, ...exteriorFoes.foes]);
  const enchantFoeSinks = (f) => liveEnchantFoeSinks(f, modes?.dungeonCtx ?? null, foeSinks);
  /** SD1: stand a loose foe - SoulBound's break release, the Sanguine
   *  Rose's Daedroth - through DFU's OWN placement law, in whichever
   *  world the player is actually standing in.
   *
   *  Both arms used to drop the foe at the player's feet plus a fixed
   *  (+2, +1, 0): inside the player in a corridor, inside the wall
   *  against one. placeFoeFreely is the same law the quest foe arm
   *  already stands its foes through (tryPlaceFoe above) - one home,
   *  and it was already here.
   *
   *  minDistance 4, not the function's own 5: CreateFoeSpawner's
   *  defaults (GameObjectHelper.cs:1314) are the spawner FIELDS both
   *  enchantment callers get, and PlaceFoeFreely is handed those
   *  rather than its own signature defaults.
   *
   *  The law REFUSES a spot DFU would have rejected - no floor under
   *  it, something already there, too close to the wall the ray found
   *  - and DFU's spawner simply tries again next frame. This retries
   *  the same way. The budget is the port's own call: DFU leaves a
   *  MonoBehaviour running for free, and a spawn that cannot find a
   *  spot in a sealed corridor must not spin here. */
  const LOOSE_FOE_PLACE_ATTEMPTS = 12;
  /** RE1: an intermittent encounter, stood through DFU's placement.
   *  Separate from _standLooseFoe because the two differ in what they
   *  are: a loose foe is summoned AT the player and takes the enchant
   *  ctx's live pool, an encounter is rolled by the world clock, is
   *  always exterior (the dungeon arm is dungeonContext's), and
   *  carries its own band. Same law, same retry rule, different
   *  arguments - which is exactly how DFU's call sites differ. */
  const _standEncounterFoe = (hit, feet) => {
    const env = placeFoeEnv({
      collider,
      playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
      playerYawRad: cam.yaw,
      fovDegrees: fieldOfView() * 180 / Math.PI,
      isOccupied: entityOccupancy((f) => f.ai?.feet, () => exteriorFoePool(), feet),
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
    return exteriorFoes.spawnFoe(hit.mobileType, [spot.x, fly ? spot.y + 1.5 : spot.y, spot.z], {
      yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player
    }).catch(() => null);
  };
  const _standLooseFoe = (mobileType, { allied = false, lineOfSightCheck = true } = {}) => {
    const mode = _mode();
    // Interiors have no foe pool to stand one in, so they still refuse
    // - EC1's answer, and the honest one until a pool exists.
    if (mode !== 'exterior' && mode !== 'dungeon') return null;
    const d = _dungeonPool();
    const feet = enchantFeet();
    const env = placeFoeEnv({
      collider: d ? d.collider : collider,
      // origin at the controller centre, as tryPlaceFoe has it - DFU
      // casts from PlayerObject.transform.position, not the feet
      playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
      playerYawRad: cam.yaw,
      fovDegrees: fieldOfView() * 180 / Math.PI,   // fieldOfView() answers RADIANS
      isOccupied: entityOccupancy((f) => f.ai?.feet, () => enchantFoes(), feet),
    });
    let spot = null;
    for (let i = 0; i < LOOSE_FOE_PLACE_ATTEMPTS && !spot; i++) {
      spot = placeFoeFreely(env, { minDistance: 4, maxDistance: 20, lineOfSightCheck });
    }
    if (!spot) return null;
    // FinalizeFoe (FoeSpawner.cs:210-226): a FLYING foe lifts 1.5 from
    // the test point; walkers land through the pool's own chain.
    const fly = (ENEMY_BASICS[mobileType]?.behaviour ?? 'General') === 'Flying';
    const pos = [spot.x, fly ? spot.y + 1.5 : spot.y, spot.z];
    const yaw = Math.atan2(feet[0] - spot.x, feet[2] - spot.z);   // LookAt player
    const stand = d
      ? d.spawnLooseFoe(mobileType, pos, { yawRad: yaw, allied })
      : exteriorFoes.spawnFoe(mobileType, pos, { yaw, allied });
    return Promise.resolve(stand).catch(() => null);
  };
  /** EC1: THIS host's own pools, exterior only - and deliberately NOT
   *  enchantFoes(), which now answers the live mode's. Two consumers
   *  read this feed and both are exterior arms: the HUD Detect markers
   *  drawn by this frame (dungeon mode draws dungeonContext's HUD off
   *  dungeonContext's own feed, which has always held that host's foes
   *  and piles), and onDispel, which removes what it dispels through
   *  exteriorFoes.removeFoe. Widening the shared getter without
   *  splitting these would have handed dungeon records to the exterior
   *  pool's remover - one change, two consumers, and only one of them
   *  wanted it. */
  const exteriorFoePool = () => [...cityGuards.guards, ...exteriorFoes.foes];
  const detectFeed = createDetectFeed(playerEntity, {
    entities: () => exteriorFoePool().filter((f) => !f.dead && f.ai).map(foeNearbyRecord),
    // FX1 (F207): UpdateNearbyObjects walks EVERY active DaggerfallLoot
    // with no scene gate (PlayerGPS.cs:747, :766-776) - the world piles
    // the player drops and the lootable corpse containers both mark
    // outdoors in DFU. The old entities-only feed rested on "no loot
    // piles above ground", false since droppedLoot mounted.
    // DT1: this host names its loot KINDS and shared.js's
    // nearbyLootRecords does the walk - two hosts had it inline and
    // two had it nowhere, which is how F207 survived in the two that
    // matter most.
    loot: () => nearbyLootRecords({ piles: droppedLoot._piles, foes: exteriorFoePool() }),
    feet: () => enchantFeet(),
  });
  {
    setDefaultEnchantCtx({
      spellsByIndex: () => spellsByIndex,
      now: () => Math.floor(playerTicker.classicMinutes),
      sinks: {
        hurt: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
        heal: (n) => { if (n > 0) { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); surfacePlayer(); } },
      },
      // AUDIT 39: HealthLeech.cs:86-89 bills the WEARER on every strike
      // (8) and every use (16) of a WheneverUsed leech, not only on the
      // magic round - and worldTick's per-round ctx was the only mount
      // in the tree that carried hurtSelf, so the -4000-point drawback
      // cost the player nothing at the two doors that spend it.
      hurtSelf: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
      say: (l) => townTalk.say(l),
      // S40: CastWhenHeld.cs:135 - a held enchantment degrades at 60
      // per round while the player is resting and 4 otherwise, and the
      // port's consumer (enchantments.js:317) had NO feed because rest
      // lived in the one host whose enchant ctx is unmounted. The
      // window raises the flag on OPEN, so it is live here the moment
      // the rest page is up.
      isResting: () => !!playerEntity.isResting,
      // V2c: the E1 conditional arms' two flags (RepairsObjects' sun
      // gate, the affinity/curse place gates). Both read the sunlight
      // seam worldModes registered, so they route by LIVE mode.
      inSunlight: () => playerInSunlight(),
      inHolyPlace: () => playerInHolyPlace(),
      applySpellToSelf: (record) => magic.castByItemSelf(record),
      setReadySpell: (record) => magic.readySpell(record, { free: true }),
      applySpellToTarget: (record, attacker, target) => {
        // X11: the caster now travels WITH ITS SINKS. Spell Reflection
        // sends the bundle back at whoever cast it, and a caster with
        // no sinks would have the reflected damage land nowhere -
        // silently, which is the worst way for it to be wrong. The
        // attacker here is either the player or one of the pool's
        // foes, and both have sinks a few lines up.
        const af = attacker && attacker !== playerEntity
          ? enchantFoes().find((x) => x.entity === attacker) : null;
        const casterOf = () => {
          if (!attacker) return null;
          if (attacker === playerEntity) return { entity: playerEntity, sinks: playerSpellSinks };
          return af ? { entity: attacker, sinks: enchantFoeSinks(af) } : { entity: attacker };
        };
        if (target === playerEntity) { magic.applySpellToPlayer(record, attacker?.level ?? 1, casterOf()); return; }
        const f = enchantFoes().find((x) => !x.dead && x.entity === target);
        if (!f) return;
        const caster = casterOf();
        const r = applySpell(record, attacker?.level ?? 1, target, enchantFoeSinks(f), Math.random, caster);
        // The same re-target hostMagic does for the cast paths - this
        // door is the enchantment path's equivalent seam.
        if (r.reflected && caster?.entity) {
          if (caster.entity === playerEntity) magic.applySpellToPlayer(record, attacker?.level ?? 1, caster, { reflectedCount: 1 });
          else applySpell(record, attacker?.level ?? 1, caster.entity, caster.sinks ?? {}, Math.random, caster, { reflectedCount: 1 });
        }
      },
      nearbyFoes: (range) => {
        const pf = enchantFeet();
        return enchantFoes().filter((f) => !f.dead && f.ai
          && Math.hypot(f.ai.feet[0] - pf[0], f.ai.feet[1] - pf[1], f.ai.feet[2] - pf[2]) <= range)
          // V3: distance rides along - the Skull of Corruption clones
          // the NEAREST enemy; the field is additive, no reader broke
          .map((f) => ({
            mobileType: f.mobileType ?? f.entity?.mobileType ?? 128,
            distance: Math.hypot(f.ai.feet[0] - pf[0], f.ai.feet[1] - pf[1], f.ai.feet[2] - pf[2]),
            // MT-ii: the LIVE team - both summons filter their scan on
            // `Team != MobileTeams.PlayerAlly` before counting company
            // (SanguineRoseEffect.cs:47-48, SkullOfCorruptionEffect
            // .cs:47-48), so your own standing summons never count.
            team: f.entity?.team ?? 'PlayerEnemy',
            hurt: (n) => enchantFoeSinks(f).hurt(n),
          }));
      },
      // SD1: the two SPAWN arms - SoulBound's break release and the
      // Sanguine Rose's Daedroth. EC1 made them refuse underground
      // rather than stand a foe in the streaming world the player was
      // not in; SD1 gives them the door they were refusing for want
      // of, and DFU's placement law on the way through.
      //
      // Both go through _standLooseFoe, which is where the two callers
      // differ exactly as DFU has them differ: SoulBound passes
      // lineOfSightCheck FALSE (SoulBound.cs:100 - a released soul may
      // appear in front of you), the Sanguine Rose takes the default
      // TRUE and allied TRUE (SanguineRoseEffect.cs:56).
      spawnFoe: (mobileType) => { _standLooseFoe(mobileType, { lineOfSightCheck: false }); },
      spawnAlliedFoe: (mobileType) => { _standLooseFoe(mobileType, { allied: true }); },
      // V3: the artifact doors. messageBox is Azura's TEXT.RSC popup
      // (the infection host's flatten, at this consumer);
      // openCharacterSheet is the Oghma's sheet push; replaceFoe is
      // the Wabbajack's transform over the exterior pool - the old
      // foe leaves through removeFoe (a quest foe still in use is
      // left alone, QuestResourceBehaviour's own check) and the new
      // type spawns at its feet with the damage taken carried over.
      // spawnAlliedFoe is MOUNTED at MT-ii, where MobileTeams
      // targeting shipped: GameObjectHelper.CreateFoeSpawner(foeType,
      // spawnCount: 1, alliedToPlayer: true) is one foe into this
      // host's own encounter pool on team PlayerAlly, and getTargets'
      // ally arms then make it fight FOR the player. The spawn offset
      // is spawnFoe's own (DFU's FoeSpawner places by its own law -
      // the port's exterior pool has no free-placement caller).
      messageBox: (id) => {
        const lines = plainLines(townTalk.lines(id));
        if (lines?.length) townTalk.showOverlay(new ChoiceWindow({ lines }));
      },
      openCharacterSheet: () => townTalk.showOverlay(makeCharSheetWindow()),
      replaceFoe: (targetEntity, mobileType) => {
        const f = enchantFoes().find((x) => !x.dead && x.entity === targetEntity);
        if (!f) return;
        if (f.questBehaviour && !f.questBehaviour.isFoeDead) return;
        const feet = f.ai?.feet ? [...f.ai.feet] : enchantFeet();
        const missing = (targetEntity.maxHealth ?? 0) - (targetEntity.health ?? 0);
        exteriorFoes.removeFoe(f);
        exteriorFoes.spawnFoe(mobileType, feet).then((nf) => {
          if (!nf?.entity) return;
          nf.entity.wabbajackActive = true;   // once per creature (WabbajackEffect:68)
          nf.entity.health -= missing;        // carry over damage (:94)
        }).catch(() => {});
      },
      // R1: the AllowMagicRepairs seam goes LIVE - RepairsObjects'
      // enchanted-item skip and the break-consumption arm both read it
      get allowMagicRepairs() { return getBool('Controls', 'AllowMagicRepairs'); },
      // W1: the season seam goes LIVE - ExtraSpellPts' seasonal
      // conditions compare against its OWN param order (DuringWinter=0
      // ..DuringFall=3, ExtraSpellPts.cs:184-189), not the calendar
      // enum (Fall=0..Winter=3) - the map is the two ends swapped.
      season: () => {
        const s = seasonValue(dateFromClassicMinutes(worldMinutes()));
        return s === SEASONS.Winter ? 0 : s === SEASONS.Fall ? 3 : s;
      },
      // V2c: the moon arms, off V2a's lunar law. ExtraSpellPts'
      // IsFullMoon/IsHalfMoon/IsNewMoon (:133-154) each answer true
      // when EITHER moon shows the phase; half counts both the waxing
      // and waning half. Params 4/5/6 = Full/Half/New (:190-192).
      moonPhase: (param) => {
        const { masser, secunda } = lunarPhasesFromMinutes(worldMinutes());
        const either = (...phases) => phases.includes(masser) || phases.includes(secunda);
        if (param === 4) return either(LUNAR_PHASES.Full);
        if (param === 5) return either(LUNAR_PHASES.HalfWax, LUNAR_PHASES.HalfWane);
        if (param === 6) return either(LUNAR_PHASES.New);
        return false;
      },
    });
  }
  // AUDIT 24 (wave 32): the broker's foe subscribers - the watch and the encounter pool.
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
  const _foeSenses = () => sensesContext(playerEntity, playerTicker.classicMinutes, {
    movingLessThanHalfSpeed: player.movingLessThanHalfSpeed ?? true,
    // MT-ii: THE SHARED CANDIDATE LIST - DFU's
    // ActiveGameObjectDatabase.GetActiveEnemyBehaviours (EnemySenses
    // .cs:741-749), which is ONE database across every enemy in the
    // scene. This host owns BOTH exterior pools and already hands
    // them the same builder, so the join here is what lets a
    // spawned monster and a city watchman see each other at all.
    // Corpses and culled records leave it the same frame they die -
    // DFU's database yields only ACTIVE behaviours. Passing the
    // getter (not the array) keeps one live view per frame with no
    // pool importing the other.
    candidates: () => [...cityGuards.guards, ...exteriorFoes.foes].filter((f) => !f.dead),
    playerEntity,
  });
  // U32: ONE construction for the world inventory and spellbook - F6
  // and Backspace open them, and so do the character sheet's buttons.
  // G6: the `extra` bag is the CHOOSE-ONE seam (and whatever a
  // later service needs). One builder per host, still - the
  // service asks the host for its own window rather than
  // assembling a second one from a different dependency list.
  /** U53's ONE-BUILDER LAW, held: the three host-owned use hooks live
   *  HERE, once, and both readers take them - the inventory builder
   *  below and UI1's use-magic-item pick. UI1's first cut copied the
   *  bag and test/potions.test.js caught it (two drink hooks where the
   *  law says one). */
  const useHooks = {
    // U44: RecordLocationFromMap's reveal. DFU's own note key for the
    // map ITEM is `readMap`, the third caller of this one seam.
    revealMap: () => revealLocation('readMap'),
    drinkPotion: (key) => magic.drinkPotion(key),   // U44: DrinkPotion through the ONE cast engine
    // QuestMachine.GetQuest - the window's quest reach: the use-click
    // block (DaggerfallInventoryWindow.cs:1673) and ResolveItemLongName's
    // quest-letter arm (ItemHelper.cs:338) both go through it.
    getQuest: (uid) => questBridge?.machine.getQuest(uid) ?? null,
  };

  /** UI1: MagicItemPicker_OnItemPicked's two arms (:91-97) through the
   *  port's ONE use seam - systems/useItem.js, the same call the
   *  inventory's use mode makes, on the same hooks. */
  const useMagicItem = (item) => {
    const r = useItem(item, playerEntity.items ?? [], {
      ...useHooks,
      entity: playerEntity,
      localItems: playerEntity.items ?? [],
      spellCount: () => playerEntity.spells?.length ?? 0,
      isEnchanted,
      nowMinute: Math.floor(playerTicker.classicMinutes ?? 0),
    });
    if (r?.text) townTalk.say(r.text);
  };

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
    ...useHooks,   // U53: the one bag (revealMap, drinkPotion, getQuest)
    nowMinute: () => Math.floor(playerTicker.classicMinutes),
    onDrop: (items) => droppedLoot.dropPile(items, dropFeet(), `${playerTravelPixel().x},${playerTravelPixel().y}`),   // U8e: OnPop mints the world pile; P2: stamped with its map pixel
    ...extra,
  });
  // U42: the CLASSIC spellbook. PlayerEntity.GetSpells() is the
  // player's own array and the window WRITES to it (delete, swap,
  // sort, rename), so it is handed by reference - the save envelope
  // reads the same array and carries the new order.
  /** PlayerGPS.DiscoverRandomLocation over the CURRENT region, plus
   *  the notebook note its caller names. Three callers now: the two
   *  guild map reveals (G8) and U44's map ITEM, whose note key is
   *  DFU's own `readMap` (DaggerfallInventoryWindow.cs:1833-1834).
   *  Only this host has a region index to walk - the standalone town
   *  and dungeon pages legitimately answer nothing. */
  const revealLocation = (noteKey) => {
    const dfLoc = locationIndex.get(`${playerTravelPixel().x},${playerTravelPixel().y}`);
    const region = dfLoc ? maps.getRegion(dfLoc.regionIndex) : null;
    if (!region) return null;
    const rows = region.mapTable.map((row, i) => ({
      mapId: row.mapId, discovered: row.discovered,
      name: region.mapNames[i], regionName: region.name,
    }));
    const picked = discoverRandomLocation(rows);
    // ThievesGuild.cs:114-116 / DarkBrotherhood.cs:107-109 -
    // `GetLocalizedText(noteKey).Replace("%map", name)`, verbatim.
    if (picked) questBridge?.notebook?.addNote(REVEAL_NOTE_TEXT[noteKey]?.replace('%map', picked.name) ?? '');
    return picked?.name ?? null;
  };

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
    inventory: () => (inventoryDoorReady() ? makeInventoryWindow() : null),
    spellbook: makeSpellbookWindow,
    // Q4-v: the live machine's log walk and the player's notebook
    questMessages: () => questBridge?.machine.getAllQuestLogMessages() ?? [],
    notebook: () => questBridge?.notebook ?? null,
    // ...and the sheet's LOGBOOK button opens the same journal the HUD
    // key does, so it gets the same find-place seam (THE FOUR HOSTS).
    currentLocationName: () => _questLoc()?.name ?? '',
    canFindPlace: (regionName, name) => canFindPlace(maps, mapDict, regionName, name),
    gotoPlace: (place) => toggleTravelMap(place),
  });
  /** U43: the two journal doors (GameManager.cs:541-548), ONE window
   *  either way - LogBook opens it as it stands, NoteBook on the
   *  Notebook page (DaggerfallUI.cs:704-711). */
  const makeJournalWindow = (mode) => {
    preloadQuestJournalArt({ renderer, fetchBytes, palette });
    // PX24d: THROUGH THE DOOR. PX24 built ui/chronicleDoor.js and the
    // enhanced window behind it and then hung the door on nothing -
    // the seam had ZERO callers, so the chronicle was unreachable in
    // play and the Stats page's Chronicle button opened the CLASSIC
    // journal. This is the same shape spellbookDoor's callers use: the
    // host hands over what only it knows, and the door picks the skin.
    return createChronicleWindow({
      entity: playerEntity,
      // Which page the ENHANCED window opens on. The classic modes map
      // onto the two sections the chronicle actually holds: the
      // notebook is Notes, the message log is Messages. The two quest
      // modes have no page here on purpose - the pause window has
      // carried quests since PX4 - so they land on Notes, and the
      // CLASSIC window still gets the mode itself, below.
      section: mode === 'messages' ? 'messages' : 'notes',
      questMessages: () => questBridge?.machine.getAllQuestLogMessages() ?? [],
      notebook: () => questBridge?.notebook ?? null,
      mode,
      // HandleQuestClicks' three world questions (:439-466). This is the
      // host that owns the travel map, so this is the host that answers
      // them - the dungeon context and the standalone town page have no
      // map to be sent to and leave gotoPlace unset, which is the same
      // nothing a CanFindPlace miss produces.
      currentLocationName: () => _questLoc()?.name ?? '',
      canFindPlace: (regionName, name) => canFindPlace(maps, mapDict, regionName, name),
      gotoPlace: (place) => toggleTravelMap(place),
    });
  };
  /** S40: THE REST KEY, OUTDOORS. CanRest's FIRST arm - the one that
   *  makes camping in a city a crime - was unreachable until now,
   *  because rest existed only in the dungeon host. `place` answers
   *  the strict IsPlayerInTown and nothing else: outdoors there is no
   *  building, so the second arm cannot fire and the third (rest
   *  freely) is the wilderness.
   *
   *  IsPlayerInTown(true, true) itself gets ONE home below - the quest
   *  bridge's `isPlayerInTown` reads the same closure. It used to test
   *  `locationType <= 2`, which is City/Hamlet/Village and drops the
   *  four types PlayerGPS also counts (HomeFarms, HomeWealthy, the
   *  standalone Tavern and ReligionTemple), and it never tested
   *  `mustBeOutside` at all - so "in town" was true in a shop. */
  const _isPlayerInTownStrict = () => _musicInLocationRect()
    && isPlayerInTown(_musicLocationType(), {
      mustBeInLocationRect: true, mustBeOutside: true,
      inLocationRect: true, inside: (modes?.mode ?? 'exterior') !== 'exterior',
    });
  const outdoorRestDeps = createRestDeps(playerEntity, {
    // The MASTERY box (RaiseSkills :1390-1401): TEXT.RSC 4020 in a
    // click-anywhere box when a primary skill lands on 100. Same
    // overlay slot the rest window has just vacated.
    box: (rows) => townTalk.showOverlay(new ActionTextBox(rows)),
    // U48: the ENCOUNTER catch-up rides INSIDE the advance. This host
    // is the only one with a mobile foe pool to spawn into, and its
    // frame body returns at the overlay gate - so left to the frame, a
    // whole rested night's rolls fire in one burst the moment the
    // window closes, which is AUDIT 24 wave 30's finding about the
    // magic rounds, one system over.
    advanceMinutes: (n) => { playerTicker.advance(n); runEncounterTick(walkMode && playerSpawned ? player.pos : cam.pos); },
    // TickRest :379 - QuestMachine.Instance.Tick() rides the same
    // sub-tick as the clock, UNPACED (DFU calls the machine directly,
    // not through QuestMachine.Update's ticksPerSecond timer). This
    // host's ordinary quest tick is gated on "no overlay up", so
    // without this a rested night ran none at all.
    tickQuests: () => questBridge?.machine?.tick?.(),
    // AreEnemiesNearby's RESTING variant, over BOTH exterior pools -
    // the city watch counts, since guards on your trail wake you. The
    // first draft asked `activeCount() > 0`, copying this host's
    // exhaustion arm, and for REST that is a different rule rather
    // than a rough one: a guard spawned anywhere in town blocks sleep
    // FOREVER, because guards persist until the crime clears.
    enemiesNearby: () => areEnemiesNearby(
      [...cityGuards.guards, ...exteriorFoes.foes], { resting: true }),
    place: () => ({
      inTownOutside: _isPlayerInTownStrict(),
      inTownLocation: isPlayerInTown(_musicLocationType()),
      insideBuilding: false,
    }),
    // PlayerEntity.CrimeCommitted = Vagrancy + SpawnCityGuards(true),
    // on BOTH the refused and the confirmed path (:558-561). The
    // range covers the two crime lines AND the `return alreadyWarned`
    // they sit unconditionally above, because that return is what
    // makes "both paths" true - restSession's twin cites the pair
    // alone (:558-559) since its header carries the claim. The crime
    // is a STRING key here, the shape arrestFlow already reads.
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
    // CalculateHealthRecoveryRate's flags, live: outdoors, and day by
    // the clock - which is the ONE place RapidHealing InLight differs.
    day: () => !isNight(minuteNow()), inside: () => false,
  });
  const toggleRest = () => {
    if (townTalk.overlayActive) return;
    // THE OPEN GATE (DaggerfallUI.cs:651-687), which is scene-free -
    // this host had none of it, because rest was a dungeon feature.
    // Outdoors all three inputs are live: real foes, real water, and a
    // levitating or falling player who cannot lie down.
    // V2b: the vampire's own rest gate - CheckStartRest is LAST in
    // DFU's ladder and the override speaks for itself (TEXT.RSC 36)
    const rb = racialRestBlock(playerEntity, Math.floor(worldMinutes()));
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
        // V2b: the override's OWN refusal - the unfed vampire's box
        const lines = plainLines(townTalk.lines(rb.textId));
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
  const arrows = new ArrowFlight({ getGpuMesh, collider: () => collider });   // C13
  let playerSpawned = false;
  // F-slice: FAST TRAVEL. The window collects the popup's choices;
  // the LAWS live in systems/travel.js; arrival is
  // performFastTravel's order (DaggerfallTravelPopUp:324-385):
  // deduct, teleport, cautious restores, RaiseTime, the clamps. The
  // teleport is the streamer's OWN re-init (verbatim
  // ResetStreamingWorld) after tearing the built pixels down.
  // W1: the window reads the map through ContentReader's own
  // dictionary - one MapSummary per location, keyed by map pixel.
  const mapDict = buildMapDict(maps);
  let _travelMap = null;   // the live window, for the probe surface
  /** ItemCollection.Contains(ItemGroups.Transportation, template) -
   *  the same one-line test ui/nativeInventory.js's wagon gate uses. */
  const hasTransport = (template) => (playerEntity.items ?? []).some((it) => it.templateIndex === template);
  /** UI3: what GetPaperDollBackground asks of the world - the REGION
   *  at the player's map pixel, DFU's `GetPoliticIndex(x, y) - 128`
   *  (:214), and the reader's own count for the guard.
   *  A DECLARATION, not a const: the boot-time preload at the top of
   *  this function calls it, and a `const` there is the same temporal
   *  dead zone that took the site down on 2026-08-31. */
  function paperDollWhere() {
    const px = playerTravelPixel();
    return { region: maps.getPoliticIndex(px.x, px.y) - 128, regionCount: maps.regionCount };
  }

  /** A DECLARATION, not a const: paperDollWhere() reaches it from the
   *  boot-time preload above, and a `const` here is the temporal dead
   *  zone that took the site down on 2026-08-31. */
  function playerTravelPixel() {
    const wc = state.worldCoords(walkMode ? player.pos : cam.pos);
    return worldCoordToMapPixel(wc.x, wc.z);
  }
  /** TravelTimeCalculator.GetPlayerTravelPosition (:47-56) - PlayerGPS's
   *  live pixel unless the player is standing on their own ship, in
   *  which case every travel reckoning starts from where they BOARDED.
   *  Distinct from playerTravelPixel above, which is PlayerGPS itself
   *  and stays the live read its two dozen callers want.
   *
   *  A DECLARATION, not a const, for the same reason its neighbour
   *  gives: the dep bag below captures it by name. */
  function playerTravelOrigin() {
    return playerTravelPosition(playerEntity, playerEntity.boardShipPosition ?? null, playerTravelPixel());
  }
  /** FS1 (2026-08-28) - THE TILE UNDER THE PLAYER, which this host has
   *  wanted since the FS-slice: the footstep block's own comment says
   *  "the path/water tile arms ride the tile-under-player flag", and
   *  there was no flag to ride.
   *
   *  A terrain tile is 2 x WorldMapTileDim = 256 world units - the same
   *  step locationWorldRect walks when it shifts a pixel corner by the
   *  location's tile origin (streamingWorld.js:60-61). Tile ROWS rise
   *  with z, which is why row 127 is north and row 0 south, derived
   *  from generateTileData.
   *
   *  Answers null off the built world - a pixel still streaming has no
   *  tilemap, and a caller must read that as "no information" rather
   *  than as any particular tile. */
  const TERRAIN_TILE_WORLD = 2 * TERRAIN_TILE_DIM;
  const playerGroundTile = () => {
    const wc = state.worldCoords(walkMode ? player.pos : cam.pos);
    const p = worldCoordToMapPixel(wc.x, wc.z);
    const built_ = built.get(`${p.x},${p.y}`);
    if (!built_?.tilemap) return null;
    const origin = mapPixelToWorldCoords(p.x, p.y);
    const tx = Math.floor((wc.x - origin.x) / TERRAIN_TILE_WORLD);
    const ty = Math.floor((wc.z - origin.z) / TERRAIN_TILE_WORLD);
    if (tx < 0 || ty < 0 || tx >= TERRAIN_TILE_DIM || ty >= TERRAIN_TILE_DIM) return null;
    return built_.tilemap[tx + ty * TERRAIN_TILE_DIM];
  };
  const footsteps = new FootstepMachine();   // FS-slice
  /** ROAD-B (b3): PlayerMotor.Update's three exterior surface reads,
   *  run together the way DFU runs them (:367-369) - one downward
   *  raycast from the controller centre plus one PlayerTileMapIndex.
   *
   *  The raycast is what stops a ship, a bridge or a levitating player
   *  from swimming while merely ABOVE water (:501-503), and the port's
   *  two surfaces map onto Unity's two straight across: the terrain is
   *  this host's `heightAt` floor (DaggerfallTerrain, no triangles),
   *  and every building and model is a collider mesh bucket (the
   *  StaticGeometry tag, GameObjectHelper.cs:430-435).
   *
   *  playerGroundTile above is the tilemap half and already carries
   *  the floating origin; it answers null off a built pixel, which
   *  playerTileMapIndex reads as DFU's -1. */
  const _SURFACE_DOWN = [0, -1, 0];
  const exteriorSurfaceNow = () => {
    const cy = player.pos[1] + player.height / 2;   // transform.position on a CharacterController
    const rayDistance = rayDistanceFor(isOnFoot(player.transportMode));
    return exteriorSurfaces({
      inside: false,
      rawTile: playerGroundTile(),
      waterWalking: !!player.waterWalking,   // PlayerEntity.IsWaterWalking (:590)
      probe: downProbe({
        centreY: cy,
        terrainY: heightAt(player.pos[0], player.pos[2]),
        meshDist: collider.raycast([player.pos[0], cy, player.pos[2]], _SURFACE_DOWN, rayDistance * 2),
        rayDistance,
      }),
    });
  };
  /** The teleport core fast travel and the quickload share: destroy
   *  every built pixel, re-origin the streamer (its own verbatim
   *  ResetStreamingWorld), build the destination pixel, and land the
   *  player - at the pixel centre, or at an exact local position. */
  async function _teleportToPixel(px, py, localPos = null, { grounded = false, arriveMinutes = null } = {}) {
    // CameraRecoiler's StreamingWorld_OnInitWorld (:178-183): "player
    // can be moved by one system or another with swaying active" -
    // the sway does not ride a fast travel, a teleport or a load's
    // landing to the new place.
    cameraRecoiler.reset();
    // A1: a fast travel is where the calendar jumps WEEKS - straighten
    // the season BEFORE the destination pixel builds, or the arrival
    // is skinned for the month the player left and the frame loop
    // rebuilds it a moment later. ROAD-Ar (R1): off the ARRIVAL clock,
    // which the caller passes - performFastTravel raises time AFTER
    // TeleportToCoordinates (:333, :344) and the port keeps that order,
    // so the one clock still reads the departure date here and reading
    // it straightened nothing. No re-skin sweep either way: the
    // teardown below is a real unload (CollectLooseObjects and all).
    refreshSeason(arriveMinutes ?? worldMinutes());
    _reskinPending = false;   // ...and the frame's own re-skin has nothing left to re-skin
    _seasonHoldKey = null;    // ...nor a held motor: the spawn below re-anchors it anyway
    _wasInLocationRect = false;   // F062: ResetState (:398-401) - no exit event on arrival
    // AUDIT 39: CleanupUntrackedObjects (StreamingWorld.cs:1620-1644,
    // on SaveLoadManager_OnStartLoad) - "remove loose enemies,
    // missiles, etc. on load or new game" - and the same sweep a
    // teleport reaches through ClearStreamingWorld (:993-998). The
    // destroyPixel loop below is NOT it: its pool hook is
    // collectPixel, which frees corpse batches and clears corpse
    // flags and never touches the live records, so a quickload
    // mid-fight left the fight standing and restoreWorld spawned the
    // save's copies on top of it. The distance cull spares anything
    // that has detected you, so nothing else was going to.
    exteriorFoes.clearLive();
    cityGuards.clearLive();
    magic.clearMissiles();
    arrows.arrows.length = 0;   // the flights own no GL objects - the mesh is the host's cache
    for (const key of [...built.keys()]) {
      const [bx, by] = key.split(',').map(Number);
      destroyPixel(bx, by);
      state.release(bx, by);
    }
    queue.length = 0;
    queue.push(...state.init(px, py));
    const first = queue.shift();
    const dest = await buildPixel(first.px, first.py);
    // PositionPlayerToLocation ends in FixStanding (StreamingWorld
    // :1597-1608): the arrival is snapped to what is under it, not
    // dropped from 2u up. The pixel is built by now, so the collider
    // has its terrain and its blocks; nothing beneath leaves the +2
    // (and gravity) as the fallback it always was.
    const raw = localPos ?? [TERRAIN_SIZE / 2, dest.centerHeight + state.compensation[1] + 2, TERRAIN_SIZE / 2];
    // `grounded` is StreamingWorld.RepositionPlayer's own last argument
    // (:1587, :1592), which the location-entrance arm passes TRUE for
    // every location but HomeYourShips: the entrance point is computed
    // on the location's flat origin plane and FixStanding drops it onto
    // whatever the terrain actually is. A localPos WITHOUT it stands
    // exactly where it was told (the ship's remembered deck).
    const pos = walkMode && (!localPos || grounded) ? floorLanding(collider, raw) : raw;
    if (walkMode) { player.spawn(pos[0], pos[1], pos[2]); playerSpawned = true; }
    cam.pos = [pos[0], pos[1] + (walkMode ? 0 : 40), pos[2]];
    // Q4-v: StreamingWorld.OnInitWorld - the world re-initialised at a
    // new origin (fast travel, quickload); CreateFoe's pending waves
    // invalidate across live AND scheduled quests.
    questBridge?.onInitWorld();

    // TK-v: TalkManager's OnMapPixelChanged / OnLoadEvent (:3593-3597,
    // :3616-3620) - a new world origin means a new building list and a
    // stale topic list
    npcSession.onWorldChanged();
  }

  /**
   * DaggerfallCourtWindow.PositionPlayerAtLocationEntrance (:452-463) -
   * where the court puts you down.
   *
   *     DFPosition mapPixel = PlayerGPS.CurrentMapPixel;
   *     if (ContentReader.HasLocation(mapPixel.X, mapPixel.Y, out _))
   *         StreamingWorld.TeleportToCoordinates(x, y, RandomStartMarker);
   *
   * Three things are load-bearing and all three were missing. The
   * HasLocation guard: arrested in the wilderness (a guard chased you
   * out of the rect), the release moves you nowhere at all rather than
   * dumping you at a terrain origin. The TELEPORT, to the SAME pixel:
   * DFU re-initialises the world around you, which is this host's
   * _teleportToPixel - the guards, the missiles and the loose foes go
   * with it. And RandomStartMarker, which is StreamingWorld's
   * PositionPlayerToLocation (world/locationEntrance.js): a random side
   * of the town's rectangle, facing in, snapped to the nearest start
   * marker for a city.
   *
   * The markers are the location's own archive-199 record-10 editor
   * flats - the same flats buildPixel already collects for the exterior
   * NPCs - read in the LOCATION frame and handed the law with the
   * location origin, so the arithmetic below is entirely DFU's.
   */
  function positionPlayerAtLocationEntrance() {
    const px = playerTravelPixel();
    const key = `${px.x},${px.y}`;
    const dfLoc = locationIndex.get(key);
    if (!dfLoc?.exterior?.exteriorData) return;   // HasLocation false - DFU teleports nowhere
    const b = built.get(key);
    const tilePos = getLocationTerrainTileOrigin(dfLoc);
    // The location origin DFU builds at :1452-1453: the tile origin in
    // world units, y = 2.0f * MeshReader.GlobalScale. buildPixel's
    // locOrigin is that same vector with the pixel's own average height
    // already in it, so it is preferred when the pixel is standing.
    const origin = b?.locOrigin
      ? [b.locOrigin[0], b.locOrigin[1], b.locOrigin[2]]
      : [tilePos.x * tileSide, 2.0 * 0.025, tilePos.y * tileSide];
    const opts = entranceOptionsForLocationType(dfLoc.mapTableData?.locationType ?? 0);
    const markers = b?.locBlocks
      ? locationStartMarkers(b.locBlocks.map((bl) => ({
        originX: bl.originX, originZ: bl.originZ, flats: collectBlockFlats(bl.dfBlock, 0),
      })))
      : [];
    const at = positionPlayerToLocation({
      mapWidth: dfLoc.exterior.exteriorData.width,
      mapHeight: dfLoc.exterior.exteriorData.height,
      origin, startMarkers: markers, useNearestStartMarker: opts.useNearestStartMarker,
    });
    // The pixel is re-origined by the teleport, so the location frame
    // above IS the destination pixel's local frame; only the vertical
    // compensation the streamer carries has to be added back.
    const local = [at.pos[0], at.pos[1] + state.compensation[1] + 2, at.pos[2]];
    _teleportToPixel(px.x, px.y, local, { grounded: opts.grounded })
      .then(() => { cam.yaw = at.yaw; })
      .catch((e) => console.error('[court] reposition failed:', e));
  }

  /**
   * G5 - TeleportAway (DaggerfallTeleportPopUp.cs:134-150). The
   * arrival WITHOUT the journey: no gold, no clock advance, no
   * arrival clamp, no cautious heal, no encounter bookkeeping - the
   * three things fastTravelTo does around this same call are exactly
   * what teleporting skips.
   *
   * What it keeps is the two calls DFU makes. TransitionExterior
   * FIRST when the player is inside (:140-141) - you cannot teleport
   * out of a building - and then TeleportToCoordinates, which raises
   * OnInitWorld, whose weather half applies the destination climate's
   * ARRAY slot. That is the same handler fast travel's arrival runs,
   * so the destination's weather lands the same way; what does NOT
   * run is tickWeather, because no time passed to tick.
   */
  let _teleporting = false;
  /** A10 - THE EXTERIOR SCENE, cached and restored by name.
   *
   *  SaveLoadManager.CacheScene(StreamingWorld.SceneName) and its
   *  partner RestoreCachedScene: the pair the ship arm wraps its
   *  teleport in (TransportManager.cs:382-398) and the pair the
   *  Teleport effect takes on the outside arms of its own
   *  cross-context flow (Teleport.cs:147, :250). One definition, so
   *  the two callers cannot key the same scene two different ways.
   *
   *  The port's exterior scene state is the loose piles, carried as
   *  DFU carries them - LootContainerData_v1 entries stamped
   *  LootContainerTypes.DroppedLoot (:558-566) - in NATIVE
   *  coordinates, because a pile that came back in local ones would
   *  land wherever the floating origin happened to be. Without the
   *  pair, _teleportToPixel's teardown takes every pile with the
   *  pixel and only a save could bring one back. */
  const _sceneCache = () => (playerEntity.sceneCache ??= createSceneCache());
  function cacheExteriorScene(pixel) {
    cacheScene(_sceneCache(), worldSceneName(pixel.x, pixel.y), {
      lootContainers: droppedLoot.snapshotWorld((pos) => state.worldCoords(pos))
        .map((sp) => ({ ...sp, containerType: LOOT_CONTAINER_TYPES.DroppedLoot, y: sp.y - state.compensation[1] })),
    });
  }
  /** A scene never cached answers null and the arrival stands as the
   *  streamer built it - which is every first visit. */
  function restoreExteriorScene(pixel) {
    const arrived = restoreCachedScene(_sceneCache(), worldSceneName(pixel.x, pixel.y));
    if (!arrived) return false;
    droppedLoot.restoreWorld(arrived.lootContainers,
      (nx, nz) => state.localFromWorld(nx, nz), state.compensation[1]);
    return true;
  }
  /** TR4: TransportManager's ship arm (:360-402). The decision is
   *  systems/ship.js; this is the host half - the teleport, the
   *  remembered position, and the fade DFU smashes to black. */
  async function boardOrDisembark() {
    const here = playerTravelPixel();
    const t = shipTransition(playerEntity, {
      boardShipPosition: playerEntity.boardShipPosition ?? null,
      mapPixel: here,
      position: { mapPixel: here, pos: [...player.pos], yaw: cam.yaw },
    });
    if (!t) return;
    // TR-AUDIT F-F1: READ the reposition rather than infer it from
    // `restore`. StreamingWorld's RandomStartMarker is
    // PositionPlayerToLocation, which puts you at a random SIDE of the
    // location at that pixel and FALLS BACK TO THE TERRAIN ORIGIN when
    // the pixel has none (:1437-1447). The ship coords are open sea, so
    // the fallback is the arm that runs and the port's own default
    // landing stands in for it - FLAGGED for the first session with
    // ARENA2: confirm map pixels (2,2) and (5,5) carry no location.
    const localPos = t.reposition === REPOSITION.None ? t.restore.pos : null;
    // A10 - THE SCENE CACHE ROUND THE TELEPORT (:382-388, :393-398).
    // BOTH arms of the ship do the same three things in the same
    // order: CacheScene(world.SceneName) with SceneName still naming
    // the pixel you are LEAVING, the teleport, then
    // RestoreCachedScene(world.SceneName) with SceneName now naming
    // the pixel you have ARRIVED at. DFU's own comment says why the
    // pair is safe here - "ship is special case, cache will not be
    // cleared" - and the port already carries that half at the
    // map-pixel seam below (the to/from-ship exception on
    // clearSceneCache).
    //
    // Without it the port DECIDED but never CACHED: _teleportToPixel
    // destroys every built pixel and collectPixel takes the loose
    // piles with it, so a chest dropped on the dock was gone the
    // moment you boarded and gone again when you came back. The pair
    // makes the two pixels a hand-off - the departure's piles wait in
    // the cache until the return, and the ship's own deck likewise.
    //
    // The port's exterior scene state is the loose piles, carried as
    // DFU carries them: LootContainerData_v1 entries with
    // LootContainerTypes.DroppedLoot (:558-566). NATIVE coordinates,
    // because a pile that came back in local ones would land wherever
    // the floating origin happened to be.
    cacheExteriorScene(here);
    await _teleportToPixel(t.go.x, t.go.y, localPos);
    restoreExteriorScene(t.go);
    if (t.restore) cam.yaw = t.restore.yaw;
    playerEntity.boardShipPosition = t.boardShipPosition;
    setTransportModeHere(t.mode);
  }

  // ---- A10 - THE RECALL ANCHOR, ACROSS CONTEXTS.
  //
  // Teleport.cs whole. The TP slice shipped the prompt, the anchor on
  // the entity and the consume, and refused anything the player set
  // anywhere but outdoors with a line saying cross-host recall
  // pended. That refusal was most of the spell: Recall exists to
  // bookmark the room you cleared out and come back to it.
  //
  // The law is systems/teleportAnchor.js - the anchor's shape,
  // IsSameInterior, and the plan. This is the HOST half, and it is
  // the only place in the port that can do it: every arm of the plan
  // is a door this host already owns (the mode teardown, the pixel
  // teleport, the interior re-entry the quickload uses, the dungeon
  // mount the quest respawner uses), and none of them exist in the
  // mounted modes.
  /** SetAnchor (:100-117): the outer host's world half, the mounted
   *  mode's inside half, one record. */
  function setRecallAnchor() {
    const inside = modes?.anchorContext?.() ?? { worldContext: WORLD_CONTEXT.Exterior, local: null, buildingKey: 0, interior: null };
    const pf = walkMode && playerSpawned ? player.pos : cam.pos;
    // A DUNGEON's local frame is its own, so its world coordinates
    // come from the streamer's pixel rather than the player's feet -
    // "only one dungeon per map pixel allowed" (:211) makes the pixel
    // the whole identity. Outside and inside a BUILDING the frame is
    // the exterior's (P8's unified frame), so the feet answer.
    const inDungeon = inside.worldContext === WORLD_CONTEXT.Dungeon;
    const wc = inDungeon ? null : state.worldCoords(pf);
    const pixel = inDungeon ? { x: state.current.x, y: state.current.y } : playerTravelPixel();
    const corner = mapPixelToWorldCoords(pixel.x, pixel.y);
    playerEntity.anchorPosition = makeAnchor({
      worldContext: inside.worldContext,
      pixel,
      nativeX: wc ? wc.x : corner.x,
      nativeZ: wc ? wc.z : corner.z,
      // ROAD-Ar (R2): the height goes in COMPENSATION-FREE, and
      // anchorLanding re-adds the live compensation on the way out.
      // That encoding IS this port's RestoreWorldCompensationHeight
      // (:137-143): DFU stores the raw Unity height and must put the
      // streaming world back to the offset it was measured against
      // before InitWorld, while an anchor stated in the compensation-
      // free frame survives any recenter between the set and the cast.
      // So there is no restore call here and no compensation on the
      // anchor - see makeAnchor's note, which is where the law lives.
      y: pf[1] - state.compensation[1],
      local: inside.local,
      yaw: cam.yaw, pitch: cam.pitch,
      buildingKey: inside.buildingKey,
      interior: inside.interior,
    });
  }

  /** RestorePosition's landing, in the frame the arrival speaks.
   *
   *  A DUNGEON anchor's `local` IS the landing: a dungeon's frame is
   *  its own, built at the same origin every mount, so the transform
   *  written at anchor time is still valid at recall time.
   *
   *  EVERYTHING ELSE - outside and inside a building alike, because
   *  P8's unified frame makes an interior position a plain world
   *  position - lands off the NATIVE coordinates through the arrival
   *  origin, which is the quickload's own law and the only shape that
   *  survives a floating-origin recenter between the anchor and the
   *  cast. */
  const anchorLanding = (a) => {
    if (a.insideDungeon && a.local) return [...a.local];
    const [lx, lz] = state.localFromWorld(a.nativeX, a.nativeZ);
    return [lx, (a.y ?? 2) + state.compensation[1], lz];
  };

  let _recalling = false;
  /** TeleportPlayer (:119-164) + the respawner's tail (:228-256). */
  async function recallToAnchor() {
    if (_recalling) return;
    const anchor = playerEntity.anchorPosition;
    const plan = teleportPlan(anchor, {
      ...(modes?.insideContext?.() ?? { insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
      pixel: playerTravelPixel(),
    });
    // "Anchor must be set" - the 4001 box (:268-275). The cast is
    // spent either way; DFU refunds nothing.
    if (!plan) { townTalk.say('You must set an anchor first.'); return; }
    _recalling = true;
    try {
      if (plan.kind === 'same-interior') {
        // ":129-134 - Just need to move player." Nothing is torn down
        // and nothing is loaded: the room you are standing in IS the
        // anchor's room.
        modes?.setPlayerLocalPosition?.(anchorLanding(anchor));
        cam.yaw = plan.yaw; cam.pitch = plan.pitch;
        playerEntity.playerTeleportedIntoDungeon = plan.teleportedIntoDungeon;   // :216, the dungeon arm alone
        playerEntity.anchorPosition = null;   // consumed on arrival, both DFU arms (:133)
        surfacePlayer();
        return;
      }
      // "Cache scene before departing" (:145-151), the three-way arm.
      // Outside: the streaming scene by name. Inside a building:
      // the interior, which forceExitToExterior's own cacheScene arm
      // writes (PlayerEnterExit.cs:860, the same write the real door
      // makes). Inside a dungeon: NOTHING, because DFU takes
      // TransitionDungeonExteriorImmediate there and dungeons are not
      // scene-cached at all.
      if (plan.cacheScene === 'exterior') cacheExteriorScene(playerTravelPixel());
      if ((modes?.mode ?? 'exterior') !== 'exterior') {
        modes?.forceExitToExterior({ cacheScene: plan.cacheScene === 'building' });
      }
      const a = plan.anchor;
      await _teleportToPixel(a.pixel.x, a.pixel.y);
      // RestorePositionHelper's three arms (PlayerEnterExit.cs
      // :622-655), in its own order: dungeon first, then building
      // with doors, then outside.
      let landed = false;
      if (plan.arrive === 'dungeon') {
        // The dungeon mount - StartDungeonInterior through the ONE
        // door the quest respawner uses (:626-630 RespawnPlayer with
        // insideDungeon true). The anchor's local transform lands
        // after it, which is the respawner's RestorePosition (:242).
        landed = !!(await modes?.startInDungeon?.());
        if (landed) {
          // `landed` implies modes existed, but the wave-37 law is the
          // GUARD ON THE OBJECT above its declaration - hold the shape.
          modes?.setPlayerLocalPosition(anchorLanding(a));
        } else {
          // No entrance at the anchor's pixel: DFU's "all else fails"
          // exterior landing (:645-655), the same fallback the quest
          // respawner takes.
          townTalk.say('The way underground is closed. Repositioning player.');
        }
      } else if (plan.arrive === 'building') {
        // ":632-643 - Start in building", off the anchor's own
        // exteriorDoors, through the identical seam the quickload
        // re-entry uses. A door that cannot be found is DFU's
        // reposition arm (:615-620) - say the line and keep the
        // teleport's landing, never the inside position on the
        // outside collider.
        landed = !!(await modes?.restoreInterior?.(a.interior, anchorLanding(a)));
        if (!landed) townTalk.say('Building has no exterior doors. Repositioning player.');
      }
      if (landed) {
        cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      } else if (plan.arrive !== 'dungeon') {
        // The exterior landing: the anchor's native coordinates back
        // through the arrival origin, the quickload's own shape.
        const [lx, ly, lz] = anchorLanding(a);
        if (walkMode) { player.spawn(lx, ly, lz); playerSpawned = true; }
        cam.pos = [lx, ly + (walkMode ? 0 : 40), lz];
      }
      // A dungeon anchor whose entrance could not be found keeps
      // _teleportToPixel's own landing: its stored height is in the
      // DUNGEON's frame and means nothing on the terrain, so writing
      // it here would drop the player through the world. DFU's
      // "all else fails" arm respawns at the world coordinates and
      // FixStanding snaps it; the pixel teleport already did both.
      // "Restore final position and unwire event" (:242) - the pose
      // rides the transform, exactly as RestorePosition sets it.
      cam.yaw = a.yaw ?? cam.yaw; cam.pitch = a.pitch ?? cam.pitch;
      // ":246 - Set 'teleported into dungeon' flag when anchor is
      // inside a dungeon." The flag lives on the entity beside the
      // anchor; its save-envelope field is the import lane's.
      playerEntity.playerTeleportedIntoDungeon = plan.teleportedIntoDungeon;
      // "Restore scene cache on arrival" (:248-252). The condition is
      // the LANDING, not the anchor - `if
      // (!playerEnterExit.IsPlayerInside)` - so a building or dungeon
      // arm that repositioned outside restores the exterior scene
      // too, which is right: that is where the player ended up. That
      // is also why teleportPlan carries no field for it; only this
      // side knows. The building arm needs nothing here anyway:
      // restoreInterior runs RestoreCachedScene itself, at the moment
      // the building's key is known (PlayerEnterExit.cs:804).
      if (!landed) restoreExteriorScene(a.pixel);
      playerEntity.anchorPosition = null;   // consumed on arrival, both DFU arms
      surfacePlayer();
    } finally {
      _recalling = false;
    }
  }

  /** PromptPlayer (:81-98): the 4000 anchor/teleport box, with
   *  AllowCancel - DFU's own QoL, and its own comment says the cast
   *  is not refunded. Every host routes its Recall arrival here. */
  function teleportPrompt() {
    townTalk.showOverlay(new ChoiceWindow({
      lines: ['Teleport, or set anchor?'],   // key teleportOrSetAnchor (4000), prose ours
      options: [
        { code: 'KeyA', label: 'A - set anchor', action: () => setRecallAnchor() },
        { code: 'KeyT', label: 'T - teleport', action: () => { recallToAnchor(); } },
        { code: 'Escape', label: 'Esc - cancel', action: () => {} },
      ],
    }));
  }

  async function teleportTo(pick) {
    if (_teleporting) return;
    _teleporting = true;
    try {
      modes?.forceExitToExterior();
      await _teleportToPixel(pick.pixel.x, pick.pixel.y);
      if (!weatherOverride) {
        applyClimateWeather(maps.getClimateIndex(pick.pixel.x, pick.pixel.y));
        if (currentWeather() !== weather) applyWeather(currentWeather());
      }
      surfacePlayer();
      townTalk.say(`You arrive at ${pick.name}.`);
    } finally {
      _teleporting = false;
    }
  }

  // ---- B3 (AUDIT 25 blocker 3): THE RESPAWN PRIMITIVE.
  // PlayerEnterExit.RespawnPlayer + its Respawner coroutine
  // (:430-556): destroy whatever context the player stands in, move
  // the world to the target coordinates, and re-enter as exterior or
  // dungeon. The port's halves all existed - forceExitToExterior,
  // _teleportToPixel, startInDungeon - and nothing composed them, so
  // every TeleportPc idled forever on its declared-pending seam.
  // BT1 (2026-08-27) RETIRED THE BUILDING FLAG by reading the caller:
  // DFU's TeleportPc is a PARTIAL implementation by its own header
  // ("Does not exactly emulate classic for 'transfer pc inside'...")
  // and hardcodes RespawnPlayer(x, y, insideDungeon: TRUE) for EVERY
  // place (TeleportPc.cs:113-118) - there is no building arm in DFU to
  // port, so the refusal that idled the action forever was the
  // divergence, not the missing feature. The composer attempts the
  // dungeon UNCONDITIONALLY; dungeon-less locations fall through to
  // the exterior landing, C#'s own "all else fails" arm (:561-565),
  // and a building-site teleport takes the same path, marker math and
  // all - the C#'s dungeon-space landing for a non-dungeon marker is
  // the recorded wart. The shipped corpus never reaches it: every
  // `teleport pc to` targets a dungeon place and `transfer pc inside`
  // is S0000016's story dungeon alone.
  let _respawning = false;
  async function _respawnAtSite(loc) {
    modes?.forceExitToExterior();
    const px = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    await _teleportToPixel(px.x, px.y);
    // W1 review: PlayerEnterExit_OnRespawnerComplete (WeatherManager
    // .cs:514-522) belongs to the RESPAWNER alone - quest teleports
    // and respawns, not fast travel (OnInitWorld's array slot) and
    // not quickload (the restored weather stands).
    if (!weatherOverride && weatherRespawn(Math.floor(playerTicker.classicMinutes), maps.getClimateIndex(px.x, px.y))) {
      applyWeather(currentWeather());
    }
    // insideDungeon TRUE always (TeleportPc.cs:116) - never a site-type
    // dispatch; the entrance failing IS the exterior fallback.
    const entered = await modes?.startInDungeon();
    if (!entered) console.warn('[quest] respawn: no dungeon entrance at site - exterior landing (the C# fallback arm)');
    surfacePlayer();
  }
  let _traveling = false;
  // V2e: DeployFullBlownVampirism's cemetery transfer (:164-175) -
  // GetRandomCemetery over the CURRENT region's mapTable, then the
  // same pixel arrival fast travel takes (_teleportToPixel re-inits
  // the streamer; _lastEncMinutes is the PreventEnemySpawns parity -
  // "intentionally not spawning enemies, for this time the PLAYER is
  // the monster"). RECORDED DIVERGENCE: DFU's RespawnPlayer lands the
  // player INSIDE the cemetery crypt (insideDungeon true); the port
  // has no door-less dungeon entry yet, so the vampire wakes at the
  // cemetery's exterior, its crypt door in front of them. Off the
  // tick's frame like the videos; interior/dungeon modes skip loudly
  // (DFU tears the interior down in RespawnPlayer - host work).
  function transferToCemeteryArm() {
    if ((modes?.mode ?? 'exterior') !== 'exterior') {
      console.warn('[infection] the cemetery transfer needs the exterior mode - the vampire wakes where they fell');
      return;
    }
    const mapTable = maps.getRegion(_questRegionIndex())?.mapTable ?? [];
    const idx = randomCemeteryLocationIndex(mapTable);
    if (idx == null) {
      console.warn('[infection] no cemetery in this region - the transfer is skipped (DFU throws here)');
      return;
    }
    const pos = longitudeLatitudeToMapPixel(mapTable[idx].longitude, mapTable[idx].latitude);
    Promise.resolve().then(async () => {
      await _teleportToPixel(pos.x, pos.y);
      _lastEncMinutes = Math.floor(playerTicker.classicMinutes);
    });
  }

  async function fastTravelTo(pick, opts, computed) {
    if (_traveling) return;
    _traveling = true;
    try {
      // DeductFastTravelGold (:469-473): the inn nights come out of
      // COIN, and only what is left may be paid with a letter of
      // credit - "Taverns only accept gold pieces".
      deductGoldPieces(playerEntity, computed.piecesCost ?? 0);
      deductGold(playerEntity, computed.totalCost - (computed.piecesCost ?? 0));
      // ROAD-Ar (R1): the ARRIVAL minute rides the teleport. RaiseTime
      // is below, exactly where performFastTravel puts it (:344, after
      // TeleportToCoordinates at :333) - so the core is handed the
      // minute the clock is about to reach and straightens the season
      // from THAT, instead of skinning the destination for the month
      // the player left and having the next frame's tickSeason tear
      // the whole just-built grid down again.
      await _teleportToPixel(pick.pixel.x, pick.pixel.y, null,
        { arriveMinutes: worldMinutes() + computed.minutes });
      // cautious arrival heals in full; magicka honors NoRegenSpellPoints
      if (opts.speedCautious) {
        playerEntity.health = playerEntity.maxHealth;
        playerEntity.fatigue = maxFatigue(playerEntity);
        if (!hasSpecialAbility(playerEntity.career, SPECIAL_ABILITY.NoRegenSpellPoints)) {
          playerEntity.magicka = playerEntity.maxMagicka;
        }
      }
      // RaiseTime through the ONE clock: the U24 advance runs the same
      // tick, so magic rounds and disease days catch up inside the jump.
      playerTicker.advance(computed.minutes);
      // W1 review: DFU fast travel never fires the respawner's direct
      // re-roll - TeleportToCoordinates raises OnInitWorld, whose
      // weather half applies the destination climate's ARRAY slot
      // (WeatherManager.cs:524-543). Applied after the clock advance
      // so a date-crossing trip lands on the ARRIVAL day's array: the
      // advance above runs the tick, whose day block (S41) re-rolls
      // the zones and raises updateWeatherFromClimateArray, and the
      // tickWeather here is the drain that applies it.
      if (!weatherOverride) {
        tickWeather(Math.floor(playerTicker.classicMinutes), maps.getClimateIndex(pick.pixel.x, pick.pixel.y));
        applyClimateWeather(maps.getClimateIndex(pick.pixel.x, pick.pixel.y));
        if (currentWeather() !== weather) applyWeather(currentWeather());
      }
      const clamp = arrivalClampMinutes(playerTicker.classicMinutes, {
        speedCautious: opts.speedCautious,
        // V2b: the vampirism arc LANDED - a sun-damaged racial
        // override arrives at dusk, never in daylight (the law has
        // supported this parameter since the F-slice; only the wiring
        // waited). Career DamageFromSunlight still rides its own arc.
        sunAverse: !!playerEntity.racialOverride?.sunDamage,
      });
      if (clamp > 0) playerTicker.advance(clamp);
      _lastEncMinutes = Math.floor(playerTicker.classicMinutes);   // X-slice: PreventEnemySpawns parity - no spawn catch-up for the traveled window
      // TP1 - performFastTravel's tail (:380): RaiseSkills fires AFTER
      // the arrival clamp, so a trip that lands at 7:10am raises
      // against the arrival minute rather than the departure one. It
      // is the same one home the rest window's close calls, because
      // DFU calls the same PlayerEntity.RaiseSkills at both.
      raisePlayerSkills(playerEntity, {
        say: (m) => townTalk.say(m),
        // The MASTERY box (RaiseSkills :1390-1401): TEXT.RSC 4020 and
        // the Arena fanfare when a primary skill lands on 100 - the
        // arrival raise owes it exactly as the rest-end raise does.
        lines: (id) => townTalk.lines(id),
        box: (rows) => townTalk.showOverlay(new ActionTextBox(rows)),
        onLevelUp: () => townTalk.showOverlay(makeCharSheetWindow()),
      });
      townTalk.say(`You arrive at ${pick.name}.`);
    } finally {
      _traveling = false;
    }
  }
  // P-slice: the ABOVE-GROUND QUICKSAVE (F9/F11, the dungeon's
  // bindings). The envelope is the dungeon's snapshotPlayer - entity,
  // items, spells, conditions, faction rep, the T4 discovery store -
  // plus this host's world half: the map pixel and the NATIVE world
  // coordinates (stable across every floating-origin recenter) with
  // the compensation-free height. One classic slot, shared with the
  // dungeon key: loading a save from the other side restores the
  // CHARACTER and says so (cross-side travel-on-load pends with the
  // dungeon's own note).
  /** Save(name, saveName) over the host's own envelope; F9 is the
   *  QuickSave name (QuickSave() = Save(Name, quickSaveName)) and the
   *  slot window's saveAs passes the typed one. */
  function worldQuickSave(saveName = QUICK_SAVE_NAME) {
    const pf = walkMode && playerSpawned ? player.pos : cam.pos;
    const wc = state.worldCoords(pf);
    // IS1 (AUDIT 26 F221): the inside-building half (SerializablePlayer
    // .cs:183-187) - resolved FIRST, because interiorSaveData writes
    // the live scene into the entity's P1 cache and snapshotPlayer is
    // about to read it. Null anywhere but interior mode. The world arm
    // below stays valid either way: the exterior pixel stands under
    // the building with its pools alive, and P8's unified frame makes
    // the inside position a plain world position.
    const interior = modes?.interiorSaveData?.() ?? null;
    const snap = snapshotPlayer(playerEntity, {
      interior,
      classicMinutes: Math.floor(playerTicker.classicMinutes),
      readiedSpellIndex: magic.readiedIndex(),
      // B4: quest (Q4-v: machine + notebook + one-time list) and talk
      // (SaveDataConversation WHOLE, :368-375: the mill + questor-post
      // dict (TK-i), dictQuestInfo (TK-ii), npcsWithWork +
      // castleNPCsSpokenTo (TK-iv)) through the ONE composer both
      // hosts call - two inline copies of this envelope is exactly
      // how the dungeon half drifted to saving neither.
      ...composeSessionState({ questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } }),
      // AUDIT 26 F222/F223/F101: the POSE - weaponDrawn
      // (SerializablePlayer :175, restored Sheathed = !weaponDrawn),
      // yaw/pitch/isCrouching (PlayerPositionData_v1 :212-214).
      // MW-D30: the camera's two persisted halves ride the pose - the
      // reference saves the first/third flag in its own REC_CAM_ record
      // (worldimp.cpp:425-427) and the zoom distance through the camera
      // script's onSave (camera.lua:350-352).
      // AUDIT 39: and the TRANSPORT MODE, SerializablePlayer.cs:179's
      // own line beside the weapon and the boarding memory the port
      // already took (:180 -> snap.boardShipPosition). The mode lives
      // on the motor, host-owned like the weapon, so it rides the pose
      // bag rather than the entity envelope.
      pose: { yaw: cam.yaw, pitch: cam.pitch, crouching: !!player.crouching, weaponDrawn: !weaponRig.playerWeapon.sheathed, camera: mwCamera.state(), transport: player.transportMode },
      locationKey: 'world',
      world: {
        pixel: playerTravelPixel(), nativeX: wc.x, nativeZ: wc.z, y: pf[1] - state.compensation[1],
        // P2-slice (items-2): loose piles ride the envelope in
        // NATIVES with the compensation-free height, the player
        // half's exact law.
        piles: droppedLoot.snapshotWorld((pos) => state.worldCoords(pos)).map((sp) => ({ ...sp, y: sp.y - state.compensation[1] })),
        // AUDIT 26 F216/F217: LIVE ENEMIES ride the envelope - DFU's
        // SaveData_v1 carries enemyData wherever the player stands
        // (:865, restored :1006). Saved nowhere, a quickload during a
        // wilderness ambush or a guard pursuit despawned every
        // attacker with the spawn catch-up suppressed: a free escape
        // from any outdoor fight. Natives, the pile law; the
        // compensation-free height rides per record.
        foes: exteriorFoes.snapshotWorld((pos) => state.worldCoords(pos)).map((sf) => ({ ...sf, y: sf.y - state.compensation[1] })),
        guards: cityGuards.snapshotWorld((pos) => state.worldCoords(pos)).map((sg) => ({ ...sg, y: sg.y - state.compensation[1] })),
      },
    });
    const r = saveSlot(playerEntity.name, saveName, snap);
    // SS1: the shot is DEFERRED to frame end (SaveGame's two
    // WaitForEndOfFrame yields) - the frame loop's
    // capturePendingScreenshot delivers it once the save window has
    // popped, HUD in shot exactly as the C# leaves it.
    if (r.ok) requestScreenshot(r.key);
    townTalk.say(r.ok ? 'Game saved.' : 'Save failed (storage full or disabled).');
    return r.ok;
  }
  let _loading = false;
  /** F12/pause = the CURRENT character's QuickSave slot (QuickLoad's
   *  own law, Load(PlayerEntity.Name, quickSaveName)); the BOOT load
   *  arm passes mostRecent - the start window's displayMostRecentChar
   *  shape, because the interim entity has no name to key by. */
  async function worldQuickLoad({ mostRecent = false, key = null } = {}) {
    if (_loading) return;
    const snap = key != null ? loadSlot(key)
      : mostRecent ? (mostRecentRestorable()?.snap ?? null)
        : quickLoadSlot(playerEntity.name);
    if (!snap) { townTalk.say('No saved game.'); return; }
    const extras = restorePlayer(playerEntity, snap, spellsByIndex);
    if (!extras) { townTalk.say('Save version mismatch.'); return; }
    _loading = true;
    // CameraRecoiler's SaveLoadManager_OnStartLoad (:185-191): the
    // incoming character does not inherit the old one's reel.
    cameraRecoiler.reset();
    try {
      // IS1: a load never runs UNDER a mounted mode - RespawnPlayer
      // destroys the standing interior first (PlayerEnterExit
      // .cs:453-459). The dying scene is NOT cached on the way out:
      // the entity's cache is already the SAVE's own (restorePlayer
      // above), and DFU's load path deregisters rather than
      // serializes it (:464).
      if ((modes?.mode ?? 'exterior') !== 'exterior') modes?.forceExitToExterior({ cacheScene: false });
      setWorldMinutes(extras.classicMinutes ?? worldMinutes());
      magic.setReadiedByIndex(extras.readiedSpellIndex ?? null, spellsByIndex);
      // Q4-v: the quest envelope rides the same slot; a pre-Q4-v save
      // has no quest key and the live machine stands (recorded). A
      // restored session is never a NEW game, whatever the chargen
      // flow later reports. B4: the restore half moved into
      // restoreSessionState (systems/save.js) so the dungeon host
      // runs the identical law; the TK-i/TK-ii/TK-iv null-arm
      // recordings moved with it.
      if (restoreSessionState(extras, { questBridge, talk: { mill: rumorMill, tree: topicTree, session: npcSession } })) _questStarted = true;
      if (extras.locationKey === 'world' && extras.world?.pixel) {
        const w = extras.world;
        await _teleportToPixel(w.pixel.x, w.pixel.y);
        const [lx, lz] = state.localFromWorld(w.nativeX, w.nativeZ);
        const ly = (w.y ?? 2) + state.compensation[1];
        // IS1: an inside save re-enters its building BEFORE the player
        // lands - the Respawner's building arm (PlayerEnterExit
        // .cs:559-567) with RestorePosition landing the saved
        // transform raw. A door that cannot be found takes DFU's own
        // reposition arm (:615-621): say the line and keep the
        // teleport's default landing, never the inside position on the
        // outside collider.
        const inside = extras.interior
          ? await (modes?.restoreInterior?.(extras.interior, [lx, ly, lz]) ?? false)
          : false;
        if (inside) {
          playerSpawned = true;
          cam.pos = [lx, ly, lz];
        } else if (extras.interior) {
          townTalk.say('Building has no exterior doors. Repositioning player.');
        } else {
          if (walkMode) { player.spawn(lx, ly, lz); playerSpawned = true; }
          cam.pos = [lx, ly + (walkMode ? 0 : 40), lz];
        }
        // P2-slice (items-2): the teleport's teardown collected every
        // live pile (the reference's sweep); the envelope re-mints the
        // saved ones at their native spots.
        droppedLoot.restoreWorld(w.piles, (nx, nz) => state.localFromWorld(nx, nz), state.compensation[1]);
        // F216/F217: the pools re-mint through their one spawn chain,
        // then overlay the saved truth (SerializableEnemy's own
        // rebuild-then-set shape). Async behind the art; the teleport
        // above already tore the old pools down with the pixel.
        exteriorFoes.restoreWorld(w.foes, (nx, nz) => state.localFromWorld(nx, nz), state.compensation[1]);
        cityGuards.restoreWorld(w.guards, (nx, nz) => state.localFromWorld(nx, nz), state.compensation[1]);
      } else if (extras.locationKey && extras.locationKey !== 'world') {
        townTalk.say('(saved elsewhere - character restored; travel there yourself)');
      }
      // AUDIT 26 F222/F223/F101: the pose lands with the position -
      // RestorePosition sets yaw/pitch/isCrouching and
      // Sheathed = !weaponDrawn (:420-421). Presence-gated: an old
      // envelope leaves the live pose standing.
      applyPose(extras.pose);
      _lastEncMinutes = Math.floor(playerTicker.classicMinutes);   // no spawn catch-up across a load (DFU LoadInProgress)
      surfacePlayer();
      townTalk.say('Game loaded.');
    } finally {
      _loading = false;
    }
  }
  /** The ONE pose-apply (quickload + the classic import share it). */
  function applyPose(pose) {
    if (!pose) return;
    cam.yaw = pose.yaw ?? cam.yaw;
    cam.pitch = pose.pitch ?? cam.pitch;
    if (pose.crouching != null) player.crouching = !!pose.crouching;
    if (pose.weaponDrawn != null) weaponRig.playerWeapon.sheathed = !pose.weaponDrawn;
    // AUDIT 39 (SerializablePlayer.cs:423): the mount comes back
    // through the ONE builder, so the riding sprite, the hoof loop,
    // the ride bob and the no-climbing-from-a-saddle rule re-arm with
    // it. A pose without the field (an older save, the classic import)
    // leaves the live mode standing.
    if (pose.transport != null) setTransportModeHere(pose.transport);
    // MW-D30: the saved camera is FORCED, exactly as the reference
    // applies its REC_CAM_ flag on load (statemanagerimp.cpp:617-618
    // togglePOV when the live view differs). A pose without one (an
    // older save, the classic import - a Daggerfall .SAV carries no
    // Morrowind camera) leaves the live camera standing.
    mwCamera.restore(pose.camera);
  }
  /**
   * SAV3: the classic-save import arm - StartFromClassicSave's game
   * half over the SAV2 converter. The menu's flow stashed the opened
   * SaveGames; this host owns the live deps (SPELLS.STD, the faction
   * dict, MAPS.BSA) so the conversion runs HERE, then the import rides
   * the ONE restore seam like any load.
   *
   * THE FOUR HOSTS, named per the 17e rule: world.js (this host) is
   * WIRED - StartFromClassicSave always lands the import in the
   * EXTERIOR world at the position record's X/Z
   * (EnableExteriorParent + TeleportToWorldCoordinates, :529-534),
   * whatever the save's environment byte says, so worldModes.js
   * (interiors) and dungeonContext.js mount NO import arm by DFU's own
   * law, and exterior.js is the block-viewer probe host with no boot
   * params at all - all three deliberately unwired.
   */
  async function classicLoadBoot() {
    const saveGames = takePendingClassicSave();
    if (!saveGames) return false;
    // The deps the converter wants are async loads this host already
    // owns - await them so a fast boot cannot import a spell-less,
    // guild-less character.
    if (!spellsByIndex) spellsByIndex = await loadSpellIndex(fetchBytes);
    await townTalk.ensureFactions?.();
    let bundle;
    try {
      bundle = classicSaveToSnapshot(saveGames, {
        spellsByIndex,
        factionStore: townTalk.factionDict ? { dict: townTalk.factionDict } : null,
        resolveLocation: (regionIndex, locationIndex) => {
          const region = maps.getRegion(regionIndex);
          const row = region?.mapTable?.[locationIndex];
          if (!row) return null;
          return {
            mapId: row.mapId,
            regionName: maps.getRegionName(regionIndex) ?? '',
            locationName: region.mapNames?.[locationIndex] ?? '',
          };
        },
        regionLocationCounts: Array.from({ length: 62 }, (_, i) => maps.getRegion(i)?.locationCount ?? 0),
      });
    } catch (e) {
      console.warn('[world] classic save import failed:', e?.message ?? e);
      townTalk.say('Could not import the classic save.');
      return false;
    }
    const extras = restorePlayer(playerEntity, bundle.snap, spellsByIndex);
    if (!extras) return false;
    setWorldMinutes(extras.classicMinutes ?? worldMinutes());
    // The quest machine's 64 classic globals, SET in place -
    // machine.hooks captured the Map reference at construction, so
    // the entries move, never the Map (ImportClassicGlobalVars).
    if (questBridge?.machine?.globalVars) {
      for (const [i, v] of bundle.globalVars) questBridge.machine.globalVars.set(i, v);
    }
    // The six-zone weather array, already masked and swapped by the
    // converter (:631-644); the first exterior frame wears it.
    importClimateWeathers(bundle.climateWeathers);
    // "Only import classic rumours when loading in game" (OpenSave
    // :256-260) - each RUMOR.DAT record through the mill's own
    // ImportClassicRumor, whose three skip gates do the filtering.
    for (const rumor of saveGames.rumorFile?.rumors ?? []) {
      rumorMill.importClassicRumor(rumor, (bytes) => readRscTokens(bytes, 0, RSC.EndOfRecord));
    }
    // "Set player to world position": the import ALWAYS lands
    // exterior at the CharacterPositionRecord's world X/Z (:528-534).
    // Classic world units are the port's native units; the pixel
    // teleport rebuilds the streaming origin and the local spawn
    // lands inside it, the quickload arm's own shape.
    if (bundle.position) {
      const px = worldCoordToMapPixel(bundle.position.worldX, bundle.position.worldZ);
      await _teleportToPixel(px.x, px.y);
      const [lx, lz] = state.localFromWorld(bundle.position.worldX, bundle.position.worldZ);
      // The classic worldY does not translate (different vertical
      // frames); FixStanding's own answer - land on what is there -
      // is what PositionPlayerToLocation ends in anyway (:1597-1608).
      const raw = [lx, 2 + state.compensation[1], lz];
      const ly = walkMode ? floorLanding(collider, raw)[1] : raw[1];
      if (walkMode) { player.spawn(lx, ly, lz); playerSpawned = true; }
      cam.pos = [lx, ly + (walkMode ? 0 : 40), lz];
    }
    applyPose(bundle.snap.pose);
    _lastEncMinutes = Math.floor(playerTicker.classicMinutes);   // no spawn catch-up across a load
    surfacePlayer();
    townTalk.say(`Loaded classic save: ${bundle.saveName || bundle.snap.name}.`);
    return true;
  }
  const toggleTravelMap = (gotoPlace = null) => {
    // FindPlace_OnButtonClick (DaggerfallQuestJournalWindow.cs:353-363)
    // closes the journal and posts dfuiOpenTravelMapWindow in the same
    // breath, so the journal is still the mounted overlay when the map
    // is asked for - a goto opens past the "an overlay is up" guard the
    // M key answers to.
    if (!gotoPlace && townTalk.overlayActive) return;
    // W1/U61: the DOOR decides which map this skin wears. The classic
    // window needs its art - without it there is no map to click, so
    // the door says so rather than opening a blank one (the HUD/pause
    // law: a missing IMG closes a door, never the game); the enhanced
    // overworld reads no art at all.
    if (!travelMapDoorReady()) { townTalk.say('(the travel map art is unavailable)'); return; }
    // AUDIT 39: the refusal that sits ten lines ABOVE CheckFastTravel
    // in the same switch arm (DaggerfallUI.cs:604-609) - IsPlayerInside
    // first (the keydown ladder's `mode === 'exterior'` is that gate),
    // then AreEnemiesNearby, and only then GiveOffer, the sun-damage
    // box and the racial override. Ordered here as DFU orders it: no
    // walking out of a wilderness ambush by map. Same pool the rest
    // gate reads, and the STRICT variant - resting's slack distance is
    // the sleep rule, not this one.
    if (areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes])) {
      townTalk.say(CANNOT_TRAVEL_ENEMIES_TEXT);
      return;
    }
    // V2b: CheckFastTravel at the map's own door, where DFU calls it
    // (DaggerfallUI.cs:625) - a sun-damaged override cannot fast
    // travel by day, and the refusal is the override's own line.
    const ftb = racialFastTravelBlock(playerEntity, Math.floor(worldMinutes()));
    if (ftb) { townTalk.say(ftb.text); return; }
    _travelMap = buildTravelMapWindow({ onTravel: (pick, opts, computed) => { fastTravelTo(pick, opts, computed); } });
    if (!_travelMap) { townTalk.say('(the travel map art is unavailable)'); return; }
    if (gotoPlace) _travelMap.gotoPlace(gotoPlace);   // GotoPlace (:214-217), consumed on the map's first tick
    townTalk.showOverlay(_travelMap);
  };
  /** G5: the map the guild's TELEPORT service opens - the same
   *  window, armed. Only this host answers, because only this host
   *  has a streaming world to land in; the interior arm reads it off
   *  `host` and a host without one refuses the service. */
  function openTeleportMap() {
    if (!travelMapDoorReady()) return null;
    let win = null;
    win = buildTravelMapWindow({
      onTeleport: (pick) => { teleportTo(pick); },
      onClose: () => { if (modes?.questOverlay === win) modes?.showQuestOverlay?.(null); },
    });
    win?.activateTeleportationTravel();
    return win;
  }

  /** ONE construction for the map, because G5 gave it a second opener
   *  and the dependency list is long enough that two copies would
   *  drift (the ONE CONSTRUCTION SEAM rule). U61: the DOOR now forks
   *  the skin inside this one seam - the host says what it HAS
   *  (woods rides along for the overworld's relief) and never which
   *  map that adds up to. */
  function buildTravelMapWindow(extra = {}) {
    return createTravelMapWindow({
      maps, mapDict, woods,
      roads: () => terrainGen.roads(),   // ROADS 7: the map draws the network
      // GetPlayerTravelPosition, not PlayerGPS's raw pixel: DFU's travel
      // map reads it for the crosshair (:864), the player's region
      // (:1611) and the journey itself, and aboard a ship all three
      // answer the boarding point.
      getPlayerPixel: playerTravelOrigin,
      getClimateIndex: (x, yy) => maps.getClimateIndex(x, yy),
      // TP1: the popup's GuildManager.FastTravel fold reads the
      // player's guild memberships off the entity.
      playerEntity: () => playerEntity,
      // GetGoldAmount is coins PLUS letters of credit; the popup's
      // second test and its label want the coins alone.
      gold: () => totalGoldAmount(playerEntity),
      goldPieces: () => goldAmount(playerEntity),
      // Items.Contains(Transportation, Horse / Small_cart)
      // (DaggerfallTravelPopUp.cs:216-217) - the general store sells
      // both, so the calculator's transport modifier is real.
      hasHorse: () => hasTransport(TRANSPORT_HORSE),
      hasCart: () => hasTransport(TRANSPORT_SMALL_CART),
      // `DaggerfallBankManager.OwnsShip || GuildManager.FreeShipTravel()`
      // (DaggerfallTravelPopUp.cs:219), read at OnPush like the two
      // above. FreeShipTravel is base-false everywhere and overridden
      // only by the knightly orders (KnightlyOrder.cs:167-170: rank 6),
      // so the order slot of the membership book is the only one that
      // can answer yes; the record keys by GROUP and carries the
      // guild's name, so the order is recoverable from it (the tavern
      // window's free-rooms read does the same).
      hasShip: () => {
        if (ownsShip(playerEntity)) return true;
        const km = joinedGuildOfGroup(activeMemberships(playerEntity), GUILD_GROUPS.KnightlyOrder);
        const order = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
        return !!order && freeShipTravel(order, km);
      },
      // TravelTimeCalculator.cs:163 - `GetGuild(KnightlyOrder)
      // .FreeTavernRooms()`, read inside CalculateTripCost, so the inn
      // nights of a fare are waived for the same knight the tavern
      // window already houses free. The order is recovered from the
      // membership exactly as hasShip above does; the region is
      // PlayerGPS.CurrentLocation.RegionIndex, which is 0 in open
      // wilderness because CurrentLocation is a default struct there.
      freeTavernRooms: () => {
        const km = joinedGuildOfGroup(activeMemberships(playerEntity), GUILD_GROUPS.KnightlyOrder);
        const order = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
        if (!order) return false;
        const px = playerTravelPixel();
        return freeTavernRooms(order, km, {
          regionIndex: locationIndex.get(`${px.x},${px.y}`)?.regionIndex ?? 0,
          orderRegion: townTalk.factionDict?.get(order.factionId)?.region ?? null,
        });
      },
      diseaseCount: () => diseaseCount(playerEntity),
      poisonCount: () => poisonCount(playerEntity),
      ...extra,
    });
  }
  // A2: the exterior automap's own dispatch half (DaggerfallUI.cs
  // :633-650): M outside opens the TOWN map only when the current
  // map pixel carries a location - empty wilderness opens nothing.
  // (Inside, routeKey's 'automap' arm opens the dungeon map instead.)
  const toggleExteriorAutomap = () => {
    if (townTalk.overlayActive) return;
    const px = playerTravelPixel();
    const key = `${px.x},${px.y}`;
    const dfLoc = locationIndex.get(key);
    const b = built.get(key);
    if (!dfLoc || !b?.locBlocks || !b.locOrigin) return;
    const feet = walkMode ? player.pos : cam.pos;
    const t = state.pixelTranslation(px.x, px.y);
    // location-local player frame - the Where-is directory's own
    // conversion (setTopics' playerPos closure); the overlay holds
    // the motor, so the open-time capture stays truthful
    const local = [feet[0] - t[0] - b.locOrigin[0], feet[1] - t[1] - b.locOrigin[1], feet[2] - t[2] - b.locOrigin[2]];
    townTalk.showOverlay(new ExteriorAutomapWindow({
      locationName: dfLoc.name,
      locationId: `${dfLoc.regionIndex}:${dfLoc.name}`,
      gridW: dfLoc.exterior.exteriorData.width, gridH: dfLoc.exterior.exteriorData.height,
      blocks: b.locBlocks.map((bl) => ({ x: bl.x, y: bl.y, autoMap: bl.dfBlock?.rmbBlock?.fldHeader?.autoMapData })),
      playerPos: () => local,
      playerYaw: () => cam.yaw,
      directory: () => townTalk.directory,
      discovered: () => discoveredBuildings(`${dfLoc.regionIndex}:${dfLoc.name}`),
    }));
  };
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { use: false, crouch: false };   // audit 16f: jump is HELD since P14 - the latch slot was dead
  let zPrevW = false;   // C9: the exterior ReadyWeapon (Z) edge
  let hPrevW = false;   // a12: the exterior SwitchHand (H) edge - RELEASED, not pressed (WeaponManager.cs:272)
  if (playerPixel.location) {
    const tilePos = getLocationTerrainTileOrigin(startLoc);
    const extentZ = startLoc.exterior.exteriorData.height * RMB_SIDE;
    // Clamp inside the start pixel - the streaming state derives the
    // current pixel from the camera, so spawning past the edge would
    // recentre on frame one.
    cam.pos = [
      tilePos.x * tileSide + startLoc.exterior.exteriorData.width * RMB_SIDE / 2,
      playerPixel.avgY + 30,
      Math.min(tilePos.y * tileSide + extentZ + 120, TERRAIN_SIZE - 1),
    ];
  }

  async function pump() {
    if (building || queue.length === 0) return;
    building = true;
    const next = queue.shift();
    try {
      await buildPixel(next.px, next.py);
      // AUDIT 24 (the seven-slice sweep): the streamer can unload this
      // pixel while our textures are in flight. When it does,
      // destroyPixel runs against a `built` that has no entry yet -
      // buildPixel publishes only at its very end - so it returns
      // having freed nothing, and then the finished build publishes a
      // pixel nobody wants: a terrain mesh, a tilemap texture, its
      // billboard batches, a collider bucket and its doors, with no
      // unload left to come for them. Walking back rebuilds the key
      // and OVERWRITES the orphan, leaking every one of them.
      if (!state.loaded.has(`${next.px},${next.py}`)) destroyPixel(next.px, next.py);
    } catch (e) {
      console.error(`pixel ${next.px},${next.py} failed:`, e);
      state.release(next.px, next.py);
    }
    building = false;
  }

  const keys = new Set();
  // C9: the modal machine binds below AFTER these listeners exist -
  // the lazy read avoids the boot-time TDZ (mouse events fire during
  // loading) and defaults to the exterior mode.
  const modeNow = () => modes?.mode ?? 'exterior';
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  // T3b: the town seam eats its keys FIRST (F1-F4 modes; overlay
  // Esc/Enter) so a held overlay never leaks into the movement set.
  // U45: ui/input.js's routeAction contract for this host - the same
  // object the keydown ladder below calls and the large HUD's panels
  // reach through routeLargeHudClick. Every member is an arrow, so
  // nothing here runs before the helper it names exists.
  const hudCtx = {
    // U43 factored the window builders out for the interior arm to
    // mount; this reads the same ones rather than a third copy.
    toggleCharSheet: () => townTalk.showOverlay(makeCharSheetWindow()),
    // BS1/F198: the Status action's HEALTH box (CreateHealthStatusBox)
    // - which disease you carry, once incubation is over.
    // ST1: DisplayStatusInfo's chain - the record-22 status text
    // first, the health box on its dismissal (AddNextMessageBox).
    // FS1: the sentence between these two used to send the reader to
    // "a FLAG in systems/healthStatus.js (macro producers pend)". ST1
    // shipped statusInfoRows INTO that file and the macro producers
    // landed with IM1/MH1, so the flag it pointed at does not exist -
    // and it sat one line above the correction that says so.
    showStatus: () => {
      const rows = (id) => townTalk.lines(id);
      townTalk.showOverlay(new ActionTextBox(statusInfoRows(rows, questBridge?.machine?.macroContext?.() ?? null))
        .addNext(healthStatusRows(playerEntity, rows)));
    },
    toggleLogbook: () => townTalk.showOverlay(makeJournalWindow('activeQuests')),
    toggleNotebook: () => townTalk.showOverlay(makeJournalWindow('notebook')),
    toggleInventory: () => {
      // V4: GetSuppressInventory (LycanthropyEffect.cs:409-421)
      const sup = racialSuppressInventory(playerEntity);
      if (sup) { townTalk.say(sup.text); return; }
      if (inventoryDoorReady()) townTalk.showOverlay(makeInventoryWindow());
    },
    toggleSpellbook: () => toggleSpellbook(),
    toggleAutomap: () => toggleExteriorAutomap(),
    openTravelMap: () => toggleTravelMap(),
    // UI1: DaggerfallUI :581-583 - the U key's window opens only when
    // something in the pack is usable by magic; nothing usable, no
    // window, which is why this returns rather than showing an empty
    // list. The pick runs the inventory's OWN use path
    // (nativeInventory._use's deps), so a potion is drunk and an
    // enchanted item fires its Used payload through the one seam.
    // TR3: dfuiOpenTransportWindow (DaggerfallUI.cs:690-700) - indoors
    // refuses with a HUD line, and AIRBORNE is silently ignored
    // (`if (isGrounded)` with no else). Outdoors and grounded, the
    // picker opens.
    openTransport: () => {
      if (!player.grounded || !transportArtLoaded()) return;
      townTalk.showOverlay(new TransportWindow({
        hasHorse: hasHorse(playerEntity.items ?? []),
        hasCart: hasCart(playerEntity.items ?? []),
        // TR4: the row is live when a ship is owned - the bank arc has
        // carried that fact since H3, and this is its first reader.
        shipAvailable: ownsShip(playerEntity),
        onMode: (mode) => {
          // TR4: "Ship" is not a mode you travel IN (DFU's own comment
          // on the enum) - it is a teleport that lands back on Foot.
          if (mode === TRANSPORT_MODES.Ship) { boardOrDisembark(); return; }
          setTransportModeHere(mode);
          if (isRiding(mode)) {
            loadRidingArt(fetchBytes, palette, renderer, mode)
              .then((art) => { if (isRiding(player.transportMode)) ridingArt = art; })
              .catch((e) => console.warn('[transport] mount art unavailable:', e?.message ?? e));
          }
        },
      }));
    },
    openUseMagicItem: () => {
      const win = createUseMagicItemWindow({
        items: playerEntity.items ?? [],
        onUse: (item) => useMagicItem(item),
      });
      if (win) townTalk.showOverlay(win);
    },
    // PX15: THE DIAL - Tab (routeKey's arm) raises the compass rose
    // over the live world, each arm one of THIS host's own doors: the
    // dial routes, the windows keep every law they have. The four are
    // the reference's four; every door below exists on this ctx, so
    // no arm is dead.
    toggleDial: () => openPixelDial([
      { id: 'skills', label: 'Skills', dir: 'n', open: () => hudCtx.openSheetPage() },
      { id: 'items', label: 'Items', dir: 'e', open: () => hudCtx.toggleInventory() },
      // PX18: MAP on the dial is THE WORLD MAP (U61's overworld) -
      // Skyrim's own reading of the word; the local automap keeps its
      // M key untouched.
      { id: 'map', label: 'Map', dir: 's', open: () => hudCtx.openTravelMap() },
      { id: 'magic', label: 'Magic', dir: 'w', open: () => hudCtx.toggleSpellbook() },
    ]),
    quickSave: () => worldQuickSave(),
    quickLoad: () => worldQuickLoad(),
    // S40: the Rest door. Above ground this key did nothing at all
    // until now - rest existed only in the dungeon host - so neither
    // this ladder nor the large HUD's rest panel had anything to open.
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
        // PX25: the sheet's own doors, through this host's own arms.
        openPack: () => townTalk.showOverlay(makeInventoryWindow()),
        openSpellbook: () => { const w = makeSpellbookWindow(); if (w) townTalk.showOverlay(w); },
        openChronicle: () => { const w = makeJournalWindow('notebook'); if (w) townTalk.showOverlay(w); },
        quickSave: worldQuickSave,
        quickLoad: worldQuickLoad,
        // SAV4: the slot window's seams - the pause SAVE/LOAD doors
        // open it with these (openClassicPauseFlow builds the doors).
        playerName: () => playerEntity.name,
        saveAs: (saveName) => worldQuickSave(saveName),
        loadKey: (key) => worldQuickLoad({ key }),
        exitToMenu: exitToTitleMenu,
        textLines: (id) => townTalk.lines(id),
        // PX3: the pause window's Quests tab - the SAME seam the F5
        // logbook reads (:1525).
        questMessages: () => questBridge?.machine.getAllQuestLogMessages() ?? [],
        // PX4: the STRUCTURED walk - per-quest name + messages for the
        // journal's rail/detail, and the notebook's finished entries
        // for the archive. Raw messages and raw token entries: the
        // menu flattens, one flattener, one home.
        questLog: () => {
          const m = questBridge?.machine;
          const active = [];
          if (m) {
            for (const q of m.quests.values()) {
              const les = q.getLogMessages();
              if (!les?.length) continue;
              const messages = les.map((le) => q.getMessage(le.messageID)).filter(Boolean);
              if (!messages.length) continue;
              // PX5: the tightest RUNNING clock on the quest - Clock
              // resources carry remainingTimeInSeconds in game seconds
              // and clockEnabled/clockFinished (quest/clock.js:92,164).
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
        },
      });
    },
    cycleMode: (dir) => townTalk.setMode(dir > 0 ? hudLargeNextMode(getInteractionMode()) : hudLargePrevMode(getInteractionMode())),
  };
  addEventListener('keydown', (e) => {
    if (townTalk.keydown(e)) return;
    // U8a: F5 opens the classic character sheet (the dungeon's key,
    // host rule); preventDefault stops the browser reload.
    // AUDIT 17e F41: preventDefault must run for F5 in EVERY mode -
    // the mode gate skipped the handler AND its preventDefault, so
    // pressing F5 inside a building reloaded the page and destroyed
    // the session. Swallowing the browser reload is not conditional on
    // this ladder having a destination, which is why it runs above it.
    // FS1: the arc this used to defer to is U43, and U43 shipped -
    // worldModes' interior arm routes the whole ui/input.js table over
    // interiorKeyCtx, so F5/F6/L/N/R open the same windows through a
    // shop door as outside it (test/modalkeys.test.js red-proofs the
    // one gate that still stands, a typed name over the bindings).
    swallowBrowserKey(e);   // U47: F5/F6/F11 - one list, in ui/input.js
    const act = actionOf(e);   // I2: the registry owns the code -> action read
    // U45 - THE ONE DOOR PER DESTINATION: this ladder and the large
    // HUD's eleven panels open the same windows, so they read the same
    // object. It is the same law U43 applied to the interior arm, one
    // host over. QuickLoad keeps its own arm below because it is the
    // one action that works with a window UP (the death screen's F11).
    if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      // PX17b (Mac: "tab isn't working in-game"): THE BELL NOBODY
      // RANG. PX15 hung toggleDial on hudCtx and trusted routeKey's
      // Tab arm to ring it - but THIS host never calls routeKey; like
      // exterior it runs its own ladder, and only exterior got the
      // inline arm. So the world's rose was wired and unreachable -
      // the drawn-door-that-opens-nothing bug, inverted. The arm now
      // lives here, behind the same overlay/mode gate as every
      // sibling door; preventDefault only when the dial answers, so
      // classic Tab keeps its default.
      if (e.code === 'Tab' && hudCtx.toggleDial()) { e.preventDefault(); return; }
      if (act === 'CharacterSheet') { hudCtx.toggleCharSheet(); return; }
      // U43: LogBook (L) and NoteBook (N) - two of GameManager's own
      // dispatch chain (:541-548) that the port bound at I1 and then
      // read NOWHERE, while ui/questJournal.js sat built with all four
      // of its pages. The interior and dungeon hosts answer them too.
      if (act === 'LogBook') { e.preventDefault(); hudCtx.toggleLogbook(); return; }
      if (act === 'NoteBook') { e.preventDefault(); hudCtx.toggleNotebook(); return; }
      // U8d: F6 opens the classic inventory (DFU's default Inventory
      // binding; same host rule as F5).
      if (act === 'Inventory' && inventoryDoorReady()) { hudCtx.toggleInventory(); return; }
      // M2/I2: the CastSpell action opens the spellbook
      // (GameManager.cs:550-553); the cast is the attack click.
      if (act === 'CastSpell') { e.preventDefault(); hudCtx.toggleSpellbook(); return; }
      // V5: Rest, the last dead binding above ground. It was routed in
      // the DUNGEON's chain and nowhere else, so KeyR outdoors did
      // nothing at all - and with it comes CanRest's town half: the
      // camping refusal, the Vagrancy charge and the watch.
      if (act === 'Rest') { e.preventDefault(); hudCtx.toggleRest(); return; }
      // P-slice: the classic quicksave bindings (F9 save, F11 load -
      // InputManager.SetupDefaults), above ground at last.
      if (act === 'QuickSave') { e.preventDefault(); hudCtx.quickSave(); return; }
      // F-slice: the travel map (V - InputManager.SetupDefaults:1028).
      if (act === 'TravelMap') { hudCtx.openTravelMap(); return; }
      // A2: the exterior automap (Actions.AutoMap outdoors,
      // DaggerfallUI.cs:633-650 - the town-map half of the dispatch).
      // I2: through the registry, so M is rebindable like every other
      // action rather than a second hardcoded literal.
      if (act === 'AutoMap') { hudCtx.toggleAutomap(); return; }
      // S40: Rest (R - InputManager.SetupDefaults). GameManager's
      // dispatch has no scene gate at all; this ladder's is the U43
      // flag still standing over these lines.
      if (act === 'Rest') { e.preventDefault(); hudCtx.toggleRest(); return; }
      // I3: Escape with no overlay opens the pause screen; it closes
      // itself on the same key. U51: WHICH screen is ui/pauseDoor.js's
      // decision - the classic OPTN00I0 panel, or the enhanced menu in
      // pause mode - and pauseDoorReady is that fork's own gate, since
      // only one of the two needs art before it can draw a word.
      if (act === 'Escape' && pauseDoorReady()) { hudCtx.togglePause(); return; }
    }
    if (act === 'QuickLoad' && (modes?.mode ?? 'exterior') === 'exterior') {
      e.preventDefault();
      hudCtx.quickLoad();
      return;
    }
    keys.add(e.code);
    if (e.code === 'AltLeft') e.preventDefault();
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!townTalk.overlayActive && !(modes?.overlayHeld ?? false) && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'AltLeft') e.preventDefault(); });
  // U45: Actions.ActivateCursor (Enter) - PlayerMouseLook.cursorActive,
  // bound since I1 with no consumer, and the flag the large HUD's
  // IsLargeHUDInteractable actually is.
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
  // A click during the one await in that window
  // (`await loadQuestPack()`) threw
  //     TypeError: can't access property "pointerdown", it is undefined
  // and took the whole scene down. Reported from the deployed build.
  // test/audit24_wave37.test.js holds both halves of the cure: `modes?.`
  // on every reference above the declaration, and `var` at it.
  canvas.addEventListener('pointerdown', (e) => {
    if (townTalk.pointerdown(e)) return;
    if (modes?.pointerdown?.(e)) return;
    // U45: the large HUD's panels, BEFORE the relock.
    const _r = canvas.getBoundingClientRect();
    if (routeLargeHudClick(
      (e.clientX - _r.left) * (canvas.width / _r.width),
      (e.clientY - _r.top) * (canvas.height / _r.height),
      e.button, hudCtx, { windowUp: townTalk.overlayActive || (modes?.overlayHeld ?? false) })) return;
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
  // C9: RMB is a weapon control (drag-to-swing) exactly as the
  // dungeon host - the drag feeds the rig INSTEAD of the look.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    // U37: a window frees the mouse, so an open overlay gets the
    // HOVER before the look gate refuses the unlocked pointer.
    trackHudPointer(canvas, e);   // U46: the spell-icon rows' tooltip, before the overlay return
    trackLargeHudPointer(canvas, e);   // ROAD-Ar: HUDLarge's MouseEnter/MouseLeave (:361-372), for the activate gate's HUD guard
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
  // AUDIT 39r: the button goes into the held-keys set too. InputManager
  // polls Mouse0/1/2 through the same GetKey dictionary as the keyboard
  // (:995/:1010/:1017), and this Set was keydown-fed only - so AutoRun
  // (Mouse2, the wheel) and the drawn bow's ActivateCenterObject
  // un-draw (Mouse0) could never read true. mouseCode owns the
  // Unity/DOM middle-button crossover; the RELEASE is unconditional.
  addEventListener('mousedown', (e) => { if (e.button === 2) rightHeld = true; const mc = mouseCode(e.button); if (mc) keys.add(mc); if (e.button === 2 && !townTalk.overlayActive && walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.attackInput(0, 0, true); } });   // M2
  addEventListener('mouseup', (e) => { if (e.button === 2) rightHeld = false; const mc = mouseCode(e.button); if (mc) keys.delete(mc); if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, false); });   // the RELEASE is never gated - a window opened mid-swing must still let go
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      lookFilter.add(dx * lookScale(), -dy * lookScale() * lookInvert());   // AUDIT 28 W7: through the look filter (HANDEDNESS, mat4's law)
    },
    attackTap: () => { if (walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.clickAttack(); } },   // M2; AUDIT 39 F127: the tap is the whole touch strike, the drag hook was never called
    cycleMode: () => townTalk.nextMode(),   // T3-touch: the phone's F1-F4
  });

  const initialCount = queue.length + 1;
  console.log(`world: streaming from ${startPixel.x},${startPixel.y}, ${initialCount} initial pixels, ` +
    `player pixel ${playerPixel.location || 'wilderness'}, ${playerPixel.natureCount} nature flats`);
  status(`streaming world - ${locationName}`);

  // Shot-mode hooks: __move displaces the camera; __streamIdle reports
  // whether the build queue has drained.
  if (shotMode) {
    window.__move = (dx, dy, dz) => {
      cam.pos[0] += dx; cam.pos[1] += dy; cam.pos[2] += dz;
    };
    window.__pose = (x, y, z, yaw, pitch) => {
      // walk mode: the camera FOLLOWS the motor - move the player
      // (a bare cam.pos write is overwritten next frame; T1 probe fix)
      if (walkMode) { player.spawn(x, y, z); playerSpawned = true; } else cam.pos = [x, y, z];
      cam.yaw = yaw; cam.pitch = pitch;
    };
    window.__streamIdle = () => queue.length === 0 && !building && inFlight.size === 0;   // AUDIT EV: teleport builds count too - the probe told the truth only for pump's
    window.__builtCount = () => built.size;
    window.__currentPixel = () => `${state.current.x},${state.current.y}`;
    window.__cam = () => cam.pos.slice();
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => { player.spawn(x, y, z); playerSpawned = true; },
    };
    // M3 probe surface: the live climb state (the wall probe + the
    // check machine ride the real collider and the real skill rolls).
    window.__climb = () => JSON.stringify({
      climbing: !!player.climb?.isClimbing, slipping: !!player.climb?.isSlipping,
      y: +player.pos[1].toFixed(2), grounded: !!player.grounded,
    });
    // M3 probe surface: building-door spots - a door IS a wall with a
    // known outward normal, so the climb probe can stand square to
    // real geometry (centre/normal ride the door matrix per
    // staticDoors' own contract).
    window.__doorSpots = () => JSON.stringify(buildingDoors.slice(0, 80).map((e) => {
      const d = shiftedDoor(e);
      const m = d.matrix, c = d.centre, n = d.normal;
      const wc = [m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14]];
      const wn = [m[0] * n.x + m[4] * n.y + m[8] * n.z, m[1] * n.x + m[5] * n.y + m[9] * n.z, m[2] * n.x + m[6] * n.y + m[10] * n.z];
      const l = Math.hypot(wn[0], wn[2]) || 1;
      return { pos: wc.map((v) => +v.toFixed(2)), n: [+(wn[0] / l).toFixed(3), 0, +(wn[2] / l).toFixed(3)] };
    }));
    window.__frame = 0;
    // EE7: the renderer's own counters and the grass census, for the gate.
    // A probe cannot see a blade; it CAN see that the grass draws report
    // and that pixels carry blades. Read-only.
    window.__renderStats = () => ({ ...renderer.stats });
    window.__grassCensus = () => {
      let pixels = 0; let blades = 0;
      for (const p of built.values()) if (p.grass) { pixels++; blades += p.grass.count; }
      return { pixels, blades, built: built.size };
    };
    window.__renderer = renderer;   // EV2: the probe surface every host carries now (the dungeon's U38 precedent) - draw counts land against renderer.stats
  }

  // T2: the townsfolk probe surface - aggregated over built pixels,
  // positions reported in WORLD space (through the live translation).
  // Installed AFTER the mode machine exists: modes.installShotProbes()
  // defines an interior __people hook, and the town surface must win
  // in this host exactly as it does in the exterior host (the probe
  // read a null __people for 300s before this ordering was learned).
  function installTownProbes() {
    window.__people = () => {
      const out = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        p.population.pool.forEach((it, i) => {
          if (!it.active) return;
          out.push({
            pixel: `${p.px},${p.py}`, i, visible: it.visible, pend: it.scheduleEnable, recyc: it.scheduleRecycle,
            archive: it.person.archive, state: it.person.state, moves: it.person.moveCount, seeks: it.person.seekCount,
            pos: [
              it.person.pos[0] + p.locOrigin[0] + t[0],
              it.person.pos[1] + t[1],
              it.person.pos[2] + p.locOrigin[2] + t[2],
            ].map((v) => Number(v.toFixed(2))),
          });
        });
      }
      return JSON.stringify(out);
    };
    window.__talk = () => JSON.stringify(townTalk._debug());   // T3b probe surface
    window.__chargenRace = () => townTalk._debug().overlayFlow?.race?.key ?? null;   // U10 probe surface
    window.__chargenConfirm = () => townTalk._debug().overlayFlow?.raceConfirm ?? null;   // U11 probe surface
    window.__chargenFlow = () => townTalk._debug().overlayFlow ?? null;   // S3e probe surface
    window.__addGold = (n) => addGold(playerEntity, n);   // U10 probe surface: gold through the real producer
    window.__guards = () => JSON.stringify(cityGuards._debug());   // G1 probe surface
    window.__droppedLoot = () => JSON.stringify(droppedLoot._piles.map((pl) => ({ n: pl.items.length, pos: pl.pos.map((v) => +v.toFixed(1)), record: pl.record, flat: !!pl.batch })));   // U8e probe surface
    window.__crime = () => _crimeResponse();   // G1: force the response without pickpocket RNG
    window.__guardDamage = (i, dmg) => cityGuards._damage(i, dmg);   // G3: the real death path for loot probes
    window.__uiArt = () => JSON.stringify({ charsheet: charSheetDoorReady() });   // U8a probe surface; U52: the door, not the art alone
    window.__attack = () => weaponRig.clickAttack();   // G4: ClickToAttack for swing probes
    window.__townDebug = () => {
      const pixels = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        const local = [cam.pos[0] - t[0] - p.locOrigin[0], cam.pos[1] - t[1], cam.pos[2] - t[2] - p.locOrigin[2]];
        const [pgx, pgy] = p.population.nav.worldToNav(local[0], local[2]);
        pixels.push({
          pixel: `${p.px},${p.py}`, loc: p.location, pool: p.population.pool.length,
          max: p.population.maxPopulation,
          act: p.population.pool.filter((it) => it.active).length,
          vis: p.population.pool.filter((it) => it.visible).length,
          pgx, pgy, w: p.population.nav.weightAt(pgx, pgy),
          spawnTest: p.population.nav.getRandomSpawnPosition(pgx, pgy, 96, 10),
          origin: [p.locOrigin[0] + t[0], p.locOrigin[1] + t[1], p.locOrigin[2] + t[2]],
          navW: p.population.nav.width, navH: p.population.nav.height,
        });
      }
      return JSON.stringify({ night: isNight(minuteNow()), pixels });
    };
  }

  // P3-P6 mode machine (worldModes.js, extracted at P7): the frame
  // pipeline swaps to a built interior/dungeon context and back.
  // Doors are stored pixel-local and shifted through the LIVE
  // floating-origin translation for the machine's world-space math
  // (translations freeze while a mode is active - the modal frame
  // returns before the streaming step).
  const shiftedDoor = (entry) => {
    const [px, py] = entry.pixelKey.split(',').map(Number);
    const t = state.pixelTranslation(px, py);
    const m = entry.door.matrix;
    const matrix = m.slice();
    matrix[12] = m[12] + t[0];
    matrix[13] = m[13] + t[1];
    matrix[14] = m[14] + t[2];
    return { ...entry.door, matrix };
  };
  // ---- Q4-v: THE QUEST BRIDGE - the machine goes live in this host ----
  // The world seam is composed from the host's REAL objects (MapsFile,
  // BlocksFile, the faction store, the one clock, the inventory, the
  // overlay slots); members the host cannot honestly answer yet stay
  // ABSENT and the law modules idle loudly - the headless charter.
  // Port-Ledger Q4-v records the pending list (talk seams, videos,
  // faces, the disease seams, dungeon-mode popups, quest foes).
  const questPack = await loadQuestPack();
  console.log(`[quest] pack loaded: ${questPack.questCount} quests`);
  const _questStore = () => townTalk.factionDict ? ensureFactionRep(playerEntity, townTalk.factionDict) : null;
  const _questLoc = () => locationIndex.get(`${playerTravelPixel().x},${playerTravelPixel().y}`) ?? null;
  // AUDIT 24 (the seven-slice sweep): PlayerGPS.CurrentRegionIndex is
  // derived from the POLITIC map at the player's pixel, which answers
  // everywhere - it is NOT the current location's regionIndex, which
  // is -1 across the whole wilderness. That -1 fell through
  // getNameBankOfRegion to Breton, so every quest humanoid named
  // outdoors was a Breton whatever province he stood in.
  const _questRegionIndex = () => {
    const px = playerTravelPixel();
    return maps.getRegionIndexAt(px.x, px.y);
  };
  /** PersistentFactionData.GetRegionFaction (:272-287): FindFactions
   *  (Province, -1, -1, region) and take the first row - the record
   *  both GetCurrentRegionFaction and GetCurrentRegionVampireClan
   *  read. C# throws on a miss; the port answers null, the refusal
   *  convention its People/Courts siblings already keep. */
  const _regionFaction = () => {
    const dict = _questStore()?.dict ?? null;
    if (!dict) return null;
    return findFactions(dict, { type: FACTION_TYPES.Province, region: _questRegionIndex() })[0] ?? null;
  };
  // Quest parchment boxes land in whichever overlay slot is LIVE:
  // exterior -> the townTalk overlay, interior -> the mode machine's
  // slot. Dungeon-mode popups pend the dungeon overlay seam (FLAGGED:
  // logged loudly rather than lost silently).
  // AUDIT 24 (wave 21): DaggerfallMessageBox.Show() is a
  // uiManager.PushWindow - a STACK. ShowPendingTaskMessages pops the
  // whole pending stack and Shows each one, so a drain of several
  // boxes leaves them layered, newest in FRONT, and the player clicks
  // down through them. The port minted a FRESH ServiceFlowWindow per
  // call and dropped it into the overlay slot, so every box after the
  // first threw the previous one away: a task that showed two messages
  // showed one, and a message long enough to chunk would have shown
  // only its tail. `push()` unshifts to the front, which is exactly
  // PushWindow.
  let _questBoxWin = null;
  // RW1: GivePc's `messageBox.OnClose += QuestCompleteMessage_OnClose`
  // (GivePc.cs:173, :189-196) - ONE deferred act armed by offerReward
  // and fired when the box the player is reading closes.
  let _onQuestBoxClosed = null;
  const showQuestBox = (box) => {
    if (_questBoxWin && !_questBoxWin.done && _liveQuestOverlay(_questBoxWin)) {
      _questBoxWin.push([box]);
      return;
    }
    const win = new ServiceFlowWindow([box], {
      onClose: () => {
        if (_questBoxWin === win) _questBoxWin = null;
        const fire = _onQuestBoxClosed; _onQuestBoxClosed = null; fire?.();
      },
    });
    _questBoxWin = win;
    // U43-ii: the modal slot first - interior OR dungeon, both of
    // which showQuestOverlay now answers. It REFUSES when a window is
    // already up, and the fall-through is townTalk's own slot, which
    // draws above the modal render in every mode. The old line here
    // was a console.warn saying the dungeon seam "pends", and the
    // CLASSIC START runs _TUTOR__ and _BRISIEN inside Privateer's
    // Hold - so the first ten minutes of a new game were silent.
    if (modes?.showQuestOverlay?.(win)) return;
    // ROAD-B B1: PUSH, not replace. A quest popup is DFU's PushWindow -
    // it lands over whatever is open and hands the screen back when it
    // closes (UserInterfaceManager.cs:79-91) - and this fall-through is
    // the OUTDOOR slot, where a rest window lives too. Replacing meant
    // a _BRISIEN message arriving mid-rest threw the rest away; the
    // rest is suspended under the box now, and resumes on its close,
    // which is exactly what DaggerfallRestWindow's `TopWindow != this`
    // (:364/:399) is written for.
    townTalk.pushOverlay(win);
  };
  /** A window is only still "the top of the stack" while the overlay
   *  slot it went into is still showing it - the player may have
   *  closed it, or another surface may have taken the slot. */
  const _liveQuestOverlay = (win) =>
    (modes?.questOverlay ?? null) === win || (townTalk?.overlay ?? null) === win;
  const questWorld = {
    // AUDIT 28 W4 SELF-AUDIT (F-B2): DFU's smaller-dungeon law lives
    // INSIDE MapsFile.GetLocation, so quest marker enumeration walks
    // the FIVE-BLOCK dungeon when the law says so - the frozen quest
    // state exists precisely so the same five blocks come back when
    // the player arrives. The port sized only at the door: a quest
    // set up under the setting picked markers from the FULL dungeon
    // and could aim at a block the build does not have. The quest
    // layer's maps therefore sizes getLocation/getLocationByName the
    // way DFU's does, late-binding the machine (the bridge is created
    // after this adapter, and DFU's GetLocation consults the global
    // machine the same way - another quest's link on the same dungeon
    // wins there too).
    maps: Object.create(maps, {
      getLocation: { value: (r, l) => dungeonLocationFor(maps.getLocation(r, l), { questMachine: questBridge?.machine }) },
      getLocationByName: { value: (rn, ln) => dungeonLocationFor(maps.getLocationByName(rn, ln), { questMachine: questBridge?.machine }) },
    }),
    getBlock: (name) => blocks.getBlockByName(name),
    // NPC1: the =symbol_ macro's flat caption. The quest machine has
    // declared this seam since Q2 and nothing production-side answered
    // it - every =person_ expanded to nothing. FLATS.CFG answers it now.
    flatCaption: (archive, record) => pipeline.flatCaption(archive, record),
    // PlayerGPS.CurrentLocation is the location of the CURRENT MAP
    // PIXEL (in or out of the walls); IsPlayerInLocationRect is the
    // music director's own live rect flag.
    currentLocation: () => _questLoc(),
    currentRegionIndex: () => _questRegionIndex(),
    currentLocationIndex: () => _questLoc()?.locationIndex ?? -1,
    // M-X: the macro table's world reads. legalRepNow feeds %ltn's
    // fourteen bands; currentLocationType feeds %ct/%cn2. The talk
    // getters (%fa/%fe/%fpc...), lordNameForFaction and oldLeaderFate
    // stay unmounted - the talk-news arc's - and answer the charter's
    // null through the handlers' optional reads; currentBuildingName
    // is the interior host's and this exterior host answers none
    // ('[invalid]' at the handler, DFU's own outside-a-building arm).
    legalRepNow: () => legalRepOf(playerEntity, _questRegionIndex()),
    // Q5: the Weather and Climate triggers' reads - the weather IS
    // the seven-name enum, the climate the MAPS.BSA index at the
    // player's pixel.
    // AUDIT 39 (#27): the fold IS the identity and the index was a
    // NAME - WEATHER_TYPES is the name array and currentWeather()
    // already answers out of it, so the read was undefined -> null on
    // every call and the always-on Weather trigger could never match.
    currentWeatherKey: () => weatherOverride ?? currentWeather() ?? null,
    // QG1: CastSpellDo's two documented world reads, live at last -
    // the machine has declared both since the Q-arc and nothing
    // production-side answered them, so `cast X spell do` (three
    // corpus quests) completed its template at parse and the trigger
    // was dead. The record read is the G4 SPELLS.STD registry
    // (first-duplicate-wins, the Free Action patch applied - the same
    // dict DFU's broker rebuilds); the match is EntityEffectBundle
    // .HasMatchForClassicEffect over the port's spells, whose effect
    // entries ARE the classic (type, subType) pairs - C# folds both
    // sides through MakeClassicKey's byte casts (EntityEffect.cs:999-
    // 1002), so the compare folds to byte too.
    // TN1: THE TALK-NEWS GETTERS, mounted at last. The four faction
    // names are TalkManager's npcData fields - TK-iv computed them in
    // every arm of getGreetingIndex and recorded "the names nobody
    // reads"; MacroHelper.cs:965-995 reads all four through the
    // TalkManager getters (:1795-1824), so %fa/%fae/%fe/%fea/%fnpc/
    // %fpc/%fpa stop expanding empty. GetFactionName's HolyOrder arm
    // (:1815-1822) answers the TEMPLE'S deity - Temple.FactionOrder-
    // Name is `parent.deity.ToString()` - resolved through getDivine
    // off the building the player is inside; outside one (or in a
    // non-temple) C# would be off in GetGuild's catch-land, and the
    // port falls to pcFactionName, recorded.
    // IH1: the LAST four pending world reads.
    // %cbd - MacroHelper.CurrentBuilding (:849-867): inside a building
    // the name is REGENERATED from the building's own seed through
    // BuildingNames.GetName with the current location and region;
    // outside one C# answers "[invalid]", which is the handler's own
    // null arm here.
    currentBuildingName: () => {
      const b = modes?.interiorBuilding;
      if (!b) return null;
      return generateBuildingName(b.nameSeed, b.buildingType,
        { ...(townTalk.nameOpts?.() ?? {}), factionId: b.factionId ?? 0 });
    },
    // %nt - MacroHelper.NearbyTavern (:630-642): "just gets a random
    // tavern from current location and ignores how near it is" -
    // UnityEngine.Random.Range over the directory's taverns (the
    // ENGINE-PRNG rule's injectable uniform roll), the localized
    // "tavern" when the location has none.
    randomTavernName: (roll = Math.random) => {
      const taverns = (townTalk.buildingDirectory ?? []).filter((b) => b.buildingType === TALK_BUILDING_TYPES.Tavern);
      if (!taverns.length) return 'tavern';
      return taverns[Math.floor(roll() * taverns.length)]?.name ?? 'tavern';
    },
    // Place.SetupSites' residence filter (Place.cs:1196):
    // DaggerfallBankManager.IsHouseOwned reads the CURRENT region's
    // owned-house slot (:140-148) - banking.js's own law, H1's home.
    isHouseOwned: (buildingKey) => isHouseOwned(playerEntity.houses ?? [], _questRegionIndex(), buildingKey),
    // Place's _getBuildingName bag - townTalk's ONE name bag, so the
    // quest's generated names and the talk directory's cannot drift.
    buildingNameOpts: () => townTalk.nameOpts?.() ?? {},
    factionNPC: () => npcSession.npcData?.npcFactionName ?? '',
    factionNPCAlly: () => npcSession.npcData?.allyFactionName ?? '',
    factionNPCEnemy: () => npcSession.npcData?.enemyFactionName ?? '',
    factionPC: () => npcSession.npcData?.pcFactionName ?? '',
    factionName: () => {
      if (npcSession.npcData?.guildGroup === GUILD_GROUPS.HolyOrder) {
        // AUDIT 39 (#26): factionId. The building record carries the
        // lowercase spelling (buildingDataForDoor's merge); the
        // uppercase one belongs to StaticNPC records, and reading it
        // here handed getDivine a 0 that can never resolve.
        const divine = getDivine(townTalk.factionDict, modes?.interiorBuilding?.factionId ?? 0);
        if (divine) return divine;
      }
      return npcSession.npcData?.pcFactionName ?? '';
    },
    // %fl1/%fl2/%ol1 - MacroHelper.GetLordNameForFaction, the one home
    // in systems/talk.js (the first-child Individual, the parity
    // gender, the seeded classic stream)
    lordNameForFaction: (id, old = false) => lordNameForFaction(townTalk.factionDict, id, old),
    // %olf - the pipeline's own localized fates (answerPipeline TALK_STRINGS)
    oldLeaderFate: (i) => answerPipeline.getOldLeaderFateString(i),
    getClassicSpellEffects: (spellID) => spellRecordOfIndex(spellID)?.effects ?? null,
    spellHasMatchForClassicEffect: (sp, effect) => (sp?.effects ?? []).some((e) =>
      ((e.type ?? 0) & 0xff) === ((effect.type ?? 0) & 0xff)
      && ((e.subType ?? 0) & 0xff) === ((effect.subType ?? 0) & 0xff)),
    currentClimateIndex: () => maps.getClimateIndex(playerTravelPixel().x, playerTravelPixel().y),
    currentLocationType: () => _questLoc()?.mapTableData?.locationType ?? null,
    currentRegionName: () => maps.getRegion(_questRegionIndex())?.name ?? '',
    isPlayerInLocationRect: () => _musicInLocationRect(),
    // F114: the bridge declares this hook as GetPlayerTravelPosition
    // "incl. its on-ship arm" (machine.js's ctx doc) and its one
    // consumer is the quest clock's travel arm, so it answers the
    // origin rule rather than PlayerGPS's raw pixel.
    playerPixel: () => playerTravelOrigin(),
    playerInside: () => {
      // B2: the DUNGEON arm - PcAt / IsPlayerHere / ConfigureFrom-
      // PlayerLocation never saw the player as inside one, which is
      // where the majority of the quest corpus sends them.
      if ((modes?.mode ?? 'exterior') === 'dungeon') {
        return { dungeon: { name: modes?.dungeonLocation?.name ?? '' } };
      }
      const b = modes?.interiorBuilding;
      if (!b) return null;
      return { building: { buildingKey: b.buildingKey, buildingType: b.buildingType, factionId: b.factionId, name: b.name ?? '' } };
    },
    // AUDIT 24 (the seven-slice sweep): FOUR SEAMS THE MACHINE HAS
    // DECLARED SINCE Q3 AND NOTHING ANSWERED. Every one of them was a
    // ported law running into `world?.x?.()` and evaporating - the
    // corpus's 193 `reveal` lines discovered nothing and filed no
    // note, %oth had no text to read, and every Person whose faction
    // race does not map fell to -1 instead of the region's race.
    /** PlayerGPS.DiscoverLocation (:872-890): resolve by name and file
     *  it, THROWING when the pair names nothing - C#'s own throw. */
    discoverLocation: (regionName, locationName) => {
      const loc = maps.getLocationByName(regionName, locationName);
      if (!loc?.loaded) throw new Error(`Error finding location ${regionName} : ${locationName}`);
      discoverLocation(loc.mapTableData.mapId, { regionName: loc.regionName, locationName: loc.name });
    },
    /** RevealLocation's readmap note - PlayerNotebook.AddNote(string). */
    addNote: (text) => questBridge?.notebook?.addNote(text),
    /** JournalNote's filing - the OTHER overload,
     *  PlayerNotebook.AddNote(List<TextFile.Token>). */
    addNoteTokens: (tokens) => questBridge?.notebook?.addNoteTokens(tokens),
    /** PlayerGPS.GetRaceOfCurrentRegion (:432-435): a RACES value,
     *  RegionRaces[index] + 1 - NOT a FactionRaces one. */
    currentRegionRace: () => REGION_RACES[_questRegionIndex()] + 1,
    // AUDIT 39 (#23): THE FIVE FACTION-TYPE READS Person.cs's
    // GetFactionTypeFactionID makes (:967-1018) and the %vam name
    // beside them. Unmounted, each `?? -1` landed in
    // _setupFactionTypeNPC's ZERO_FACTION arm, so every quest Person
    // declared `factiontype People/Courts/Province/Vampire_Clan` -
    // and every `group Resident1-4` career default - was built from
    // the zero record with a console warning. All five producers were
    // already in this file; only the mounts were missing.
    /** PlayerGPS.GetPeopleOfCurrentRegion (:440-457). Its sibling
     *  npcSession seam takes the LOCATION's region; this one is
     *  CurrentRegionIndex, which is what the C# reads. */
    currentRegionPeople: () => getPeopleOfCurrentRegion(_questStore()?.dict ?? null, _questRegionIndex())?.id ?? -1,
    /** PlayerGPS.GetCourtOfCurrentRegion (:469-483). */
    currentRegionCourt: () => getCourtOfCurrentRegion(_questStore()?.dict ?? null, _questRegionIndex())?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionFaction (:459-467) - GetRegionFaction
     *  is FindFactions(Province, -1, -1, region), first row. */
    currentRegionFaction: () => _regionFaction()?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionVampireClan (:485-490): the SAME
     *  Province record's `vam` column. */
    currentRegionVampireClan: () => _regionFaction()?.vam ?? -1,
    /** (racialEffect as VampirismEffect).VampireClan - the clan the
     *  curse entry carries; -1 when the PC is no vampire. */
    playerVampireClan: () => liveVampirism(playerEntity)?.clan ?? -1,
    /** VampirismEffect.GetClanName (:317-320). NULL - never '' - is
     *  what makes %vam print C#'s own "PC not a vampire" literal. */
    playerVampireClanName: () => {
      const clan = liveVampirism(playerEntity)?.clan ?? 0;
      if (!clan) return null;
      return _questStore()?.dict.get(clan)?.name ?? '';
    },
    /** TextProvider.GetRandomText (:250-268) - the flat Text-token
     *  pool over one TEXT.RSC record. */
    getRandomText: (id) => townTalk.randomText(id),
    /** The journal clock's countdown toggle. AUDIT 24: clock.js has
     *  read this seam since Q4-iv and nothing answered it, so the
     *  port's own "Journal Countdowns" switch did nothing. */
    showClocksAsCountdown: () => getBool('GUI', 'ShowQuestJournalClocksAsCountdown'),
    getFactionData: (id) => _questStore()?.dict.get(id) ?? null,
    findFactionsOfType: (type) => { const s = _questStore(); return s ? [...s.dict.values()].filter((f) => f.type === type) : []; },
    /** FindFactionByTypeAndRegion (PersistentFactionData.cs:236-265):
     *  an EXACT type+region match returns immediately (the first one
     *  wins); otherwise the LAST `region == -1` faction of that type
     *  is the partial match, because the loop keeps overwriting it;
     *  a total miss answers the zero struct, which reads as null here
     *  and lets %rt/%nrn take C#'s zero-struct fallbacks.
     *
     *  AUDIT 24 (wave 26): %rn/%rt have called this since Q4-i and
     *  nothing answered it - it was invisible to the seam gate, which
     *  could not see through questMacros.js's `const w = hooks?.world`
     *  alias. */
    findFactionByTypeAndRegion: (type, regionIndex) => {
      const s = _questStore();
      return s ? findFactionByTypeAndRegion(s.dict, type, regionIndex) : null;
    },
    /** GetLocationCompassDirection (TalkManager.cs:1238-1281) - %di's
     *  remote arm. Same wave, same alias hole. */
    locationCompassDirection: (place) => locationCompassDirection(
      { playerMapPixel: playerTravelPixel, maps },
      place?.siteDetails?.locationName ?? '',
    ),
    /** GetBuildingCompassDirection (TalkManager.cs:1203-1236) - %di's
     *  LOCAL arm, over the SAME closure the answer pipeline is given. */
    buildingCompassDirection: (buildingKey) => talkBuildingCompassDirection(buildingKey),
    // AUDIT 39 (#25): LegalRepute.cs:48-52 writes
    // PlayerGPS.CurrentRegionIndex, which is the POLITIC read - the
    // location's regionIndex is absent across the whole wilderness,
    // so the `?? 0` arm was the common case and filed the change
    // against Alik'r. The object's own read (legalRepNow) always used
    // _questRegionIndex; the write now agrees with it.
    changeLegalRep: (amount) => changeLegalRep(playerEntity, _questRegionIndex(), amount),
    mountCurrentSiteQuestResources: () => modes?.mountQuestResources?.(),
    // ---- B1 (AUDIT 25 blocker 1): THE FOE SPAWN SEAMS. The machine
    // has declared these since Q3-iii and no host answered - the
    // placement law sat fully ported in sceneMount.js with no caller,
    // so no quest that kills or meets a Foe could ever complete.
    /** GameObjectHelper.CreateFoeGameObjects (:1243-1305), data side:
     *  `count` inactive handles, one QuestResourceBehaviour each;
     *  activation (bindHost + start) waits for placement. */
    createFoeGameObjects: (foe, count) => mintQuestFoeWave(questBridge.machine, foe, count),
    /** CreateFoe.TryPlacement (:183-211): the INSIDE arms live with
     *  the modes host (dungeon places, interior pends - see the FLAG
     *  there); outside, IsPlayerInLocationRect picks the location ring
     *  (5/20) and the wilderness arm widens to 8/25 (:252-257).
     *  DFU's wilderness arm also TrackLooseObject's the spawn into
     *  the streaming world - the pool's cull owns that lifetime here. */
    tryPlaceFoe: (handle) => {
      const m = modes?.mode ?? 'exterior';
      if (m !== 'exterior') return modes?.tryPlaceQuestFoe?.(handle) ?? false;
      if (!(walkMode && playerSpawned)) return false;
      const feet = player.pos;
      const env = placeFoeEnv({
        collider,
        // origin at the controller centre - DFU casts from
        // PlayerObject.transform.position, not the feet
        playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
        playerYawRad: cam.yaw,
        // MERGE (the S-A lane's catch): fieldOfView() answers RADIANS,
        // the law speaks DEGREES - raw, every foe placed dead ahead
        // inside the view instead of just outside the cone.
        fovDegrees: fieldOfView() * 180 / Math.PI,
        isOccupied: entityOccupancy((f) => f.ai?.feet, () => exteriorFoes.foes, feet),
      });
      const spot = _musicInLocationRect() ? placeFoeFreely(env) : placeFoeFreely(env, { minDistance: 8, maxDistance: 25 });
      if (!spot) return false;
      const foe = handle.foe;
      // FinalizeFoe (CreateFoe.cs:341-359): a FLYING foe lifts 1.5
      // from the test point; walkers land through the pool's own chain.
      const _fly = (ENEMY_BASICS[foe.foeType]?.behaviour ?? 'General') === 'Flying';
      exteriorFoes.spawnFoe(foe.foeType, [spot.x, _fly ? spot.y + 1.5 : spot.y, spot.z], {
        gender: questFoeGender(foe),
        yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player (CreateFoe.cs:328)
        questBehaviour: handle.behaviour,
      }).catch((e) => console.error('[quest] exterior foe stand failed:', e?.message ?? e));
      return true;
    },
    /** GameManager.RaiseOnEncounterEvent - its one core consumer is
     *  the rest window's AbortRestForEnemySpawn, routed through the
     *  modes host (dungeon mode owns the only rest overlay). */
    raiseOnEncounterEvent: () => modes?.raiseOnEncounterEvent?.(),
    // ---- B3: THE RESPAWN SEAMS (TeleportPc's transport - see
    // _respawnAtSite above for the composition and the BT1 record of
    // DFU's own partial implementation).
    /** GetLocation + RespawnPlayer (TeleportPc.cs:96-118): true =
     *  the respawn STARTED (the action idles on isRespawning); false =
     *  unresolvable location, retry - the C#'s ONLY refusal. */
    respawnPlayerAtSite: (place) => {
      const sd = place?.siteDetails;
      if (!sd || _respawning) return false;
      const loc = maps.getLocationByName(sd.regionName, sd.locationName);
      if (!loc?.loaded) return false;
      _respawning = true;
      _respawnAtSite(loc)
        .catch((e) => console.error('[quest] respawn failed:', e?.message ?? e))
        .finally(() => { _respawning = false; });
      return true;
    },
    isRespawning: () => _respawning,
    /** The marker landing on the tick after the respawn completes
     *  (TeleportPc.cs:120-135) - scene space per the mounted mode. */
    setPlayerScenePosition: (p) => { if (p) modes?.setPlayerScenePosition?.(p); },
  };
  // TK-i: THE RUMOR MILL beside the bridge. Its three consumers are
  // all mounted now: "Any news?" and the questor-post greeting came in
  // with TK-v, and the BULLETIN BOARD's sign face reads through
  // `bulletinBoardNews` below (PlayerActivate.cs:706-739 - the arm
  // worldModes' exterior ray runs). The classic-rumor import runs off
  // the RUMOR.DAT the classic-save loader parses, in the one place DFU
  // reads that file (SaveGames.OpenSave :251-260). AddNonQuestRumor's
  // PRODUCER (the regional faction sim, PlayerEntity.
  // RegionPowerAndConditionsUpdate) pends the Systems lane, and THE
  // REFRESH CULL rides with it.
  /** ExpandQuestMessage(quest, ref tokens, true) then TokensToString -
   *  the SAME pass both quest-token consumers in TalkManager run:
   *  the rumor mill's (:1425-1431) and GetAnswerFromTokensArray's
   *  (TalkManager.cs:3554-3556). One seam, two callers.
   *
   *  AUDIT 24 (wave 25): IN PLACE, over the array it is handed, which
   *  is what TalkManager.cs:1425-1431 does -
   *  `ExpandQuestMessage(GetQuest(entry.questID), ref tokens, true)`
   *  where `tokens` IS `entry.listRumorVariants[variant]`, and
   *  QuestMacroHelper.cs:158 writes each result back into it. So a
   *  quest rumor is FROZEN at the wording of its first telling:
   *  %qdt, the questor's name, a Place that has since been renamed,
   *  all fixed forever. The port cloned first and re-expanded from
   *  source every time, which is the port being more correct than
   *  the game it is a port of. The answer pipeline's caller clones
   *  BEFORE calling (answerPipeline.js:656, C#'s own `.Clone()` at
   *  :3552), so the in-place pass is right for both. Also: C# calls
   *  this whether or not GetQuest found anything - the null-parent arm
   *  is a DFU forum-bug fix INSIDE ExpandQuestMessage, not a caller
   *  guard, and expandQuestMessage carries it (questMacros.js:437). */
  const expandQuestTokens = (questID, tokens) => {
    expandQuestMessage(questBridge?.machine.getQuest(questID) ?? null, tokens, true);
    return tokensToString(tokens);
  };
  const rumorMill = new RumorMill({
    nowClassicMinutes: () => playerTicker.classicMinutes,
    getFactionData: (id) => _questStore()?.dict.get(id) ?? null,
    currentRegionIndex: () => _questRegionIndex(),
    getRandomTokens: (textId) => townTalk.variantTokens(textId),
    expandQuestTokens,
    // AUDIT 39 (#109): THE COMMON-RUMOR MACRO PASS, which no host
    // ever supplied - so every regional-conditions rumor the sim
    // files (TEXT.RSC 1400-1483, all of them naming %fx1/%fx2/%fl1/
    // %fl2/%ol1/%reg) reached the player with its macros raw. DFU:
    //   SetFactionIdsAndRegionID(f1, f2, regionID);
    //   ExpandMacros(ref tokens, this);
    //   SetFactionIdsAndRegionID(-1, -1, -1);
    // (TalkManager.cs:1417-1419, and :1379-1381 for the board). The
    // walk is the machine's quest-SHAPED macro context - the same
    // one the status box rides - because the getters those symbols
    // read are the questWorld's own.
    expandCommonTokens: (tokens, ctx) => {
      setIdFactions(ctx?.faction1 ?? -1, ctx?.faction2 ?? -1);
      setIdRegion(ctx?.regionID ?? -1);
      try {
        expandQuestMessage(questBridge?.machine.macroContext() ?? null, tokens);
      } finally {
        setIdFactions(-1, -1);
        setIdRegion(-1);
      }
      return tokens;
    },
    expandRandomTextRecord: (id) => townTalk.lines(id).map((r) => r.text ?? r).join(' '),
    rolls: Math.random,
  });
  // S43: the entity carries the mill so the ENTITY TICK can reach it.
  // RegionPowerAndConditionsUpdate opens with RefreshRumorMill()
  // (PlayerEntity.cs:1630) and that call had no caller anywhere in src/
  // - the mill never dropped an expired rumor. Parked here the same way
  // the day block's other inputs are (sceneCache, bankAccounts), which
  // is what keeps the tick free of host wiring.
  playerEntity.rumorMill = rumorMill;
  // TK-ii: THE TOPIC TREE beside the mill. The quest topic/dialog-link
  // seams land here; the tree's WINDOW consumers (the Tell-me-about
  // page, the quest Where-is entries) mount with TK-v; the position
  // half of BuildingInfo (the compass) rides TK-iii.
  const topicTree = new TopicTree({
    getQuest: (questID) => questBridge?.machine.getQuest(questID) ?? null,
    getAllActiveQuestIds: () => [...(questBridge?.machine.quests.values() ?? [])].filter((q) => !q.questTombstoned).map((q) => q.uid),
    currentRegionIndex: () => _questRegionIndex(),
    currentRegionName: () => questWorld.currentRegionName(),
    currentLocationName: () => _questLoc()?.name ?? '',
    currentMapId: () => _questLoc()?.mapTableData?.mapId ?? 0,
    isPlayerInside: () => (modes?.mode ?? 'exterior') !== 'exterior',
    isPlayerInsideBuilding: () => (modes?.mode ?? 'exterior') === 'interior',
    isPlayerInsideCastle: () => modes?.insideDungeonCastle ?? false,   // ROAD-B B4: GameManager.IsPlayerInsideCastle, LIVE (see the note on the pipeline mount below)
    currentBuildingKey: () => modes?.interiorBuilding?.buildingKey ?? -1,
    getBuildingList: () => townTalk.directory,
    exteriorBuildings: () => _questLoc()?.exterior?.buildings ?? null,
    factionName: (id) => townTalk.factionDict?.get(id)?.name ?? '',
    addOrReplaceQuestProgressRumor: (uid, m) => rumorMill.addOrReplaceQuestProgressRumor(uid, m),
    // F099: TalkManager.cs:2958 passes onlyIfResidence=TRUE and the
    // quest Place's buildingName - the bridge used to drop both, so
    // the store's refusals were never reachable from the talk seam.
    undiscoverBuilding: (buildingKey, buildingName) => undiscoverBuilding(`${_questLoc()?.regionIndex ?? -1}:${_questLoc()?.name ?? ''}`, buildingKey, true, buildingName ?? null),
    talkPartner: () => npcSession.lastTargetStaticNPC ?? npcSession.lastTargetMobileNPC ?? null,
    onTopicListsUpdated: () => {},   // the talk window's refresh is TK-v's
  });
  // TK-iv: THE NPC SESSION - the module that chooses the NPC the mill,
  // the tree and the pipeline all answer for. Its questor door is what
  // finally opens a quest offer from a plain static-NPC click.
  const npcSession = new NPCSession({
    factionData: (id) => _questStore()?.dict.get(id) ?? null,
    factionName: (id) => _questStore()?.dict.get(id)?.name ?? '',
    peopleOfCurrentRegion: () => getPeopleOfCurrentRegion(_questStore()?.dict ?? null, _questLoc()?.regionIndex ?? -1)?.id ?? 0,
    // CQ1: PlayerGPS.GetCourtOfCurrentRegion, through the same store
    // and the same region index its People sibling below reads. This
    // was hardcoded 0, which is not "absent" - 0 is a real faction id,
    // so a palace interior and the three generic Random_* factions
    // resolved to whatever faction 0 is rather than to nothing. A
    // region whose court cannot be resolved answers 0 as the bridge's
    // own no-faction value (DFU throws; talk.js's getter returns null
    // and the decision is made here, its sibling's convention).
    courtOfCurrentRegion: () => getCourtOfCurrentRegion(_questStore()?.dict ?? null, _questLoc()?.regionIndex ?? -1)?.id ?? 0,
    currentLocationIndex: () => _questLoc()?.locationIndex ?? 0,
    nameBankOfCurrentRegion: () => getNameBankOfRegion(_questRegionIndex()),   // AUDIT 24: the POLITIC-derived index, like every other region read - the location's is -1 across the whole wilderness
    // AUDIT 39 (#112): GetQuestorName (TalkManager.cs:2586-2590) is
    // srand(entry nameSeed) then NameHelper.FullName over the ENTRY's
    // OWN nameBank - not the region's, so this is not talkMcp's
    // one-argument form. Unmounted, %pqn in the "any work" answers
    // (8076/8077) named nobody while still spending the seeded roll.
    fullName: (nameBank, gender) => nameHelperFullName(nameBank, gender),
    buildingType: () => (modes?.interiorBuilding?.buildingType === TALK_BUILDING_TYPES.Palace ? 'Palace' : null),
    isPlayerInsideCastle: () => modes?.insideDungeonCastle ?? false,   // ROAD-B B4: GameManager.IsPlayerInsideCastle, LIVE (see the note on the pipeline mount below)
    guildMemberships: () => Object.entries(activeMemberships(playerEntity))
      .map(([factionId]) => ({ factionId: Number(factionId) })),
    guildOfBuildingFaction: () => null,   // TK-v wires the guild MCP
    sgroupReputation: (sgroup) => playerEntity.sGroupReputations?.[sgroup] ?? 0,
    reactionToPlayer: (faction) => (faction ? getReactionToPlayer(faction, playerEntity) : 0),
    // TalkToNpc (TalkManager.cs:2649) expands the GREETING through
    // ExpandRandomTextRecord (:3580-3587) - one random variant, the
    // full macro pass, TokensToString with no separator. The same
    // seam the pipeline below is given: the greeting ladder (7206-7209)
    // and the guild table (8550-8571) carry %pcf/%pcn/%cn/%oth, and a
    // line-join printed those raw. `talkMcp` is the next statement's
    // closure and only runs at talk time.
    expandRandomTextRecord: (id) => expandTalkRecord(id, talkMcp()),
    randomTokens: (id) => townTalk.variantTokens(id),
    questorPostMessages: () => rumorMill.dictQuestorPostQuestMessage,
    getQuest: (questID) => questBridge?.machine.getQuest(questID) ?? null,
    isNPCDataEqual: (a, b) => !!questBridge?.machine.isNPCDataEqual(a, b),
    isLastNPCClickedAnActiveQuestor: () => !!questBridge?.machine.isLastNPCClickedAnActiveQuestor(),
    expandQuestMessage: (quest, tokens, reveal) => expandQuestMessage(quest, tokens, reveal),
    assembleTopicListPerson: () => topicTree.assembleTopicListPerson(),
    assembleTopicLists: () => topicTree.assembleTopicLists(),
    // `rebuildTopicLists` is ONE TalkManager field: the tree raises it
    // and StartNewConversation spends it
    needsTopicListRebuild: () => topicTree.rebuildTopicLists,
    clearTopicListRebuild: () => { topicTree.rebuildTopicLists = false; },
    raiseTopicListRebuild: () => { topicTree.rebuildTopicLists = true; },
    getBuildingList: () => topicTree.getBuildingList(),
    clearQuestInfo: () => topicTree.dictQuestInfo.clear(),
    clearRumorMill: () => { rumorMill.listRumorMill.length = 0; },
    setupRumorMill: () => {},   // the mill's list is never null in JS - TK-i recorded the no-op
    resetNPCKnowledge: () => topicTree.resetNPCKnowledge(),
    resetToneSession: () => answerPipeline.resetToneSession(),
    resetQuestionSession: () => answerPipeline.startNewConversation(),
    messageBox: (x) => townTalk.say(typeof x === 'number'
      ? (townTalk.lines(x).map((r) => r.text ?? r).join(' ') || 'You get no response.')
      : (Array.isArray(x) ? tokensToString(x) : String(x ?? ''))),
    pushTalkWindow: () => {},   // TK-v opens the window
    onTargetChanged: () => {},  // TK-v repaints the portrait and name
    rolls: Math.random,
  });
  /** NameHelper.FullName for the current region's bank - the two name
   *  macros (%fn, %mn) and %n's random-name fallback all draw it. */
  const talkFullName = (gender) => nameHelperFullName(getNameBankOfRegion(_questLoc()?.regionIndex ?? -1), gender);

  /** TalkManagerMCP's context: the two engine objects plus the host
   *  data the thirteen handlers read. Built lazily because the
   *  pipeline it names is constructed on the next statement. */
  const talkMcp = () => ({
    pipeline: answerPipeline,
    session: npcSession,
    randomTokens: (id) => townTalk.variantTokens(id),
    // AUDIT 24: TextProvider.GetRandomText picks ONE Text token out of
    // the record's flat pool (:250-268). Joining every line of every
    // variant with a space is not that - %oth read all eight oaths at
    // once, in one breath.
    randomText: (id) => townTalk.randomText(id),
    randomFullName: () => talkFullName(GENDERS.Male),
    fullName: (gender) => talkFullName(gender === 'female' ? GENDERS.Female : GENDERS.Male),
    localizedText: (key) => TALK_STRINGS[key] ?? '',
    // AUDIT 39 (#107): THE FIVE READS THE HANDLERS ALREADY MAKE.
    // Absent, expandTalkMacros substituted the empty string, so
    // %pcf/%pcn/%cn/%ra were DELETED from every greeting and where-is
    // record, getHonoric's `gender === 'male'` arm never fired (every
    // player was "Ma'am"), and %1com always drew the tone-1 (Normal)
    // opening whatever tone the player had picked.
    playerName: () => playerEntity.name ?? '',
    playerGender: () => playerEntity.gender,
    playerRace: () => playerEntity.race,
    cityName: () => townTalk.cityName(),
    toneIndex: () => townTalk.toneIndex(),
    // PlayerGPS.GetRaceOfCurrentRegion, through the same REGION_RACES
    // table getNameBankOfRegion reads
    // AUDIT 24: over the POLITIC-derived region index, like every
    // other region read - the location's regionIndex is -1 across the
    // whole wilderness and sent this to Breton everywhere outdoors.
    raceOfCurrentRegion: () => (RACE_BY_NAME_BANK[getNameBankOfRegion(_questRegionIndex())] ?? 'Breton'),
    factionRaceId: (race) => (OATH_RACE_INDEX[race] ?? 0),
    // AUDIT 26 F097: GetMacroDataSource copies potentialQuestorGender
    // ONLY when the current question is Work and there are NPCs with
    // work (TalkManagerMCP.cs:32-36); otherwise the context field keeps
    // the Genders enum default, Male. So %g..%g4 in a NON-Work record
    // resolve male in DFU whatever questor is remembered - the port
    // read the questor unconditionally and could say "she" there.
    questorGender: () => {
      const q = answerPipeline.currentQuestionListItem;
      if (q?.questionType !== QUESTION_TYPE.Work || !npcSession.workAvailable) return null;   // null -> the male branch (HasNPCsWithWork)
      return npcSession.getQuestorGender();
    },
    bumpSeed: (delta) => bumpSeed(delta),
  });

  // TK-iii: THE ANSWER PIPELINE over the tree, the mill and the
  // session. Its window consumers mount with TK-v; what is live here
  // is the ladder every answer already runs through.
  const answerPipeline = new AnswerPipeline({
    tree: topicTree,
    npcSession: () => npcSession.npcData,
    npcsKnowEverything: () => false,
    localizedText: (key) => TALK_STRINGS[key] ?? '',
    // TK-v: ExpandRandomTextRecord (:3580-3587) whole - a random
    // variant as TOKENS, the talk MCP over them, and TokensToString
    // with NO separator. This is what makes %n and the %hnt fork real.
    expandRandomTextRecord: (id) => expandTalkRecord(id, talkMcp()),
    // GetAnswerFromTokensArray (TalkManager.cs:3554-3556) ALWAYS runs
    // ExpandQuestMessage(..., reveal: true) over its cloned tokens
    // before TokensToString - that reveal is what makes asking about a
    // quest topic mark its dialog-linked resources. Unset, every %hnt
    // answer printed its macros raw; it is the mill's seam, one home.
    expandQuestTokens,
    getNewsOrRumors: (session) => rumorMill.getNewsOrRumors(session),
    isPlayerInside: () => (modes?.mode ?? 'exterior') !== 'exterior',
    /** ROAD-B B4: GameManager.IsPlayerInsideCastle (GameManager.cs:420-423)
     *  is PlayerEnterExit.IsPlayerInsideDungeonCastle and nothing else, and
     *  that flag is `playerDungeonBlockData.CastleBlock` for the block the
     *  player is standing in (PlayerEnterExit.cs:338). All four talk/quest
     *  mounts in this host hardcoded `false`, so every arm that forks on it
     *  took its outside-a-castle branch forever:
     *    - GetAnswerWhereAmI's dungeon arm (TalkManager.cs:1539) - the
     *      Castle Daggerfall throne room answered as if it were a street;
     *    - the castle QUESTOR door (TalkManager.cs:2558) and its two
     *      `Work`-topic forks (:3161-3164, :3451-3453);
     *    - DaggerfallQuestOfferWindow's two castle carve-outs (:34, :86),
     *      which reach here through the bridge's offer flow.
     *  The mode host publishes it (worldModes.insideDungeonCastle); the
     *  dungeon context has computed the block flag since AUDIT 21. */
    isPlayerInsideCastle: () => modes?.insideDungeonCastle ?? false,
    isPlayerInsideDungeon: () => (modes?.mode ?? 'exterior') === 'dungeon',
    currentLocationName: () => _questLoc()?.name ?? '',
    currentRegionName: () => questWorld.currentRegionName(),
    // AUDIT-UI: GetAnswerWhereAmI's DUNGEON arm (TalkManager :1537-1541)
    // asks the dungeon for its special name and its region. Neither
    // hook was ever supplied, so "Where am I?" underground formatted
    // with two empty strings. Both are the CURRENT location's, which
    // is what Dungeon.Summary carries.
    specialDungeonName: () => specialDungeonName(
      questWorld.currentRegionName(), _questLoc()?.name ?? '', (id) => townTalk.lines(id)?.[0] ?? null),
    dungeonRegionName: () => questWorld.currentRegionName(),
    // AUDIT 39 (#111): the REGION WALK, mounted. GetLocationWith-
    // RegionalBuilding (TalkManager.cs:1891-1918) counts the region's
    // map-table keys and re-walks to the pick, then answers
    // MapFileReader.GetLocation(CurrentRegionIndex, i). Hardcoded
    // null, the count loop never ran, so every Regional row - "Any
    // tavern", the ten knightly orders - answered record 11, the
    // not-found line, and %fcn stayed empty forever. This is the plain
    // reader, not the quest layer's dungeon-sized adapter: TalkManager
    // reads MapFileReader directly.
    currentRegion: () => maps.getRegion(_questRegionIndex()) ?? null,
    getLocation: (r, i) => maps.getLocation(r, i),
    currentRegionIndex: () => _questRegionIndex(),
    currentExteriorDoorBuildingKey: () => modes?.interiorBuilding?.buildingKey ?? null,
    getAnyBuilding: (buildingKey) => discoveredBuildings(`${_questLoc()?.regionIndex ?? -1}:${_questLoc()?.name ?? ''}`)
      .find((b) => b.buildingKey === buildingKey) ?? null,
    discoverBuilding: (buildingKey) => discoverBuilding(
      `${_questLoc()?.regionIndex ?? -1}:${_questLoc()?.name ?? ''}`,
      (topicTree.listBuildings ?? []).find((b) => b.buildingKey === buildingKey) ?? { buildingKey }),
    // S44: the real member (PersistentFactionData.cs:675-689). This hook
    // answered a hardcoded `false` from the talk arc onward, so
    // answerPipeline's faction-relation gate could never fire once.
    isFaction2RelatedToFaction1: (id1, id2) => {
      const d = _questStore()?.dict;
      return d ? isFaction2RelatedToFaction1(d, id1, id2) : false;
    },
    // GetKeySubjectLocationCompassDirection (TalkManager.cs:1189-1201)
    // ends in GetBuildingCompassDirection; unwired, every directional
    // where-is answer expanded %di to '...never mind...'.
    buildingCompassDirection: (buildingKey) => talkBuildingCompassDirection(buildingKey),
    setRandomQuestor: () => npcSession.setRandomQuestor(),
    // TK-v: THE TONE GATE's two seams. C# recomputes the reaction tier
    // inside GetAnswerText when the tone CHANGED (:1994-1995), so the
    // pipeline owns the gate and the host owns only the tone itself
    // and the computation - which is the whole point of TK-iii's fix.
    toneIndex: () => townTalk.toneIndex(),
    reactionTier: (questionType, socialGroup) => townTalk.computeTier(questionType, socialGroup),
    rolls: Math.random,
  });
  talkEngineRef = { session: npcSession, pipeline: answerPipeline, tree: topicTree, mill: rumorMill };
  /** ItemCollection.Contains / RemoveItem (ItemCollection.cs:157-163,
   *  :278-287) look the item up by its UID - never by object identity.
   *
   *  AUDIT 24 (the seven-slice sweep): these two hooks used indexOf and
   *  includes, and the identity they relied on DOES NOT SURVIVE A LOAD.
   *  The player's held record and the Item resource's
   *  daggerfallUnityItem are serialised into the envelope separately
   *  (save.js's snap.items, item.js's own structuredClone) and restored
   *  separately, so afterwards they are two distinct objects with equal
   *  content and nothing relinks them. The tombstone sweep and
   *  `give item to` then silently no-opped on every quest item the
   *  player was already carrying.
   *
   *  The port has no per-item UID allocator yet, so the stand-in is the
   *  QUEST identity the sibling hooks already match on - questUID plus
   *  the symbol name, which for a quest item is exactly what DFU's UID
   *  lookup resolves. Object identity is still tried first, so a
   *  non-quest item (and the same-session case) behaves as before. */
  const _heldItemIndex = (dfItem) => {
    const items = playerEntity.items ?? [];
    const direct = items.indexOf(dfItem);
    if (direct >= 0) return direct;
    if (!dfItem?.questItem) return -1;
    return items.findIndex((it) => it.questItem
      && it.questUID === dfItem.questUID
      && it.questSymbol?.name === dfItem.questSymbol?.name);
  };
  questBridge = createQuestBridge({
    data: questPack,
    world: questWorld,
    // TK-ii: the topic/dialog seams land in the tree (TalkManager's
    // own methods, 1:1; the machine's dialogLink/addDialog arg shapes
    // are already the C# ones)
    addQuestTopics: (quest) => topicTree.addQuestTopicsForQuest(quest),
    dialogLink: (uid, name, type, name2, type2) => topicTree.dialogLinkForQuestInfoResource(uid, name, type, name2 ?? null, type2 ?? QUEST_INFO_RESOURCE_TYPE.NotSet),
    addDialog: (uid, name, type, instantRebuild) => topicTree.addDialogForQuestInfoResource(uid, name, type, instantRebuild),
    removeQuestInfoTopics: (uid) => topicTree.removeQuestInfoTopicsForSpecificQuest(uid),
    forceTopicListsUpdate: () => topicTree.forceTopicListsUpdate(),
    // FE1: the HUD escorting faces - AddFace/DropFace's world half
    // (declared by the bridge since Q4, mounted now) and the
    // quest-end sweep off the tombstone's OnQuestEnded.
    addFace: (r) => addEscortFace(r),
    dropFace: (r) => dropEscortFace(r),
    onQuestEnded: (q) => {
      // F96: GuildManager's ctor-registered listener (:45-47, :53-67),
      // which is the ONLY way into the Thieves Guild or the Dark
      // Brotherhood - their initiation quests carry no join action and
      // neither guild has a walk-in. FIRST, because GuildManager is
      // constructed long before the HUD; and SILENT, because
      // AddMembership pushes no welcome window the way the walk-in join
      // does.
      guildInitiationQuestEnded(activeMemberships(playerEntity), q?.questName ?? '',
        !!q?.questSuccess, dateFromClassicMinutes(playerTicker.classicMinutes));
      escortQuestEnded(q);
    },
    // TK-i: the six rumor seams land in the mill (TalkManager's own
    // methods, 1:1)
    addQuestRumor: (uid, m) => rumorMill.addQuestRumorToRumorMill(uid, m),
    addProgressRumor: (uid, m) => rumorMill.addOrReplaceQuestProgressRumor(uid, m),
    addQuestorPostMessage: (uid, m) => rumorMill.addQuestorPostQuestMessage(uid, m),
    removeProgressRumors: (uid) => rumorMill.removeQuestProgressRumorsFromRumorMill(uid),
    removeQuestorPostMessage: (uid) => rumorMill.removeQuestorPostQuestMessage(uid),
    removeQuestRumors: (uid) => rumorMill.removeQuestRumorsFromRumorMill(uid),
    classicSeconds: () => playerTicker.classicMinutes * 60,
    playerEntity,
    // AUDIT 24 (the seven-slice sweep): three more seams the bridge has
    // declared since Q2/Q3 that this host never answered. The bridge's
    // ctx surface has the same trapdoor questWorld had - every read is
    // `ctx.x?.()`, so an unmounted one evaporates in silence.
    //
    // TalkManager.RemoveNpcQuestor (:2602-2605): the offer window's ONE
    // constructor side effect. npcSession has carried it since TK-iv
    // and nothing called it, so a townsperson who was offered work
    // stayed in npcsWithWork for ever - re-offering the same quest
    // every time the player talked to them.
    removeNpcQuestor: (seed) => npcSession.removeNpcQuestor(seed),
    // MakePcDiseased / CurePcDisease over the S18 system, which has
    // been ported since its own slice and wired to nothing here.
    makePcDiseased: (diseaseType) => { startDisease(playerEntity, diseaseType, gameDaysNow()); surfacePlayer(); },
    cureDisease: (diseaseType) => {
      for (const a of playerEntity.activeEffects ?? []) {
        if (a.kind === 'disease' && a.disease === diseaseType && !a.ended) endDisease(a);
      }
      surfacePlayer();
    },
    // V2d: CurePcDisease's other two arms (`cure vampirism` /
    // `cure lycanthropy` - $CUREVAM's and $CUREWER's own last acts),
    // declared by the bridge since Q4 and wired to nothing here. The
    // RaiseTime(60) minute is the bare clock move both cures take.
    endVampirism: () => {
      if (cureVampirism(playerEntity, { advanceMinutes: (m) => setWorldMinutes(worldMinutes() + m) })) surfacePlayer();
    },
    endLycanthropy: () => {
      if (cureLycanthropy(playerEntity, {
        nowMinutes: Math.floor(worldMinutes()),
        advanceMinutes: (m) => setWorldMinutes(worldMinutes() + m),
      })) surfacePlayer();
    },
    // Q5: the un-pended quest actions' doors. setPlayerCrime rides
    // the ONE setter (V4's SuppressCrime gate); the pieces pair is
    // PayMoney's `gold` arm (coins alone, letters excluded);
    // raiseTime is TrainPc's bare three-hour move; the guards call
    // is F036's witness-arm caller with the live pool; the enemy
    // pair walks THIS host's exterior pools (a foe already dead or
    // a guard already spawned simply passes through).
    setPlayerCrime: (crime) => setCrimeCommitted(playerEntity, crime),
    getGoldPieces: () => goldAmount(playerEntity),
    deductGoldPieces: (n) => deductGoldPieces(playerEntity, n),
    raiseTime: (seconds) => setWorldMinutes(worldMinutes() + seconds / 60),
    // ROAD-B: through the host's ONE entry, so a quest that calls the
    // watch on a player standing in a tavern gets the indoor arm too.
    spawnCityGuards: (immediate) => _spawnGuards(!!immediate),
    // ROAD-B: GameManager.cs:790-806 through the ONE law
    // (hostCombat.makeEnemiesHostile), over the whole active database
    // (`_liveEnemyDatabase` - the inside host's pool included; a quest
    // that turns the room hostile fires wherever the player is).
    // The private copy this replaced also called makeHostileToPlayer
    // on every foe it flipped, which is a DIFFERENT law
    // (MakeEnemyHostileToAttacker) that DFU does NOT run here - it
    // handed the player's position and a 200-tick pursuit to every
    // enemy in the scene where C# sets one boolean and lets them find
    // the player through their own senses.
    makeEnemiesHostile: _makeEnemiesHostile,
    clearEnemies: () => {
      for (const f of [...exteriorFoes.foes]) { if (!f.dead) exteriorFoes.removeFoe(f); }
    },
    // MT-iii: ChangeFoeInfighting / ChangeFoeTeam's instance walk.
    // DFU filters the active-enemy database on QuestSpawn and matches
    // QuestResourceBehaviour.TargetSymbol; the port's quest-spawned
    // foes carry that behaviour at f.questBehaviour (questFoeHost's
    // bindQuestFoeHost), so HAVING one is being a quest spawn. The
    // symbol compare is name equality - the port mints a fresh
    // QuestSymbol per read, which no reference compare could match
    // (the same law AUDIT 24 recorded for isNPCDataEqual).
    questFoeInstances: (symbol) => {
      const want = symbol?.name ?? null;
      if (want == null) return [];
      // MT-iv: DFU's ActiveGameObjectDatabase is ONE database across
      // the scene, so the walk unions the INSIDE pool too - a quest
      // foe standing in a dungeon was unreachable, and since
      // SetComplete sits inside the instance loop the action re-ran
      // every machine tick for ever rather than completing.
      return [...exteriorFoes.foes, ...cityGuards.guards, ...(modes?.liveQuestFoes?.() ?? [])].filter((f) =>
        !f.dead && f.questBehaviour && f.questBehaviour.targetSymbol?.name === want);
    },
    playerRaceName: () => playerEntity.race ?? null,
    getReputation: (fid) => { const s = _questStore(); return s ? getReputation(s, fid) : 0; },
    changeReputation: (fid, amount, propagate) => { const s = _questStore(); if (s) changeReputation(s, fid, amount, propagate); },
    changeLegalRep: (amount) => questWorld.changeLegalRep(amount),
    getGold: () => goldAmount(playerEntity),
    // AUDIT 39: PayMoney's `money` arm gates on GetGoldAmount - coins
    // PLUS letters of credit - which is what deductGold then spends.
    getTotalGold: () => totalGoldAmount(playerEntity),
    deductGold: (n) => deductGold(playerEntity, n),
    addGold: (n) => addGold(playerEntity, n),
    addHUDText: (t) => townTalk.say(t),
    // The tokens arrive ALREADY expanded and already chunked - the
    // read moved back to queue time where Quest.cs:785 does it.
    showPopup: (_q, tokens) => {
      const rows = tokensToRows(tokens);
      if (rows.length) showQuestBox({ rows });
    },
    showPrompt: (q, message, respond) => showQuestBox({
      rows: tokensToRows(message.getTextTokens(-1, q.rolls)),
      buttons: 'YesNo',
      onYes: () => { respond(true); return []; },
      onNo: () => { respond(false); return []; },
    }),
    // QG1: PromptMulti's 2-4 button box. The buttons are BUTTONS.RCI
    // record numbers (the C# casts them to MessageBoxButtons unchecked
    // and the box loads the art by record); the click answers the
    // NUMBER back and the action routes by value. No cancel and no
    // click-through - AllowCancel false, ClickAnywhereToClose false
    // (PromptMulti.cs:87-88) - which is ServiceFlowWindow's
    // buttonsMulti contract.
    showPromptMulti: (q, message, buttons, respond) => showQuestBox({
      rows: tokensToRows(message.getTextTokens(-1, q.rolls)),
      buttonsMulti: buttons,
      onButton: (b) => { respond(b); return []; },
    }),
    // QV1: PlayVideo's door, live - ten corpus quests write `play
    // video N` (the main-quest ANIMs) and the line warned-and-dropped.
    // The player is the infection lane's own mount (ui/videoPlayer,
    // the DaggerfallVidPlayerWindow shape; it owns the frame loop for
    // its lifetime), pushed OFF the tick's frame for the same
    // re-entrancy reason. EndOnAnyKey is FALSE - PlayVideo.cs:78's
    // own assignment - and Escape still skips any video (AUDIT 26
    // F151: GetBackButtonDown is its own disjunct). NEVER TRAPS: a
    // missing or undecodable ANIM costs the video and the quest rolls
    // on - SetComplete already ran at the push, exactly as in C#.
    playVideo: (name) => {
      Promise.resolve().then(async () => {
        try {
          const { playVideo } = await import('../ui/videoPlayer.js');
          const { getBytes } = await import('./dataSource.js');
          const played = await playVideo(renderer.canvas, renderer, await getBytes(name), { endOnAnyKey: false });
          if (typeof window !== 'undefined') (window.__questVideos ??= []).push({ name, played });
        } catch (e) {
          console.warn(`[quest] ${name} unavailable - skipping the video:`, e?.message ?? e);
        }
      });
    },
    // DELTA (recorded): C# skips while the audio source is BUSY and
    // only a real play re-stamps PlaySound's timer; the port's one-shot
    // engine has no busy state, so every call reports played.
    playSound: (id) => { audio.playOneShot(id); return true; },
    // PlaySong hands a MIDI.BSA record name; the SongFiles member was
    // resolved in the action (systems/songFiles.js), which is where
    // DaggerfallSongPlayer.Play does it. DFU's quest song plays ONCE
    // and SongManager's `!songPlayer.IsPlaying` arm then restores the
    // context track; the port's songs LOOP (Ledger A, "THE SONG
    // SCHEDULER"), so a quest song holds until the music context
    // changes instead. That is the loop row's consequence, not a
    // second departure.
    playSong: (name) => music.playSong(name),
    giveItemToPlayer: (dfItem) => { playerEntity.items = playerEntity.items || []; addItem(playerEntity.items, dfItem); surfacePlayer(); },
    removeItemFromPlayer: (dfItem) => {
      const items = playerEntity.items ?? [];
      const i = _heldItemIndex(dfItem);
      if (i < 0) return;
      if (isEquipped(items[i])) unequipSlot(playerEntity, items[i].equipSlot);
      items.splice(i, 1);
      surfacePlayer();
    },
    playerHasItem: (dfItem) => _heldItemIndex(dfItem) >= 0,
    carriesQuestItem: (res) => (playerEntity.items ?? []).some((it) =>
      it.questItem && it.questUID === res.parentQuest?.uid && it.questSymbol?.name === res.symbol?.name),
    releaseQuestItem: (uid, res) => {
      // ReleaseQuestItemForReoffer's player-side sweep: unequip + drop
      // every held copy of the quest item.
      const items = playerEntity.items ?? [];
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (!(it.questItem && it.questUID === uid && it.questSymbol?.name === res.symbol?.name)) continue;
        if (isEquipped(it)) unequipSlot(playerEntity, it.equipSlot);
        items.splice(i, 1);
      }
      surfacePlayer();
    },
    makeHeldQuestItemsPermanent: (uid, sym) => {
      for (const it of playerEntity.items ?? []) {
        if (it.questItem && it.questUID === uid && it.questSymbol?.name === sym?.name) makeItemPermanent(it);
      }
    },
    // RW1: OfferToPlayerWithQuestComplete's world half (GivePc.cs
    // :150-171 + :189-196). The reward is a DROPPED LOOT container at
    // the player - "CreateDroppedLootContainer(PlayerObject, ...)" -
    // and the inventory opens over it as its remote target when the
    // QuestComplete box the action just raised CLOSES (the
    // messageBox.OnClose law). The mode that owns the ground mints
    // the pile: the dungeon through its own droppedLoot, everywhere
    // else this host's - the same split the inventory's onDrop rides.
    // A reward left untaken stays a pile at the player's feet,
    // exactly as DFU's container persists.
    offerReward: (q, dfItem) => {
      // undefined = "not my mode" (this host mints); null = the mode
      // owned the ground and could not mint (already warned) - the
      // ?? shortcut would fold the two, so the split is explicit.
      let open = modes?.mintRewardPile?.(dfItem);
      if (open === undefined) {
        open = () => {
          const pile = droppedLoot.dropPile([dfItem], dropFeet(), `${playerTravelPixel().x},${playerTravelPixel().y}`);
          if (!pile) return;
          townTalk.showOverlay(makeInventoryWindow({
            onClose: () => droppedLoot.releaseEmptied(),
            loot: { items: () => pile.items },
          }));
        };
      }
      if (open && _questBoxWin && !_questBoxWin.done && _liveQuestOverlay(_questBoxWin)) _onQuestBoxClosed = open;
      else open?.();
    },
    // IsPlayerInTown(true, true), through the one closure S40 gave it.
    // That closure replaced `locationType <= 2`, which is City /
    // Hamlet / Village and drops the four types PlayerGPS also counts
    // (HomeFarms, HomeWealthy, the standalone Tavern and
    // ReligionTemple) - and which never tested `mustBeOutside` at all,
    // so "in town, outdoors" was true while standing in a shop.
    isPlayerInTown: () => _isPlayerInTownStrict(),
    // H1: the quest machine's residence filter. The region is the
    // CURRENT one, which is IsHouseOwned's own key (:140-148).
    isHouseOwned: (buildingKey) => isHouseOwned(
      playerEntity.houses ?? [], _questLoc()?.regionIndex ?? 0, buildingKey),
    getGuild: (fid) => {
      const dict = townTalk.factionDict ?? null;
      const g = guildOfFaction(fid, resolveVariantGuild(dict), dict);
      if (!g) return null;
      const m = membershipOf(activeMemberships(playerEntity), g);
      return { guildGroup: g.guildGroup, rank: m?.rank ?? 0, power: _questStore()?.dict.get(g.factionId)?.power ?? 0, isNonMember: !m };
    },
    regionPriceAdjustment: () => regionPriceAdjustment(playerEntity, _questLoc()?.regionIndex ?? 0),
    // ROAD-B B4: the offer flow's own seam. The FLAG that stood here
    // ("this host never stands inside a castle interior") named the
    // wrong question - IsPlayerInsideCastle is not a building-side
    // check at all, it is the DUNGEON block's CastleBlock flag
    // (GameManager.cs:420-423 -> PlayerEnterExit.cs:136-139/:338), and
    // this host mounts the dungeon. Hardcoded false, GetQuest's castle
    // arm (DaggerfallQuestOfferWindow.cs:34) removed the questor from
    // every castle NPC it offered from, and the failed-get-quest
    // message (:86, "do not appear inside castles in classic") printed
    // in the throne room.
    isPlayerInsideCastle: () => modes?.insideDungeonCastle ?? false,
    getGuildFactionId: (g) => guildFactionIdOfGroup(g),
    // the notebook's headers (DaggerfallDateTime's two shapes, the
    // gameDate laws; CityName is the current location's name with the
    // region as DFU's no-location fallback)
    dateTimeString: () => dateTimeString(dateFromClassicMinutes(playerTicker.classicMinutes)),
    midDateTimeString: () => midDateTimeString(dateFromClassicMinutes(playerTicker.classicMinutes)),
    cityName: () => _questLoc()?.name ?? questWorld.currentRegionName(),
  });
  // AUDIT 24 (wave 22): PopupText.AddText's last line files the popup
  // in the notebook ring (:123), which is the journal's Messages page.
  // The notebook only exists once the bridge is built, so the sink is
  // handed down here.
  townTalk.hudMessageSink = (t) => questBridge?.notebook?.addMessage(t);
  // V2d: THE RACIAL-QUEST SEAM. worldTick's minute walk rolls the
  // curse quests (38-day non-cure, 84-day cure) but the machine is
  // THIS host's, so racialQuests reaches it through a registered host
  // - the passiveSpecials shape. FindQuests counts TOMBSTONED
  // instances too (QuestMachine.cs:867-881's default, which both DFU
  // call sites take); GetAllActiveQuests excludes them (:849-859).
  setRacialQuestHost({
    startQuest: (name) => questBridge.machine.startQuestByName(name),
    startQuestObject: (q) => questBridge.machine.startQuestImmediate(q),
    findQuests: (name) => [...questBridge.machine.quests.values()].filter((q) => q.questName === name),
    tombstoneQuestsByName: (name) => {
      for (const q of [...questBridge.machine.quests.values()]) {
        if (q.questName === name && !q.questTombstoned) questBridge.machine.tombstoneQuest(q);
      }
    },
    tombstoneQuestsByPrefix: (prefix) => {
      for (const q of [...questBridge.machine.quests.values()]) {
        if (!q.questComplete && !q.questTombstoned && q.questName?.startsWith(prefix)) questBridge.machine.tombstoneQuest(q);
      }
    },
    // VampirismEffect.StartQuest:243-255 - the clan IS the faction id,
    // the player's LEVEL sits in the rank seat, rep from the store.
    getVampireClanQuest: (clanFactionId, level) => questBridge.questLists.getGuildQuest(
      GUILD_GROUPS.Vampires, MEMBERSHIP_STATUS.Member, clanFactionId,
      (() => { const s = _questStore(); return s ? getReputation(s, clanFactionId) : 0; })(), level),
  });
  // CG2: the crime-guild doors, beside the racial one because they are
  // the same shape - PlayerEntity.Update starts a quest, so the machine
  // is registered once here rather than threaded through the tick.
  // startQuest carries the FACTION ID as DFU's StartQuest(name,
  // factionId) does, so the initiation quest is owned by the guild that
  // sent the letter.
  setCrimeGuildQuestHost({
    startQuest: (name, factionId) => questBridge.machine.startQuestByName(name, factionId),
  });
  // The clock the tally stamps its three-day letter from - the same
  // classic minute every other dated law in this host reads.
  setCrimeGuildClock(() => Math.floor(playerTicker.classicMinutes));
  if (_questStartPending) questInitAtGameStart();
  // VAR, not const: the pointer and wheel listeners far above close over
  // this binding and are live before it is assigned, so it must exist
  // and read undefined rather than throw a TDZ ReferenceError. Every
  // reference BEFORE this line must therefore be `modes?.` - which is
  // what test/audit24_wave37.test.js asserts, both ways.
  var modes = createWorldModes({
    // V2e: worldModes re-registers the infection host on entry, so the
    // cemetery arm rides the bag or it dies at that re-registration.
    transferToCemetery: transferToCemeteryArm,
    // A10: the Recall prompt, handed DOWN so the dungeon context this
    // host mounts raises the same 4000 box (Teleport.cs:81-98) rather
    // than its standalone refusal. The cast engine in THIS host
    // already routes to it; dungeon mode runs the context's own.
    onTeleport: () => teleportPrompt(),
    canvas, renderer, player, cam, keys, latch, blocks,
    // V5: PlayerGPS, for CanRest. Only this host knows what kind of
    // place the player is standing in, and the rest law's first two
    // tests are both IsPlayerInTown reads.
    gps: { locationType: () => _musicLocationType(), inLocationRect: () => _musicInLocationRect() },
    // H1: BuildingDirectory for the pixel the player is standing on.
    // Only this host holds the location index, and the houses-for-sale
    // law needs the whole building list rather than the one door the
    // player is looking at.
    buildingDirectory: () => {
      const loc = _questLoc();
      if (!loc) return null;
      // H2: the buildings must carry their KEYS. `loc.exterior.buildings`
      // is the raw BuildingData array and has none - H1 rolled its
      // houses-for-sale over it and handed out `buildingKey: undefined`,
      // so the house you were given was never yours.
      const px = built.get(`${playerTravelPixel().x},${playerTravelPixel().y}`);
      return {
        buildings: px?.locBlocks ? locationBuildings(loc.exterior?.buildings ?? [], px.locBlocks) : [],
        mapId: loc.mapTableData?.mapId ?? 0,
        regionIndex: loc.regionIndex ?? 0,
        locationName: loc.name ?? '',
        regionName: maps.getRegionName(loc.regionIndex ?? 0) ?? '',
        // H3: DFLocation.Exterior.ExteriorData.PortTownAndUnknown
        // (DFLocation.cs:578), read in exactly one place in DFU -
        // DaggerfallBankingWindow.cs:460, which refuses to sell a ship
        // outside a port town. formats/mapsFile.js has parsed the byte
        // since the map reader landed; nothing had ever asked for it.
        portTownAndUnknown: loc.exterior?.exteriorData?.portTownAndUnknown ?? 0,
      };
    },
    // AUDIT 39 (#22): PlayerEntity.SpawnCityGuards(bool), for the mode
    // machine's private-property theft arm (DaggerfallInventoryWindow
    // .AttemptPrivatePropertyTheft :1848-1859 raises the crime and
    // calls it). worldModes has read this key since the theft landed
    // and NO host supplied it, so the optional call no-opped: the
    // player robbed every house in the Bay and no watch ever came.
    // The immediate/witness split is what the bool means.
    // ROAD-B CLOSED THE FLAG THAT STOOD HERE. It read: "FLAGGED: DFU's
    // INDOOR arm spawns 2-5 guards at the interior's lowest outer door
    // (PlayerEntity.cs:628-641); this host's pool is the exterior
    // street, so the watch is waiting outside." The mode machine mints
    // its own watch pool with the interior now, and `_spawnGuards`
    // offers it the call first - so a theft in a shop is answered at
    // that shop's own door, and the street arm is what happens
    // everywhere else, as C# has it.
    spawnCityGuards: (immediate) => _spawnGuards(!!immediate),
    // G2: the arrest interception, for the mode machine's indoor
    // watch. The court flow and the overlay it opens are this host's,
    // so the interior pool asks through here instead of building a
    // second copy. Answers TRUE when the surrender box took the blow.
    onGuardHit: (dmg, apply) => arrestFlow.onGuardHit(dmg, apply),

    // Q4-v: the quest bridge + the scene context the NPC-data law needs
    questBridge,
    // S40: IsPlayerInTown() with BOTH flags at their defaults - the
    // location TYPE alone, no rect test, no inside test. That is what
    // CanRest's second arm asks (:563), and it is a different question
    // from isPlayerInTown above.
    inTownLocation: () => isPlayerInTown(_musicLocationType()),
    questSceneCtx: () => ({ mapId: _questLoc()?.mapTableData?.mapId ?? 0, locationIndex: _questLoc()?.locationIndex ?? 0 }),
    npcSession,   // TK-iv: the questor door on a static-NPC click
    // B4: the dungeon context quicksaves through the same composer
    // this host does - the trio + the bridge ride to it, and a
    // restored quest envelope latches _questStarted here exactly as
    // worldQuickLoad does (initAtGameStart must not re-run over a
    // restored machine).
    talkSave: { mill: rumorMill, tree: topicTree, session: npcSession },
    onQuestRestored: () => { _questStarted = true; },
    // R1: the discovery store's location key - the SAME string the
    // quest bridge's discoverBuilding uses, so the exterior lockpick
    // anti-grind record and the talk reveals share one namespace.
    discoveryLocationId: () => `${_questLoc()?.regionIndex ?? -1}:${_questLoc()?.name ?? ''}`,
    // G8 (guilds-8): the DiscoverRandomLocation seam for the guild
    // promotion reveals - candidates are the CURRENT pixel's region
    // (PlayerGPS.CurrentRegion; guild services only run inside town
    // buildings, so the pixel always carries a location). The
    // notebook note (readMapTG/readMapDB %map) - AUDIT 24 (wave 22):
    // the seam it "pended" is the notebook's own addNote, which wave 4
    // wired 340 lines above this. So the reveal has been happening and
    // the player has had no record of WHICH dungeon was revealed since
    // the day the guild promotions landed.
    // G5: THE TELEPORT DOOR. The guild service asks the host for a
    // travel map already armed for teleportation; only this host has
    // a streaming world to land in, so only this host answers. The
    // window is built here rather than in the interior arm because
    // its whole dependency list - maps, the player pixel, the climate
    // reader - is the world's.
    openTeleportMap,
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
    makeJournal: (mode) => makeJournalWindow(mode),
    useMagicItem: (item) => useMagicItem(item),   // UI1: MagicItemPicker's use, through the world host's one seam
    // TR5: the interior hosts dismount through the world host, which
    // owns the motor, the animator and the mount's art together.
    setTransportMode: (mode) => setTransportModeHere(mode),
    // PX17c: the pause window's journal seams ride into the interior
    // arm - the SAME expressions the world's own pause hands over
    // (PX3/PX4/PX5), so a pause inside a tavern shows the same rail,
    // separators and timers as one on the road.
    pauseQuestMessages: () => questBridge?.machine.getAllQuestLogMessages() ?? [],
    pauseQuestLog: () => {
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
    },
    revealLocation,
    magic, spellsByIndex: () => spellsByIndex,   // M2: the one cast engine + SPELLS.STD ride into the interior arm
    townTalk,   // U23: the interior host borrows FACTION.TXT/TEXT.RSC + the talk seam
    // A5b: the tavern arm needs the host's clock, and leaving one has to
    // hand the street back its own song - the host owns both, so both
    // ride in as closures rather than worldModes reaching for a global.
    voxelfolk: params.has('voxelfolk'),
    foes: !params.has('nofoes'),   // C11: foes are the DEFAULT now (monsters live; ?nofoes for the empty-dungeon dev view)
    playerClass: params.has('class') ? Number(params.get('class')) : undefined,
    playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined,
    playerWeapon: params.get('weapon') ?? undefined,
    paint: params.has('paint'),
    piece: params.has('piece') ? Number(params.get('piece') || 102) || 102 : 0,
    // uploadRecordFrame rides here too: worldModes hands this bag
    // straight to buildDungeonContext and buildInteriorContext, and
    // BOTH destructure it for their mobile-sprite draw. Leaving it
    // out did not fail loudly - it arrived as undefined and threw
    // `is not a function` on the first enemy frame in a dungeon
    // entered from this host, while the standalone ?dungeon scene
    // (which spreads the whole pipeline) was fine.
    pipeline: { getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, arch, palette, getMachineryParts },   // WM4b: the mill machinery's moving parts, for the interior arm
    doorTargets: () => buildingDoors.map((e) => ({
      ...e, door: shiftedDoor(e),
      dfLocation: locationIndex.get(e.pixelKey), group: e.pixelKey,
    })),
    // IS1: the save composer's doors for the interior mode's pause and
    // F9/F11 (GameManager.cs:570-586 dispatches the quick keys
    // scene-free). THE FOUR HOSTS: world.js hands its ONE composer in
    // here and worldModes' interior arm consumes it;
    // dungeonContext.js keeps its own composer (no buildings there);
    // exterior.js builds no save doors (the probe host).
    quickSave: () => worldQuickSave(),
    quickLoad: () => worldQuickLoad(),
    playerName: () => playerEntity.name,
    saveAs: (saveName) => worldQuickSave(saveName),
    loadKey: (key) => worldQuickLoad({ key }),
    // AUDIT 26 (F019): RMBLayout's exterior StaticNPCs, shifted through
    // the LIVE floating-origin translation exactly as shiftedDoor does
    // - the activation ray works in world space
    // (PlayerActivate.ActivateStaticNPC :741-767).
    npcTargets: () => {
      const out = [];
      for (const p of built.values()) {
        if (!p.npcs?.length) continue;
        const t = state.pixelTranslation(p.px, p.py);
        for (const pn of p.npcs) out.push({ ...pn, x: pn.x + t[0], y: pn.y + t[1], z: pn.z + t[2] });
      }
      return out;
    },
    // THE BULLETIN BOARDS, through the same LIVE floating-origin
    // translation the street NPCs ride - DFU's own hit is a world-space
    // raycast (PlayerActivate.cs:314, :393-398), so the box has to be
    // in the frame the ray is cast in. pickActivatable takes
    // {min,max}; the pixel keeps the 6-array the culling box uses.
    boardTargets: () => {
      const out = [];
      for (const p of built.values()) {
        if (!p.boards?.length) continue;
        const t = state.pixelTranslation(p.px, p.py);
        for (const b of p.boards) {
          out.push({
            min: [b.box[0] + t[0], b.box[1] + t[1], b.box[2] + t[2]],
            max: [b.box[3] + t[0], b.box[4] + t[1], b.box[5] + t[2]],
          });
        }
      }
      return out;
    },
    // ActivateBulletinBoard's news (:716) - the mill's SIGN face,
    // ported at TK-i and until now called by nothing.
    bulletinBoardNews: () => rumorMill.getNewsOrRumorsForBulletinBoard(),
    baseCollider: () => collider,
    // E2: one entered door -> its merged building identity. Door
    // positions resolve in the pixel's LOCATION frame (the raw
    // buildingDoors matrix is pixel-local; strip the location
    // origin); the name matches the directory only while the topics
    // pixel is the door's pixel (else '' - the window shows Shelves).
    buildingDataForDoor: (hit) => {
      if (!hit?.pixelKey) return null;
      const dfLoc = locationIndex.get(hit.pixelKey);
      const p = built.get(hit.pixelKey);
      if (!dfLoc || !p?.locBlocks || !p.locOrigin) return null;
      const raw = buildingDoors.find((e) => e.pixelKey === hit.pixelKey && e.dfBlock === hit.dfBlock && e.recordIndex === hit.recordIndex);
      const m = (raw ?? hit).door.matrix;
      const d = buildingDataForDoor(dfLoc.exterior.buildings, p.locBlocks, {
        dfBlock: hit.dfBlock, recordIndex: hit.recordIndex,
        position: [m[12] - p.locOrigin[0], m[13] - p.locOrigin[1], m[14] - p.locOrigin[2]],
      });
      if (!d) return null;
      return { ...d, regionIndex: dfLoc.regionIndex, name: townTalk.directory.find((e) => e.buildingKey === d.buildingKey)?.name ?? '' };
    },
  });
  // U31 / StartGameBehaviour :392-401. The streamer is already at the
  // start pixel; put the player INSIDE that location's dungeon, which
  // is where a new Daggerfall character opens their eyes. DFU gates
  // this on the same two things: the setting, and the location really
  // having a dungeon.
  //
  // NEVER TRAPS: if the entrance cannot be found the player is left
  // standing on the exterior at the dungeon's door rather than in a
  // half-built mode, and the reason is said out loud.
  // AUDIT 24 (the seven-slice sweep): LOAD GAME BOOTED A NEW GAME.
  // main.js sets ?load when the menu resolves it, and its comment says
  // "Load Game rides the dungeon host's OWN quickLoad" - true when the
  // classic start booted scenes/dungeon.js, and U31 moved it HERE. The
  // only reader of `load` in the whole tree is dungeon.js:84, so the
  // flag arrived in this host and was discarded: the player got a
  // brand-new character in Privateer's Hold and the only way to reach
  // their save was to start a new game and press F11. A load is not a
  // new game, so it takes the classic start's place rather than
  // running after it.
  if (params.has('classicload') && peekPendingClassicSave()) {
    // SAV3: the classic import takes the load's place in the boot walk
    // - a load by another door, never a new game (the AUDIT 24 law).
    status('importing the classic save');
    await classicLoadBoot();
  } else if (params.has('load')) {
    status('loading the saved game');
    // SAV4: the start menu's slot window boots with the PICKED key;
    // a bare ?load keeps the most-recent shape.
    await worldQuickLoad(params.has('loadkey')
      ? { key: Number(params.get('loadkey')) }
      : { mostRecent: true });
  } else if (params.has('classic') && getBool('Startup', 'StartInDungeon') && startLoc.hasDungeon) {
    status('entering the dungeon');
    const entered = await modes.startInDungeon();
    if (!entered) console.warn('[world] no dungeon entrance at the start cell; starting outside');
  }
  if (shotMode) { modes.installShotProbes(); installTownProbes(); }
  if (shotMode) window.__magic = () => JSON.stringify({ mp: playerEntity.magicka, readied: magic.readied()?.name ?? null, armed: magic.spellArmed(), missiles: magic.missileCount(), mode: modes?.mode ?? 'exterior', book: (playerEntity.spells ?? []).map((sp) => ({ name: sp.name, range: sp.rangeType })) });   // M5 cast probe
  if (shotMode) {
    // F-slice probe surface: the travel state + the nearest real
    // destination at least two pixels out (the live probe types its
    // name into the real window).
    window.__travelProbe = () => JSON.stringify({ pixel: playerTravelPixel(), minutes: Math.floor(playerTicker.classicMinutes), gold: goldAmount(playerEntity) });
    // U42: the classic spellbook's live state. Its buttons are hit
    // rects painted into SPBK00I0, so a probe cannot see what it is
    // clicking - it reads the selection, the pushed box and the rows
    // back through here instead of sleeping and hoping.
    window.__spellbook = () => JSON.stringify(_spellbook && !_spellbook.done ? {
      buyMode: _spellbook.buyMode, selected: _spellbook.selectedIndex,
      scroll: _spellbook.scrollIndex, top: _spellbook.top,
      name: _spellbook.selected?.name ?? null,
      effects: [0, 1, 2].map((i) => _spellbook.effectLabels(i)),
      rows: _spellbook._rows.map((r) => ({ text: r.text, dim: r.dim })),
    } : null);
    // U41: the art window's live state - which page is open, what the
    // label reads, which box or sub-window is up, and the popup's
    // numbers. The keyed stand-in could be driven blind; a click
    // surface cannot.
    // U61: the enhanced overworld carries its own probe surface
    // (globalThis.__overworld); this one reads the CLASSIC window's
    // shape and answers null for the other skin rather than throwing
    // on fields it does not have.
    window.__travelMap = () => JSON.stringify(_travelMap && !_travelMap.done && _travelMap.regionLabelText ? {
      regionSelected: _travelMap.regionSelected, region: _travelMap.selectedRegion,
      label: _travelMap.regionLabelText(), top: _travelMap.top,
      picker: _travelMap.picker ? _travelMap.picker.items.length : 0,
      popUp: !!_travelMap.popUp, identifying: _travelMap.identifying,
      locationSelected: _travelMap.locationSelected, find: _travelMap.findText,
      days: _travelMap.popUp?.countdownValueTravelTimeDays ?? null,
      cost: _travelMap.popUp?.trip?.totalCost ?? null,
      // G5: the teleport arm's own state, which is deliberately NOT
      // the popUp field - see the note on the window's telePopUp.
      armed: _travelMap.teleportationTravel,
      telePopUp: _travelMap.telePopUp
        ? { name: _travelMap.telePopUp.destination.name, pixel: _travelMap.telePopUp.destination.pixel }
        : null,
      save: _travelMap.getTravelMapSaveData(),
    } : null);
    /** G5: open the travel map ARMED, the way the guild service does,
     *  and drive its teleport box - the map is the same map, so the
     *  probe reaches it through the host's own opener. */
    window.__openTeleportMap = () => {
      const win = openTeleportMap();
      if (!win) return null;
      _travelMap = win;
      townTalk.showOverlay(win);
      return window.__travelMap();
    };
    window.__teleportAnswer = (yes) => {
      if (!_travelMap?.telePopUp) return null;
      _travelMap.telePopUp.input(yes ? 'KeyY' : 'KeyN');
      if (_travelMap.telePopUp?.done) _travelMap.telePopUp = null;
      return window.__travelMap();
    };
    window.__encounters = () => JSON.stringify({ active: exteriorFoes.activeCount(), foes: exteriorFoes.foes.filter((f) => !f.dead).map((f) => ({ type: f.mobileType, dist: +f.ai._dist.toFixed(1), detected: f.ai.detected })) });
    window.__spawnEncounter = (type, dist = 10) => {
      const pf = walkMode && playerSpawned ? player.pos : cam.pos;
      return exteriorFoes.spawnFoe(type, [pf[0] + dist, pf[1] + 1, pf[2]]).then((f) => (f ? f.mobileType : null));
    };
    // X2/X3 probe surface: the live exterior-combat state
    window.__x23 = () => JSON.stringify({
      hp: playerEntity.health,
      enemyArrows: arrows.arrows.filter((a) => !a.dead && a.enemy).length,
      missiles: magic.missileCount(),
      foes: exteriorFoes.foes.filter((f) => !f.dead).map((f) => ({
        type: f.mobileType, dist: +f.ai._dist.toFixed(1), detected: f.ai.detected,
        bow: !!f.attack.rangedAttack, caster: !!f.caster, spells: f.entity.spells?.length ?? 0, mp: f.entity.magicka ?? 0,
      })),
    });
    window.__travelNearest = () => {
      const p0 = playerTravelPixel();
      let best = null, bd = Infinity;
      for (const summary of mapDict.values()) {
        // G8 made HIDDEN dungeons unfindable on the map; the probe's
        // nearest must honour the same gate or it names a place the
        // search cannot list. W1: that gate is now the window's own
        // checkLocationDiscovered - the baked flag OR the store.
        if (!summary.discovered && !hasDiscoveredLocationId(summary.id)) continue;
        const pixel = getPixelFromPixelID(summary.id);
        const d = Math.max(Math.abs(pixel.x - p0.x), Math.abs(pixel.y - p0.y));
        if (d >= 2 && d < bd) { bd = d; best = { summary, pixel }; }
      }
      if (!best) return JSON.stringify(null);
      const region = maps.getRegion(best.summary.regionIndex);
      return JSON.stringify({
        name: region?.mapNames?.[best.summary.mapIndex] ?? '',
        region: maps.getRegionName(best.summary.regionIndex),
        pixel: best.pixel, type: best.summary.locationType,
        mapId: best.summary.mapID, discovered: true,
      });
    };
  }
  window.__readyRanged = () => { const sp = rangedDamageSpells(spellsByIndex).map((x) => [calculateCastCost(x, playerEntity).sp, x]).sort((a, b) => a[0] - b[0])[0]?.[1]; magic.setReadied(sp); return sp ? `${sp.name}:${calculateCastCost(sp, playerEntity).sp}` : null; };   // M5: no classic starting set carries a missile spell - ready the cheapest flier for the flight leg

  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);   // A3
  let _lastPlayerPos = null, _playerStill = false;   // T2: the politeness still-tracker
  const _camRight = new Float32Array(3);   // EV2: the billboard right axis, refilled per frame
  // EV3: THE FRUSTUM. The hatch reads once at build (?cull=off, the
  // ?sky=classic shape - a wrong bound in the field is a URL away from
  // proof); the planes refill per frame from the SAME proj*view the
  // draws ride, so the handedness mirror is inside the planes too.
  const cullOn = !cullDisabled();
  const _planes = new Float32Array(24);
  const _pv = new Float32Array(16);
  // A4: the streaming world's animal sources - pixel-local positions
  // translated through the floating origin at roll time (16 Hz over
  // a handful of animals; recenters are free).
  const animalAmbience = createAnimalAmbience(audio, () => {
    const out = [];
    for (const p of built.values()) {
      if (!p.animals || !p.animals.length) continue;
      const t = state.pixelTranslation(p.px, p.py);
      for (const a of p.animals) out.push({ pos: [a.pos[0] + t[0], a.pos[1] + t[1], a.pos[2] + t[2]], sound: a.sound });
    }
    return out;
  });
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
    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];   // HANDEDNESS (mat4's law): screen-right = (cos, 0, -sin) under the mirrored projection - Unity's own right

    // Modal frame (worldModes.js): interior/dungeon consume the frame
    // entirely - the early return also freezes streaming (the
    // context-local player position must never feed the recenter logic).
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
      // WM4c: the exterior parent is inactive indoors in DFU and its
      // AudioSources stop with it; the mills fall silent and the
      // per-frame retry restarts them on the way out.
      for (const p of built.values()) for (const w of p.windmills) { w.hum?.stop(); w.hum = null; }
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
      capturePendingScreenshot(canvas);   // SS1: a save armed from a modal mode still lands its shot
      requestAnimationFrame(frame);
      return;
    }

    // Q4-v: the quest machine's EXTERIOR tick (the modal arms tick
    // inside modes.frame). REAL seconds - QuestMachine.Update
    // accumulates Time.deltaTime, and DFU's TimeScale setting scales
    // the calendar, never Unity time, so ?timescale does not touch
    // this - held by the pause law (PauseGame -> timeScale 0 ->
    // deltaTime 0) through the same overlay gate as the clock, and by
    // the load gate (QuestMachine.cs:310-316 refuses to tick while
    // SaveLoadManager.LoadInProgress - no popups mid-restore).
    if (!townTalk.overlayActive && !_loading) questBridge.tick(dt);

    // AUDIT 39 (S19 host gap): PARALYSIS, above ground. Every DFU gate
    // reads PlayerEntity.IsParalyzed with no interior/exterior test -
    // FrictionMotor.GroundedMovement (:75-81) and
    // AcrobatMotor.CheckAirControl (:135-141) zero the movement input,
    // HandleJumpInput (:64-70) and LevitateMotor.Update (:67-69)
    // return, WeaponManager (:235-239) does ShowWeapons(false) and
    // takes no swing. Only the dungeon hosts carried it, and a spider
    // or scorpion out of the wilderness encounter tables casts Spider
    // Touch (exteriorFoes.js castParalyze), so the landed paralysis
    // was inert here. Declared above `walkMode` because the motor and
    // the weapon rig are two sibling blocks.
    const paralyzed = entityIsParalyzed(playerEntity);
    // A6: FrictionMotor.GroundedMovement's head-dip guard reads
    // IsParalyzed itself (:90-93) - the zeroed input bag below is
    // the movement half of the same law, not this one.
    player.paralyzed = paralyzed;

    if (walkMode) {
      // ROAD-Ar (R0): the season re-skin's hold, released the moment
      // the player's own pixel is BUILT again - the same shape as the
      // boot gate right below, which holds the motor until the start
      // pixel stands. The `!building && !queue.length` arm is the
      // dead-man's release: a pixel that never comes back must not
      // freeze the game for ever, and re-anchoring there is what keeps
      // the outage off the fall ledger. player.spawn IS the re-anchor
      // (fallStart = y, falling cleared) - _teleportToPixel's own tail.
      if (_seasonHoldKey !== null && (built.has(_seasonHoldKey) || (!building && !queue.length))) {
        player.spawn(player.pos[0], player.pos[1], player.pos[2]);
        _seasonHoldKey = null;
      }
      const _seasonHeld = _seasonHoldKey !== null;
      if (!playerSpawned && built.has(startKey)) {
        // Stand on the terrain once the start pixel's collider is up -
        // FixStanding from 2u above it, not a drop from there.
        const stand = floorLanding(collider, [cam.pos[0], heightAt(cam.pos[0], cam.pos[2]) + 2, cam.pos[2]]);
        player.spawn(stand[0], stand[1], stand[2]);
        playerSpawned = true;
      }
      if (playerSpawned) {
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
        running: player.isRunning && !player.standing,   // AUDIT 23 (entity-2): PlayerEntity.cs:408
        swimming: player.swimming,
        climbing: !!player.climb?.isClimbing,   // AUDIT 26 F083: the band's first arm (:405-408)
        jumped: player.jumped,   // C6: the per-jump drain+tally ride the tick
      });
        // AUDIT 18 HOST GAP: levitate/waterWalking/slowFall were
        // written ONLY inside the dungeon branch of worldModes and
        // never cleared, so leaving a dungeon while levitating
        // stranded the player in the motor's no-gravity branch
        // forever. The EFFECT owns the flag (Levitate.cs:131/:136),
        // so it is recomputed per frame in every host; swimming is
        // false outdoors (no blockWaterLevel - PlayerEnterExit).
        applyMotorEffectFlags(player, playerEntity);
        const mv = moveHeld(keys);
        // AUDIT 28 W8: the axes advance only on frames the motor runs (a
        // held overlay is DFU's timeScale 0 - no climb, no friction).
        const axes = _overlayHeld ? { forward: moveAxes.vertical, strafe: moveAxes.horizontal } : moveAxes.update(dt, mv);
        const moving = !paralyzed && anyMove(mv);   // AUDIT 39: dungeon.js:462's shape - a frozen player takes no stride
        // Audit F3: the crouch toggle stays LIVE while paralyzed - DFU
        // gates movement and the jump only (DecideHeightAction has no check).
        // AUDIT 39r: and so does the SPEED-ADJUSTMENT capture. DFU zeroes the
        // movement VECTOR (FrictionMotor :75-81, AcrobatMotor :135-141);
        // CaptureInputSpeedAdjustment runs in Update behind a levitate gate
        // and nothing else. Dropping run/sneak/autoRun/back from this bag read
        // as a RELEASE to the motor's press-edge latches, so a key held
        // through the paralysis fired a synthetic press on the frame it lifted.
        // ROAD-Ar (R0): ...and the season hold stops the motor dead,
        // because there is no floor under it while the re-skin runs.
        if (!_overlayHeld && !_seasonHeld) player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: held(keys, 'Run'), autoRun: held(keys, 'AutoRun'), back: mv.backwards, sneak: held(keys, 'Sneak'), jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
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
        // a12: SwitchHand (H) - WeaponManager.cs:272 reads it through
        // ActionComplete, the RELEASE edge, so the latch is inverted
        // against Z's above. The rig owns the isAttacking gate.
        const hNowW = held(keys, 'SwitchHand');
        if (!hNowW && hPrevW) weaponRig.switchHand();
        hPrevW = hNowW;
        // P14 fall damage (host parity - CheckFallingDamage +
        // PlayerHealth verbatim; sounds 91/92). FD1 took the
        // outdoor-water exemption off the board: playerGroundTile is
        // FS1's probe and isOutdoorWaterTile is DFU's
        // PlayerTileMapIndex == 0, so a landing in a lake now costs
        // neither HP nor the hard-fall grunt. A null tile - the
        // player over a pixel still streaming - is DFU's -1 and takes
        // the damage, which is the safe direction: a missed exemption
        // costs HP, an over-eager one makes every fall free. Death at
        // 0 rides the shared entity; the exterior death screen pends
        // with the world-mode UI arc.
        // ROAD-Ar (R0): a held motor reports no landing - landedFallDistance
        // is only cleared by update(), so billing it on a frame the motor
        // never ran would charge the same fall once per held frame.
        if (!_seasonHeld) applyFallLanding(playerEntity, player.landedFallDistance, {
          sound: (id) => audio.playOneShot(id),
          inOutdoorWater: isOutdoorWaterTile(playerGroundTile()),
        });
        // ROAD-B (b3): the exterior surface model, recomputed every
        // frame exactly where PlayerMotor.Update recomputes it
        // (:367-369) and BEFORE the consumers below read it.
        const _surf = exteriorSurfaceNow();
        // PlayerHeightChanger reads `OnExteriorWater == Swimming` and
        // only that (:127, :294, :326, :550) - WaterWalking never sinks
        // the capsule. A6 declared the flag and left it false with
        // "Wave B's exterior-water slice owns the model that raises
        // it"; this is that raise.
        player.onExteriorWater = _surf.water === ON_EXTERIOR_WATER.Swimming;
        // FS-slice: PlayerFootsteps - the exterior stride (snow by
        // season + CLIMATE.PAK; the path/water/static-geometry arms
        // ride the surface model above).
        {
          const _p = playerTravelPixel();
          // PlayerFootsteps.cs:116 - "Play splash footsteps whether
          // player is walking on or swimming in exterior water", so
          // BOTH non-None methods feed this one boolean.
          const _onWater = _surf.water !== ON_EXTERIOR_WATER.None;
          const _step = footsteps.update(player.pos, {
            grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
            standingStill: !moving,
            halfSpeed: player.movingLessThanHalfSpeed,
            // :221-227 - a mount silences the stride UNLESS the player
            // is in exterior water, which is the one arm that needs
            // the method rather than the boolean.
            onFoot: isOnFoot(player.transportMode),
            onExteriorWater: _onWater,
          }, pickFootstepSet({
            inside: false,
            winter: season === SEASON.Winter,
            climateIndex: maps.getClimateIndex(_p.x, _p.y),
            onExteriorWater: _onWater,
            // PlayerMotor.OnPathTile (:568-574) is tile records 46, 47
            // and 55 - real terrain data, read through the same
            // tilemap byte the water arm reads. The old note here
            // ("the road system it was wired to is gone") was about a
            // separate roads mod; the CLASSIC path tiles were always
            // in the tilemap and are what DFU actually consults.
            onExteriorPath: _surf.path,
            onStaticGeometry: _surf.staticGeometry,
          }));
          if (_step) audio.playOneShot(_step.clip, _step.volume);
        }
        // EV1: the interpolated render eye. AUDIT EV F-SIM5: rays and
        // the audio listener read cam.pos too - DELIBERATE (a pick
        // hits what is on screen; divergence from player.eye is under
        // one physics step). `eye` stays the simulation's truth.
        cam.pos = player.eyeAt();
        // DC1: PlayerDeath.Update's camera sink - while the death
        // overlay runs, the eye rides down the sequence's drop (the
        // fresh array from player.eye makes this per-frame, never
        // cumulative). The player does not move; only the camera dies.
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
        // no host passed. `paused` is InputManager's own return under
        // an open window (:486-503, "GUI actions do not fall-through
        // to main world") and carries RemoveWindow's 0.3 s click
        // delay with it; `hudBlocked` is PlayerActivate.cs:230-236;
        // `touchSpell` is its stated exception at :250-258.
        // AbortSpell; a recorded departure). ROAD-Ar R10: the swing
        // is the raw right button - DFU's own 'Mouse1' (:1010) - but
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
          const useFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
          // QG1: the quest-resource click arm runs FIRST and does not
          // consume the activation (PlayerActivate.cs:325-339 - the
          // Hit Checks region's opening arm, no return, skipped in
          // Info mode). A live foe carrying a QuestResourceBehaviour
          // takes the click through its own DoClick, and the ladder
          // below still runs - exactly the C# fall-through.
          if (getInteractionMode() !== 'info') {
            const qf = pickQuestFoe(cam.pos, useFwd, [...exteriorFoes.foes, ...cityGuards.guards], collider);
            if (qf) qf.questBehaviour.doClick();
          }
          if (!townTalk.tryActivate(cam.pos, useFwd, _livePersons)) {
            // AUDIT 24 (wave 38): BOTH corpse pools go into ONE pick.
            // The watch and the encounter foes leave the same container
            // type, so which body you open is PlayerActivate's nearest
            // hit, not which pool the host happens to ask first - and
            // until this wave the host never asked the encounter pool
            // at all, so its corpses could not be opened by anyone.
            const corpseTargets = [...cityGuards.lootTargets(), ...exteriorFoes.lootTargets()];
            const lootKey = pickActivatable(cam.pos, useFwd, corpseTargets, collider);
            const dropKey = lootKey ? null : pickActivatable(cam.pos, useFwd, droppedLoot.lootTargets(), collider);
            if (lootKey) {
              const pool = lootKey.startsWith('foeCorpse:') ? exteriorFoes : cityGuards;
              pool.takeLoot(lootKey, (l) => townTalk.say(l));
              surfacePlayer();
            }
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
      }
    } else {
      const speed = (keys.has('ShiftLeft') ? 400 : 40) * dt;   // fly-cam (dev): raw keys, not an action
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;   // fly-cam (dev)
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;   // fly-cam (dev)
    }

    // Streaming step: recentre, enqueue new pixels, drop far ones.
    const wasMapPixel = { x: state.current.x, y: state.current.y };   // state.update overwrites it; PlayerGPS's lastMapPixelX/Y
    const r = state.update(cam.pos);
    if (r.offset) {
      // FloatingOrigin.OffsetPlayerController (:176-181) adjusts the
      // fall start BEFORE it moves the controller - without it a
      // vertical recenter mid-air bills the whole 500-unit shift as a
      // fall (trunc(5 * 495) = 2475 HP from a two-metre hop), or bills
      // a killing fall as nothing when it crosses downward.
      adjustFallStart(player, r.offset[1]);
      cam.pos[0] += r.offset[0]; cam.pos[1] += r.offset[1]; cam.pos[2] += r.offset[2];
      player.offsetOrigin(r.offset);   // EV1: shifts BOTH ends of the interpolation span - no 819-unit lerp frame
      // AUDIT 17e F23: everything else holding a WORLD position must
      // follow the origin too, or it strands 819.2 units behind.
      cityGuards.offsetAll(r.offset);
      exteriorFoes.offsetAll(r.offset);   // X-slice
      droppedLoot.offsetAll(r.offset);
      hitEffects.offsetAll(r.offset);   // AUDIT 24 (wave 39): a splash mid-animation follows the origin too
      // AUDIT 18: this line used to be an optional call to a method
      // ArrowFlight has never had, so it was swallowed every time and
      // every in-flight arrow was stranded 819.2 units behind.
      offsetArrows(arrows, r.offset);
      // AUDIT 24 (the seven-slice sweep): and the SPELL missiles, the
      // one world-position pool this block never reached. The comment
      // three lines up says "everything else holding a WORLD position
      // must follow the origin too" and then listed four of five.
      magic.offsetAll(r.offset);
      // EV1: the two recenter misses the jitter lane found - the
      // stride anchor (a spurious footstep per crossing) and the
      // stillness gate's last-position (one false "moving" frame).
      footsteps.rebase();
      if (_lastPlayerPos) { _lastPlayerPos[0] += r.offset[0]; _lastPlayerPos[1] += r.offset[1]; _lastPlayerPos[2] += r.offset[2]; }
    }
    if (r.pixelChanged) {
      // P1: PlayerGPS.Update (:329-339). The map pixel changed, so
      // the world has moved on - "Clear non-permanent scenes from
      // cache, unless going to/from owned ship". Everything the
      // player rearranged in an ordinary interior (emptied shelves,
      // dropped loot, opened doors) is forgotten here; a PERMANENT
      // scene - a rented room, a bought house, the ship - keeps its
      // loot across the clear, minus its corpse markers. The ship
      // exception is the one place a non-permanent scene survives:
      // DFU skips the clear entirely when either end of the move is
      // the ship's own pixel (GetShipCoords answers null with no
      // ship, and the whole test collapses to "always clear").
      const ship = shipCoords(playerEntity);
      const toOrFromShip = !!ship && ((r.current.x === ship.x && r.current.y === ship.y)
        || (wasMapPixel.x === ship.x && wasMapPixel.y === ship.y));
      if (!toOrFromShip && playerEntity.sceneCache) {
        clearSceneCache(playerEntity.sceneCache, { start: false });
      }
      queue.push(...r.load);
      for (const u of r.unload) {
        destroyPixel(u.px, u.py);
        state.release(u.px, u.py);
      }
      // EV4: surviving pixels whose ring class changed with the walk
      // swap their terrain surface (full-res core <-> strided far ring).
      for (const p of built.values()) {
        const want = strideFor(p.px, p.py);
        if (want !== p._stride) restrideTerrain(p, want);
      }
      console.log(`stream: entered ${r.current.x},${r.current.y} (load ${r.load.length}, unload ${r.unload.length})`);
    }
    pump();

    const proj = mirrorProjectionX(perspective(fieldOfView(), canvas.clientWidth / canvas.clientHeight, 0.2, 6000));   // HANDEDNESS (mat4's law)
    // MW-D25: the eye goes through the Morrowind camera machine - in
    // first person it comes back untouched (camera.cpp:165-169), in
    // third it is the reference's focal-and-pull-back with this host's
    // collider standing in for the sphere cast.
    const mwv = mwViewFrame({
      fpEye: cam.pos, feet: player.pos, yaw: cam.yaw, pitch: cam.pitch,
      raycast: (o, d, m) => collider.raycast(o, d, m),
    });
    const view = lookAt(mwv.eye, [mwv.eye[0] + fwd[0], mwv.eye[1] + fwd[1], mwv.eye[2] + fwd[2]], [0, 1, 0]);
    // World clock (R5): sun, ambient, window style, sky frame by time.
    const minute = minuteNow();
    // A1: DaggerfallLocation.Update's season poll (:118-130), on the
    // exterior frame with the weather drain - the reference runs it in
    // the location's own Update, which is the same place.
    tickSeason();
    // W1/S41: the DRAIN ticks on the exterior frame, which is
    // WeatherManager.Update's own shape - it returns while the player
    // is inside, so a sky rolled by a day spent indoors or underground
    // lands on the first frame back out. The ROLL is the entity tick's
    // day block, and runs wherever the player is. A pinned ?weather
    // never ticks.
    if (!weatherOverride) {
      const _pp = playerTravelPixel();
      tickWeather(Math.floor(playerTicker.classicMinutes), maps.getClimateIndex(_pp.x, _pp.y));
      // drift-aware: a dungeon-side quickload restores the SIM but not
      // this host's derived lets - re-derive whenever they disagree
      if (currentWeather() !== weather) applyWeather(currentWeather());
    }
    // A3: the exterior ambience (WeatherAmbientEffects 5/25) - the
    // weather/time preset per WeatherManager.SetAmbientEffects.
    audio.setListener(cam.pos, fwd);
    ambience.setPreset(presetForExterior(weather, isNight(minute)));
    ambience.update(dt, { playerPos: cam.pos });
    animalAmbience.update(dt, cam.pos);   // A4: town animal barks (PlayRandomlyIfPlayerNear)
    // Storm lightning strobe. AUDIT 39 (#14): ENHANCED-SKIN ONLY -
    // shipped DFU renders no flash (PlayLightningEffect is 0 on both
    // AmbientEffectsPlayer instances and LightForEffects is unassigned,
    // so the storm is sound-only, and the line this models sets an
    // absolute intensity on that separate light, not the sun). The
    // player ticks on both skins: the clip schedule is the Audio arc's.
    const strobe = lightning ? lightning.tick(dt) : 1;
    const flash = params.has('flashtest') ? 2 : (isEnhanced() ? strobe : 1);
    // EV5: the moons light the night - the masser as a second key, the
    // secunda folded into the ambient. null by day and under classic.
    const moonNow = sky.moonlight();
    renderer.setMoonlight(moonNow);
    renderer.setLighting(
      withMoonAmbient(exteriorAmbient(minute, getFloat('Enhancements', 'NightAmbientLightScale', 0, 1), weatherSun), moonNow), sunScale(minute) * weatherSun * flash * sky.sunFactor(),   // ES1d: the cloud in front of the sun takes the KEY light (never the ambient - the sky still lights the ground)
      new Float32Array(SUN_RIG_COLOR));
    // R12: the player-following indirect light rides the camera in
    // the streaming world (walk mode keeps cam at the player's eye).
    {
      const iScale = indirectLightScale(minute) * weatherSun;
      renderer.setIndirectLight(cam.pos, INDIRECT_LIGHT_RANGE, new Float32Array([
        INDIRECT_LIGHT_COLOR[0] * iScale, INDIRECT_LIGHT_COLOR[1] * iScale, INDIRECT_LIGHT_COLOR[2] * iScale,
      ]));
    }
    renderer.setWindowEmission(windowEmissionRGB(
      params.has('window') ? params.get('window')
        : (windowStyleForWeather(weather) ?? windowStyleForTime(minute))));
    const currentEntry = built.get(`${state.current.x},${state.current.y}`);
    // DaggerfallSky.cs:363-367 - a non-Normal WeatherStyle (every rain,
    // thunder and snow) disables the clear night sky, so the DAY sky at
    // frame 0 is drawn instead. weatherSkyOffset IS the WeatherStyle
    // (Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7; Normal is 0).
    // AUDIT 23 (wts-1): the Normal-weather sky adds the CALENDAR season
    // (DaggerfallSky.cs:354-357); rain/snow keep their boot variant.
    sky.use((currentEntry ? currentEntry.skyBase : 16) + (weatherSkyOffset === 0
      ? seasonValue(dateFromClassicMinutes(playerTicker.classicMinutes)) : weatherSkyOffset), minute, weatherSkyOffset === 0,
    { weather, classicMinutes: playerTicker.classicMinutes });   // ES1: the enhanced sky's clouds and moons
    // Verbatim: fog is never disabled (SetFog keeps RenderSettings.fog on);
    // Sunny/Overcast ARE linear fog to 2400 - the classic distance haze.
    // DaggerfallSky.SetSkyFogColor (:318-325): anything denser than
    // heavy rain fogs to Color.gray, not to the sky tint.
    const fogColor = outdoorFogColor(weatherFog, sky.renderer.clearColor);
    renderer.setFog(weatherFog.mode,
      weatherFog.density, weatherFog.start, weatherFog.end, fogColor);
    sky.renderer.fogColor = fogColor;
    sky.renderer.fogMix = weatherFog.excludeSky ? 0 : 1 - fogFactor(weatherFog, 800);

    // Lanterns on 17:00-08:00, flickering verbatim; pixel-local lights
    // placed under the current compensation, nearest 16 to the camera.
    if (lightsOnAt(minute)) {
      worldLightAnimator.tick(dt);
      const sceneLights = [];
      for (const p of built.values()) {
        if (!p.lights.length) continue;
        const t = state.pixelTranslation(p.px, p.py);
        for (const l of p.lights) {
          sceneLights.push({ x: l[0] + t[0], y: l[1] + t[1], z: l[2] + t[2] });
        }
      }
      renderer.setPointLights(
        withPlayerLights(nearestLights(sceneLights, cam.pos, 16, worldLightAnimator.ranges),
          magic?.candleLight(), playerTorchLight(playerEntity, player.pos, cam.yaw)),   // X11 candle; T1 torch
        CITY_LIGHT_COLOR_F32
      );
    } else {
      // X11: the candle burns by day too - StartLight has no time gate
      // (the lantern one is DaggerfallLight's, not the effect's), and
      // this branch used to send the renderer an empty array, so a
      // daylight Light cast would have lit nothing at all.
      renderer.setPointLights(withPlayerLights(new Float32Array(0),
        magic?.candleLight(), playerTorchLight(playerEntity, player.pos, cam.yaw)), CITY_LIGHT_COLOR_F32);
    }
    renderer.beginFrame(proj, view, sunDirection(minute));
    sky.draw(cam.yaw, cam.pitch, fieldOfView(), canvas.clientWidth / canvas.clientHeight);
    // EV8: the far province ring - the horizon's actual mountains,
    // drawn while the depth buffer is still the sky's (the streamed
    // world repaints everything nearer). Skipped when exp fog owns
    // the air (rain, snow, heavy fog); its light state is the frame's
    // own, already installed by setLighting/beginFrame above. It
    // shares the EV6 seam mark below - one foreign span, two passes.
    if (farRing && weatherFog.mode === 'linear') {
      if (farRing.needsRebuild(state.current.x, state.current.y)) {
        farRing.build({
          heightBytes: woods.heightMapBuffer, mapWidth: MAP_WIDTH, mapHeight: MAP_HEIGHT,
          climateAt: (x, y) => maps.getClimateIndex(x, y),
          baseX: state.current.x, baseY: state.current.y,
        }, state.current.x, state.current.y, state.terrainDistance);
      } else {
        farRing.punchHole(state.current.x, state.current.y, state.terrainDistance);
      }
      farRing.draw(view, {
        origin: state.pixelTranslation(farRing.baseX, farRing.baseY, _ringOrigin),
        lightDir: renderer._lightDir, ambient: renderer._ambient,
        sunScale: renderer._sunScale, sunColor: renderer._sunColor,
        // AUDIT EV F-R4: the same moon the streamed terrain takes -
        // without it a full-Masser night stepped in brightness at the
        // exact boundary the hole machinery works to hide
        moonDir: renderer._moonDir, moonScale: renderer._moonScale, moonColor: renderer._moonColor,
        fogColor, fogEnd: weatherFog.end,
        fovY: fieldOfView(), aspect: canvas.clientWidth / canvas.clientHeight,
      });
    }
    renderer.markForeignPass();   // EV6: the sky (and EV8's ring) changed programs behind the shadows' back
    // MW-D24: the player's own body, in third person only.
    mwViewDrawBody(canvas, { proj, view, eye: mwv.eye, feet: player.pos, yaw: cam.yaw });
    // MW-D42: THE HORSE UNDER YOU, world-space with the character
    // pass's full lighting - the CFA sprite's 1:1 lane yields only
    // while this actually stands (the draw below checks pegas again).
    // Gait rides the same motor flags the sprite's animator reads;
    // airborne holds the stride (horseGaitClip answers null). Paused
    // HIDES, the sprite's own F-E1 law - no advance, no draw.
    if (pegas && player.transportMode === TRANSPORT_MODES.Horse
      && !(townTalk.overlayActive || (modes?.overlayHeld ?? false))) {
      const clip = horseGaitClip({
        standingStill: player.standing, grounded: player.grounded,
        movingLessThanHalfSpeed: player.movingLessThanHalfSpeed,
      });
      if (clip && !pegas.setClip(clip)) pegas.setClip(HORSE_CLIPS.still);   // fall back a gait, never a dead horse
      pegas.advance(clip ? dt : 0);
      renderer.drawCharacter(pegas.mesh, horseModelMatrix(player.pos, cam.yaw));
    }

    // WM2b: read the eased wind ONCE a frame, not once a mill.
    const windNow = sky.wind();
    if (cullOn) frustumPlanes(multiply(proj, view, _pv), _planes);   // EV3
    const allBatches = [];
    for (const p of built.values()) {
      // EV2: the pixel's frame matrix caches on the built entry and
      // refreshes only when its translation actually changes (a
      // recenter - not per frame), and each model's world matrix
      // caches beside it: `trs` + `multiply` here minted two fresh
      // Float32Array(16)s PER MODEL PER FRAME, the render loop's
      // second-largest GC source after drawMesh's string keys.
      const t = state.pixelTranslation(p.px, p.py, p._t || (p._t = [0, 0, 0]));
      let pixelMatrix = p._pixelMatrix;
      if (!pixelMatrix) pixelMatrix = p._pixelMatrix = identity();
      if (pixelMatrix[12] !== t[0] || pixelMatrix[13] !== t[1] || pixelMatrix[14] !== t[2]) {
        pixelMatrix[12] = t[0]; pixelMatrix[13] = t[1]; pixelMatrix[14] = t[2];
        p._worldGen = (p._worldGen | 0) + 1;   // every cached model matrix refreshes
      }
      // EV3: the pixel gate - one p-vertex test against the build-time
      // bounds skips the terrain draw, every model and every flat batch
      // of a pixel wholly off-screen; a visible pixel then tests each
      // model and batch against its own build-time box. SIMULATION never
      // gates: the rotor's angle, the mill's hum and the flats' clocks
      // all run for a pixel behind the camera.
      const pixelVisible = !cullOn || !aabbOutside(_planes, p._box, t[0], t[1], t[2]);
      if (pixelVisible) {
        // EE5: the ground shadows under the SKY'S OWN deck - one field for the
        // cloud and for the shadow it casts. Null when there is no enhanced
        // sky, which is the classic skin and every interior.
        renderer.setCloudShadow(sky?.cloudShadow ?? null);
        renderer.drawTerrain(p.terrain, pixelMatrix,
          renderer.tileArrayFor(p.groundArchive), p.tilemapTex, 6.4, renderer.tileNormalFor(p.groundArchive) /* EE6 */);
        // EE7: the pixel's grass, after its terrain and inside the same
        // cull - a pixel that is not drawn has no grass drawn either
        if (p.grass) renderer.drawGrass(p.grass, pixelMatrix, performance.now() / 1000, sky?.cloudShadow ? { dir: sky.cloudShadow.wind[0] || sky.cloudShadow.wind[1] ? [sky.cloudShadow.wind[0], sky.cloudShadow.wind[1]] : [1, 0.2], speed: 40 } : null);
        for (const m of p.models) {
          if (cullOn && aabbOutside(_planes, m._box, t[0], t[1], t[2])) continue;
          if (m._worldGen !== p._worldGen || !m._world) {
            m._world = multiply(pixelMatrix, m.local, m._world || new Float32Array(16));
            m._worldGen = p._worldGen | 0;
          }
          renderer.drawMesh(m.gpu, m._world, p.texRemap);
        }
      }
      // WM2b: THE SAILS, on the same eased wind vector the cloud deck
      // overhead is drawn with - so a storm picks the mills up on the
      // same fourteen-second curve it picks the sky up on. A null row is
      // "no wind is known" (the classic sky eases nothing), and a mill
      // then stands still rather than guessing at one.
      if (millParts && windNow) {
        for (const w of p.windmills) {
          advanceRotor(w.state, dt, windNow);
          if (pixelVisible) renderer.drawMesh(millParts.rotor, mountRotor(multiply(pixelMatrix, w.local), ROTOR_HUB, w.state.angle), p.texRemap);
        }
      }
      // WM4c: THE HUM - see exterior.js. Here the source MOVES every
      // frame, because the floating origin shifts the pixel under it
      // and the listener is set in the shifted frame (audio.setListener
      // above takes cam.pos): a source left at the numbers it started
      // with would drift away from its mill on every origin shift.
      if (millParts) {
        for (const w of p.windmills) {
          const at = millSoundPosition(multiply(pixelMatrix, w.local));
          if (!w.hum) w.hum = audio.loop3d(MILL_SOUND.clip, at, MILL_SOUND.volume, MILL_SOUND);
          else w.hum.move(at);
        }
      }
      // FA1: the flats that move. The animator is PER PIXEL because
      // the batches are - a pixel evicted takes its clocks with it -
      // so the tick rides the same walk that collects the batches.
      p.flatAnims.tick(dt);
      for (const b of p.batches) {
        if (!pixelVisible || (cullOn && aabbOutside(_planes, b._box, t[0], t[1], t[2]))) continue;   // EV3
        b.origin = t;
        allBatches.push(b);
      }
    }
    _camRight[0] = Math.cos(cam.yaw); _camRight[1] = 0; _camRight[2] = -Math.sin(cam.yaw);
    const camRight = _camRight;   // EV2: one scratch, refilled - not three allocations a frame
    renderer.drawBillboards(allBatches, camRight, UP_Y);
    if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, UP_Y);   // M2: spell missiles
    // T2 towns: every built populated pixel runs its own pool
    // (PopulationManager is per-location); the pool sees the player in
    // the pixel's LOCATION frame, and live persons draw through the
    // current translation on the flats' axis (the billboard-axis
    // doctrine). The politeness gate is the law both exterior hosts
    // share (mobilePerson.personWantsToStop); this host hands its
    // AreEnemiesNearby() term BOTH live pools, the city watch and the
    // encounter foes.
    syncTopics();   // T3d: the Where-is directory follows the location pixel
    // F062: PlayerGPS.PlayerLocationRectCheck's transition pair
    // (:674-716), played by the host frame loop AFTER syncTopics so
    // _musicLoc is current - the no-location bail branch (:674-685)
    // reads as the thunk answering false. Edge-triggered: the exit
    // event fires ONCE, and PlayerEntity's handler clears the crime
    // (PlayerEntity.cs:2449-2453).
    {
      const _inRect = _musicInLocationRect();
      if (_wasInLocationRect && !_inRect) clearCrimeOnLocationExit(playerEntity);
      // AUDIT 26 F089: the SAME two events arm the graveyard ambient
      // layer - OnEnterLocationRect sets IsCemeteryNearby when the
      // location is a Graveyard and the player is outside (:518-529),
      // OnExitLocationRect clears it (:531-534). The layer then ticks
      // its own 1-80s counter beside the ordinary wilderness one.
      if (_inRect && !_wasInLocationRect) {
        ambience.setCemeteryNearby(_musicLocationType() === LOCATION_TYPES.Graveyard);
      } else if (!_inRect) {
        ambience.setCemeteryNearby(false);
      }
      _wasInLocationRect = _inRect;
    }
    _playerStill = _lastPlayerPos &&
      Math.hypot(cam.pos[0] - _lastPlayerPos[0], cam.pos[2] - _lastPlayerPos[2]) < 0.001;
    _lastPlayerPos = [cam.pos[0], cam.pos[1], cam.pos[2]];
    const isDay = !isNight(minute);
    const livePersonBatches = [];
    _livePersons = [];   // T3b: rebuilt each frame in WORLD space
    for (const p of built.values()) {
      if (!p.population) continue;
      const t = state.pixelTranslation(p.px, p.py);
      const local = [cam.pos[0] - t[0] - p.locOrigin[0], cam.pos[1] - t[1], cam.pos[2] - t[2] - p.locOrigin[2]];
      // audit 2026-08-17: the population freezes under the talk
      // overlay (DFU pauses the sim under UI windows)
      const live = p.population.update(townTalk.overlayActive ? 0 : dt, local, cam.yaw, local, isDay, (person) => personWantsToStop({
        playerStandingStill: _playerStill,
        distanceToPlayer: Math.hypot(person.pos[0] - local[0], person.pos[2] - local[2]),
        sheathed: weaponRig.playerWeapon.sheathed,
        invisible: isInvisible(playerEntity),
        enemiesNearby: () => areEnemiesNearby(enchantFoes()),
      }));
      for (const { person, out } of live) {
        const batch = p.personBatches.get(person);
        batch.archive = person.archive;   // audit 2026-08-17: identity re-rolls per spawn - re-point the batch
        const pt = personTex.get(person.archive);
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${person.archive}_${rkey}`)) uploadRecordFrame(person.archive, out.record, out.frame);
        const sz = scaledBillboardSize(pt.getSize(out.record), pt.getScale(out.record));
        batch.record = rkey;
        batch.size = { w: out.flip ? -sz.w : sz.w, h: sz.h };
        batch.origin = [
          person.pos[0] + p.locOrigin[0] + t[0],
          person.pos[1] + t[1],
          person.pos[2] + p.locOrigin[2] + t[2],
        ];
        _livePersons.push({ person, pos: batch.origin });   // T3b: world-space activation target
        livePersonBatches.push(batch);
      }
    }
    // G1: the guards drive + draw on the same flats' axis; the sim
    // freezes with the population under the talk overlay.
    livePersonBatches.push(...cityGuards.update(townTalk.overlayActive ? 0 : dt,
      walkMode && playerSpawned ? player.pos : cam.pos, cam.pos, _foeSenses()));
    // X-slice: the encounter pool drives + draws beside the watch;
    // the cadence loop rolls the elapsed minutes (exterior mode only).
    if ((modes?.mode ?? 'exterior') === 'exterior') {
      const _pf = walkMode && playerSpawned ? player.pos : cam.pos;
      if (!townTalk.overlayActive) runEncounterTick(_pf);
      exteriorFoes.update(townTalk.overlayActive ? 0 : dt, _pf, cam.pos, _foeSenses());
      livePersonBatches.push(...exteriorFoes.batches());
    }
    droppedLoot.tickFlats(dt);   // FA1 slice 3
    livePersonBatches.push(...droppedLoot.batches());   // U8e: the ground piles
    // AUDIT 24 (wave 39): the blood splashes, on the same axis. Their
    // clock is REAL dt like every other one-shot, and it ENDS - a
    // finished splash frees its batch inside tick().
    hitEffects.tick(dt);
    livePersonBatches.push(...hitEffects.batches());
    if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, UP_Y);
    if (precipMode && precip) {   // W1 review: precipMode nulls on a clear-up; the renderer object outlives it
      precip.draw(precipMode, proj, view, new Float32Array(cam.pos), camRight, now / 1000);
      renderer.markForeignPass();   // EV6: so did the rain
    }
    // C13: streaming-world arrows fly against the live pixel
    // collider (lost on geometry/terrain, as DFU misses are). Drawn
    // without a remap - the streaming pixels each carry their own,
    // and 99800's weapon archive needs none.
    // X2-slice: ENEMY arrows hunt the player - the impact runs the
    // same damage member the melee does (BowDamage :141), so the
    // Dodging tally, the poison seam and the recoverable arrow all
    // ride the hit.
    arrows.update(dt, {
      // enemy arrows hunt only a SPAWNED, WALKING player - fly/orbit
      // camera modes have no capsule to hit
      playerFeet: walkMode && playerSpawned ? player.pos : null,
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
          audio.playOneShot(hitSoundFor(m.weapon), 1.1);
          // AUDIT 24 (wave 46): an arrow reaches the player through
          // BowDamage -> ApplyDamageToPlayer -> SendDamageToPlayer,
          // the same door as a blow, so it owes the flash and the cry
          // too. This site had the sound and neither of the others.
          flashPlayerDamage();
          playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
          surfacePlayer();
        }
        addItem(playerEntity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage: the arrow is recoverable from the target
      },
      // AR1: the impact learns the FOES - the shaft an archer looses
      // at another foe (MT-ii's infighting selection) LANDS now, on
      // BowDamage's non-player arm. Both pools are candidates; the
      // shooter is excluded inside the flight module.
      foeTargets: [...exteriorFoes.foes, ...cityGuards.guards]
        .filter((t) => !t.dead && t.ai).map((t) => ({ feet: t.ai.feet, ref: t })),
      onFoeHit: (m, t) => exteriorFoes.arrowHitFoe(m, t),
      // AUDIT 39 (#64): and the PLAYER's shaft lands too. It used to
      // fly, spend its Arrow and tally Archery against a guard or an
      // encounter foe and inflict nothing - both impact arms were
      // gated on `m.enemy`, and this bow branch `continue`s past the
      // melee hit chain below. The damage door is each pool's own, so
      // a killed watchman still runs the crime and the corpse.
      onPlayerArrowHitFoe: (m, t) => playerArrowHitFoe(m, t, {
        playerEntity, playerWeapon: weaponRig.playerWeapon, playerFeet: player.pos,
        dealDamage: (f, d) => (cityGuards.guards.includes(f)
          ? cityGuards.hurtGuard(f, d, player.pos, m.dir)   // AUDIT-39r: the shaft shoves the watch too (WeaponManager.cs:576-595)
          : exteriorFoes.damageFoe(f, d, player.pos, m.dir)),
        audio, hitEffects, say: (l) => townTalk.say(l),
        onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(playerTicker.classicMinutes) }),
      }),
    });
    arrows.draw(renderer);
    // C9: the exterior FP weapon - swings/sounds through the rig. The
    // open world still has no ACTION OBJECTS in melee reach (static
    // building doors are the E-enter seam, not bashables - FLAGGED
    // with the towns arc), which is the clause that is still true.
    // FS1: the two that rode along with it are not. "Melee strike
    // frames resolve to nothing" was written before G1/G4/X, and forty
    // lines below this comment a swing resolves against live guards,
    // then encounter foes, then wandering civilians; "targets pend the
    // RMB animal/exterior-foe arc" was written before AR1, and the
    // arrows.update call above hands foeTargets both live pools. A
    // sentence with one true clause kept two false ones alive.
    if (walkMode && playerSpawned) {
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
            // AUDIT 23 (C14): the swing fatigue + the FULL bow tally
            // arm (Archery AND CriticalStrike) - see exterior.js.
            drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
            tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
            arrows.fire(cam.pos, fwd, { fromPlayer: true, weapon: weaponRig.playerWeapon.weapon });   // #64: LastBowUsed rides the shaft - the impact prices off it
          }
          continue;
        }
        // C14: the melee swing's fatigue, unconditional.
        drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
        // G1: melee swings resolve against live guards. G4: no guard
        // hit -> WANDERING townsfolk (civilian one-hit Murder +
        // response; wandering guard NPC -> Assault + conversion with
        // the swing carried onto the fresh foe).
        const lookFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        const guardHitSound = (g) => audio.play3d(hitSoundFor(weaponRig.playerWeapon.weapon), g.ai.feet, 1.1, { maxDistance: 16 });
        // AUDIT 23 (combat-4): the host-side double tallies are gone -
        // resolvePlayerHit runs DFU's tally arm itself.
        if (!cityGuards.resolvePlayerHit(weaponRig.playerWeapon, cam.pos, lookFwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
          // X-slice: encounter foes resolve after the watch, before civilians
          if (exteriorFoes.resolvePlayerHit(weaponRig.playerWeapon, cam.pos, lookFwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
            tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            surfacePlayer();
          } else
          cityGuards.resolveCivilianHit(weaponRig.playerWeapon, cam.pos, lookFwd, player.pos, _guardPool(),
            { onMurder: () => _crimeResponse(), onHitSound: guardHitSound }).then((r) => {
            if (r?.carriedHit) tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            if (r) surfacePlayer();
            // ROAD-B: WeaponManager.WeaponEnvDamage (:474-477) - a
            // swing that met no living thing is offered to the STATIC
            // DOORS, and a door under it is BASHED (PlayerActivate
            // .AttemptExteriorDoorBash). This is the input R1's flag
            // said the two bash arms were waiting for; outdoors there
            // is no action-object list for envAttack to walk, so the
            // door ray is the mode machine's.
            // AUDIT 23 (C9): the no-enemy swing sound at the hit frame -
            // and NOT when the env arm consumed the swing, which is
            // what WeaponEnvDamage returning true means (:1066).
            else if (!modes?.attemptExteriorDoorBash?.(cam.pos, lookFwd)) audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);
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
    // forever, so the enhanced skin had no vitals for the first
    // frames and none at all when MAIN/HUD could not be read.
    {
      const _hfw = [-view[2], -view[10]];
      // X4: the Detect markers. Exterior mode's nearby pool is the
      // guards plus the encounter foes - the same list the spell
      // engine already targets - and, since FX1 (F207), the world
      // piles and corpse containers too: Detect Treasure marks your
      // own dropped pile out here, as DFU's ungated loot walk does.
      const _detected = detectFeed.tick(dt);
      // TR2/TR3: the mount's own frame and audio, then its sprite -
      // OnGUI draws at depth 2, under the HUD's own elements, so it
      // goes in before drawHud.
      // The classic-art guard stays HERE, where it stood before AUDIT
      // 39 hoisted drawHud out of it: the mount is the classic skin's
      // business and this fix owns the HUD call, nothing else.
      if (hudArt) {
        const ridePaused = townTalk.overlayActive || (modes?.overlayHeld ?? false);
        const r = ridingAnimator.update(dt, {
          mode: player.transportMode,
          standingStill: player.standing,
          grounded: player.grounded,
          paused: ridePaused,
          movingLessThanHalfSpeed: player.movingLessThanHalfSpeed,
          running: player.isRunning,
          soundVolume: 1,
        });
        // MW-D42: with the 3D horse standing, the mod's own hooves and
        // voice replace the classic clips - key by key, only where a
        // registered buffer actually landed (a partial attach degrades
        // sound by sound). The setLoop SWAP semantics (F-F3) carry
        // string keys unchanged through the MW-D40 door.
        const pegasUp = pegas && player.transportMode === TRANSPORT_MODES.Horse;
        if (r.neigh) {
          audio.playOneShot(pegasUp && pegasSounds.has('pegas:roar') ? 'pegas:roar' : SOUND.AnimalHorse, RIDING_VOLUME_SCALE);
        }
        const pegasClipKey = r.clip === 'HorseClop2' ? 'pegas:gallop' : 'pegas:trot';
        const rideClip = pegasUp && pegasSounds.has(pegasClipKey) ? pegasClipKey : SOUND[r.clip];
        audio.setLoop('riding', r.playing ? rideClip : null, { volume: r.volume, pitch: r.pitch });
        // TR-AUDIT F-E1: OnGUI (:293) refuses to draw AT ALL while the
        // game is paused - `!GameManager.IsGamePaused` sits in the same
        // condition as the Repaint test. Under an open window DFU shows
        // no mount; the first cut froze the frame and kept drawing it.
        if (ridingArt && isRiding(player.transportMode) && !ridePaused) {
          // MW-D42: the CFA sprite is the 1:1 lane - it yields only
          // while the 3D horse actually stands under you (the cart,
          // the classic skin, and every failed load keep it).
          if (!pegasUp) {
            const rect = ridingRect(canvas, ridingArt);
            renderer.drawScreenQuad(ridingArt.frames[r.frame], rect);
          }
        }
      }
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1, dt,
        { font: townTalk.font, cursorActive: townTalk.overlayActive || (modes?.overlayHeld ?? false),
          detected: _detected, playerXZ: [enchantFeet()[0], enchantFeet()[2]],
          largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity),
          // AUDIT 39: the enhanced HUD's two hand plaques. Both values
          // are already this host's - the rig one argument over, the
          // readied spell its own magic - and a host that hands
          // neither draws neither, which is what made the seam dead.
          readied: magic?.readied?.() ?? null,
          weapon: weaponRig.playerWeapon.weapon ?? null,
          weaponSheathed: !!weaponRig.playerWeapon.sheathed });   // AUDIT 28 W2: the arrow counter's drawn-bow gate   // U38 + X4 + U43
    }
    townTalk.frame(dt);   // T3b: HUD lines + the talk overlay, above everything
    // SS1: the frame's LAST draw is behind us - deliver a pending save
    // screenshot while the buffer is still this task's to read
    // (preserveDrawingBuffer false clears it after compositing).
    capturePendingScreenshot(canvas);

    if (shotMode) {
      window.__frame++;
      if (queue.length === 0 && !building && !window.__shotReady) {
        window.__shotReady = true;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
