// Shared dungeon build for scene transitions (P5): lay a location's
// dungeon out against a HOST scene's caches and return everything the
// host needs to render and crawl it. Semantics match the standalone
// dungeon scene (M6/R6/R7/R11/P2) with one mechanical difference: the
// per-dungeon texture table is applied as a DRAW-TIME texRemap instead
// of rewriting submesh archives at model build - the host's mesh cache
// serves exteriors too and must stay untouched. UVs therefore keep
// original-archive sizes while pixels come from the table archive,
// which is exactly the dungeon convention already on record.

import { isShopShelfModel } from '../systems/shopStock.js';   // AUDIT-SEATS: a castle's shelf-set models, a crown's Hall of Records
import { IIL_LIGHT_ARCHIVE } from '../systems/improvedInteriorLighting.js';   // IIL1
import { YesNoBoxWindow } from '../ui/yesNoBox.js';   // SOFTCAP3: the Master Skills offer
import { FlatAnimator, armFlatAnim, MISSILE_FPS } from '../render/flatAnimation.js';   // FA1: the flats that move
import { markFoeStruck } from '../ui/hudFoeTarget.js';
import { combatStanding, dungeonShare, foeShare, progressionScaling } from '../systems/skillSoftcap.js';   // SOFTCAP2: tougher foes, by dungeon tier
import { effectiveLevel } from '../systems/mentorMode.js';   // SOFTCAP1
import { quickslotHand } from '../ui/quickslotTags.js';   // DISC21-C: an empty quickslot press reads the hand   // PX30
import { lycanthropeAttackVoice, lycanthropeMoveSound } from '../systems/lycanthropy.js';   // V4: the beast's attack voice; LM1: the 4-20s move-sound loop; DISC10-E L3: the inventory refusal moved INTO the window door
import { layoutDungeon, isDungeonExitDoor } from '../world/dungeonLayout.js';
import { isGateArena, COURT_TEXT } from '../world/gateArena.js';
import { isArenaFloor } from '../world/arenaFloor.js';
import { isArenaUndercroft } from '../world/arenaCity.js';   // ARENA-FIX 4: the fighters' hall
import { undercroftPopulation, chainTag } from '../world/arenaUndercroft.js';   // ARENA2: the arena floor's instance - what the sand will not allow
import { ARENA_TEXT } from '../systems/arenaText.js';   // WB3b: the Burning Court - what the Deadlands will not allow
import { expandMacros } from '../systems/talkSession.js';   // MACRO1: the global symbols every TEXT.RSC box passes through (MacroHelper)
import { executeConsoleCommand } from '../systems/consoleCommands.js';   // E3: the probe door runs the real database
import { enterDungeonAutomap, exitDungeonAutomap, detachedAutomapRecord, buildRevealIndex, bindAutomapLayout, automapRevealTick, automapEntranceTick, automapTrailTick, capsuleCentreFromEye, automapDungeonKey, SCAN_INTERVAL_S, recordTeleporterConnection, teleporterConnection, registerAutomapConsoleCommands } from '../systems/automap.js';   // A1; ROAD-C c2/S8 the teleport listener + the three console verbs, ROAD-E E3 on the command database
import { automapWaterLevel, ELEMENT_NAMES } from '../systems/automapModel.js';   // ROAD-C c2/S1
import { signalAutomapReset } from '../ui/automapWindow.js';   // A1: the M window; ROAD-C c2/S5: its native art + the reset signal
// EM3: the skin fork. The classic skin keeps DFU's 3D panel whole; the
// enhanced one gets the held sheet with the dungeon's plan inked on it.
import { createAutomapWindow, preloadAutomapArt, automapDoorReady } from '../ui/automapDoor.js';
import { applyTextureTable } from '../world/dungeonTextures.js';
import { createUseMagicItemWindow, NO_ITEM_TO_ACTIVATE_TEXT } from '../ui/useMagicItemWindow.js';   // UI1: the U key's window
import { CANNOT_CHANGE_INDOORS } from '../ui/transportWindow.js';   // TR5: the indoors refusal
import { smallerDungeonsStamp, needsStartWarp } from '../world/smallerDungeons.js';   // AUDIT 28 W4 / FT1: the save-time stamp and the load-time warp, one home
import { remapSubMeshes } from '../world/texRemap.js';   // WM3: the one climate/dungeon remap seam
import { collectDungeonLights, dungeonAmbientFor, DUNGEON_AMBIENT, SPECIAL_AREA_BLOCK } from '../world/dungeonLights.js';   // AUDIT 26 F183: the castle / special-area ambients
import { isHearthFlat } from '../systems/survival/hearth.js';   // HEARTH1: a bowl of fire down a corridor is a fire you can cook on
import { CityLightAnimator, MINUTES_PER_DAY } from '../world/worldClock.js';
import { billboardSize, mobileBillboardSize, centredBase } from '../world/rmbFlats.js';
import { WATER_SCROLL_TILES_PER_SEC } from '../render/waterSurface.js';   // WATER-D1: the classic texel's flow, one home - the dungeon water draw lives here now
import { enemyControllerHeight, idleSpriteHeight, flyerStandFeet, centreFromFeet, spriteOriginY, keepRebuiltSpawn } from '../characters/enemyAnchor.js';   // INCIDENT 2026-09-04 (ceiling bats): SetupDemoEnemy.cs:103-115 capsule + DaggerfallMobileUnit.cs:398-411 anchor
import { MobileUnit, MOBILE_DAEDRA_SEDUCER, SeducerTransformBehaviour } from '../characters/mobileUnit.js';   // C11: classic sprite monsters   // A5: the Seducer transform pair + its trigger
import { dfMeshToModel, GLOBAL_SCALE } from '../world/meshReader.js';
import { customModelFor, customAliasFor, emptyModel } from '../world/customModels.js';   // DS1: models no ARCH3D carries, and GetModelData's false; WD3: a classic model under another id
import { RDB_SIDE, MOVE_ACTION_FLAGS, ACTION_FLAGS, TRIGGER_FLAGS } from '../world/rdbLayout.js';   // WAVE D: the move family - an acting FLAT tweens like the model beside it
import { NPC_CONTEXT } from '../characters/staticNpc.js';   // AUDIT 64 F13: StaticNPC.SetLayoutData(RdbObject) stamps Context.Dungeon
import { drawnFlat } from '../characters/nudeFlats.js';   // NUDE-FLATS: Show Nudity off draws a nude figure's clothed stand-in
import { EFFECT_ACTION_FLAGS, COLLISION_TIMEOUT_S, isActionDoorObject, hasActionCollision, standsOnAction, actionContact, classifyPlacementAction, lookAtLockText, LOCKPICKING_SUCCESS_TEXT, LOCKPICKING_FAILURE_TEXT, DOOR_TEXT_HUD_DELAY_S, sharedRecord, validActionRecord } from '../world/actionSystem.js';   // AUDIT WORLD3 B1: the shared half of a record - the picker's latch stays home; AUDIT WORLD34 C2: and the memory's records projected like an act's
import { TextRsc } from '../formats/textRsc.js';
import { openPauseFlow, preloadPauseFlowArt, pauseDoorReady, pauseOpts } from '../ui/pauseDoor.js';
import { releaseUnloadGuard } from '../systems/unloadGuard.js';   // AUDIT-MACL F3: the chargen Cancel is a door the game opened   // U51 picks the skin; MAC-L1: pauseOpts is the ONE reader of the door's options
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';   // MAC6 #1: the save names the pixel the dungeon stands on
import { openPixelDial } from '../ui/pixelDial.js';   // PX15b: the Tab compass rose
import { ActionTextBox, ActionInputBox } from '../ui/actionText.js';
import { registerPresenter, messageBox } from '../systems/notify.js';   // ENH-NOTICE3: this context's window stack and its PopupText, offered to the one door every message goes through - and the door itself, for the seams that name a KIND
import { makeWindowStack, pauseWhileOpen, hidesHud } from '../ui/windowStack.js';   // ROAD-B B1: UserInterfaceManager's stack, under this context's one slot; ROAD-tail: and its PAUSE
import { toggleStatusReadout } from '../ui/statusBox.js';   // STATUS-LIVE: the Status readout, one composer for all four hosts
import { statusReadoutUp } from '../systems/statusReadout.js';   // STATUS-LIVE: ...and the live one, for this host's free-slot guard
import { liveVampirism } from '../systems/racialLive.js';   // SURV5: the vampire's one status line
import { survivalOn } from '../systems/survival/switch.js';
import { survivalFeed, installSurvivalGate, uninstallSurvivalGate } from '../systems/survival/env.js';   // SURV7: the needs' feed and the rest gate; AUDIT SURV B/C: and off the seam at the teardown
import { registerPreventRestCondition, unregisterPreventRestCondition } from '../systems/restSession.js';   // SURV7: the gate's seam
import { runSurvivalMinutes } from '../systems/survival/needs.js';   // AUDIT SURV B: the dungeon's rest pays its night asleep
import { addCorpseFood } from '../systems/survival/loot.js';   // CORPSE-FOOD: a joiner's copy of a body rolls its own food
import { dateFromClassicMinutes } from '../systems/gameDate.js';   // SURV7: the env's month
import { playerEntity, surfacePlayer, hurtPlayer as hurtEntity, damageShieldPool, setDeathPresenter, setAvoidDeathHook, staffFly } from '../characters/playerEntity.js';   // AUDIT 58: DecreaseHealth's shield hook is the BASE class's, so every entity's door owes it
import { addItem, spendAmmoFor, isEnchanted } from '../systems/inventory.js';
import { useQuickslot, swapQuickslot, offHandQuickslot, spellQuickslotPress, offHandOffersSwap, tickQuickslotHold } from '../systems/quickslots.js';   // QS2/QS4: the diamond's performers   // QS6: the spell slot, the off hand's swap question, and the hold machine
import { worldAabb, objectAabb, peacefulFoePass, doorDistanceOf } from '../player/activate.js';   // AUDIT 63 F37/F38: objectAabb is the LIVE box a ray or a collision meets
import { getInteractionMode } from '../player/interactionMode.js';   // AUDIT TACT C5: a pickpocket's plaque names the mark
import { createWeaponRig, envAttack, sheetHolderOf } from '../combat/weaponRig.js';   // C10: the shared FP-weapon surface; MW-MAP1: the held map's holder
import { mwViewFirstPerson } from '../player/mwView.js';   // MW-MAP1: the automap is read in the head (MAP-POV's law), underground too
import { weaponPoseOf, applyWeaponPose } from '../combat/playerWeapon.js';   // HARD2c: the sheath+hand pair as ONE law (SerializablePlayer.cs:175-176 / :420-421)
import { racialRestBlock } from '../systems/vampirism.js';   // V2b: the vampire's rest gate
import { setPassiveSpecialsHost } from '../systems/passiveSpecials.js';   // V2c: the sunlight/holy-place seam
import { setInfectionHost } from '../systems/infection.js';   // AUDIT 39 (#37): the borrowed seam goes back on teardown
// U26: this host's own equip hook is retired - the native inventory
// window owns equipping, the career gate (S23) and the paperdoll, so
// the duplicate pair here had nothing left to serve. AUDIT 17e F17's
// point stands and is now made in ONE place instead of two.
import { partyCompassPoints } from '../ui/partyMapMarks.js';   // COMPASS-PARTY
import { loadHud, drawHud, hudScale as hudScaleFor, hideHudTextSurfaces } from '../ui/hud.js';   // AUDIT FONT F3: the two DOM text surfaces' one hide door, for the hosts' overlay branch
import { isEnhanced } from '../systems/uiSkin.js';   // FONT3: the readied-spell line is the classic skin's
import { largeHudOptions } from '../ui/hudLarge.js';   // U45: the classic bottom bar
import { drawText, makeFont } from '../ui/text.js';
import { HudText } from '../ui/hudText.js';
import { setMidScreenText, midScreenText } from '../ui/midScreenText.js';   // AUDIT 64 F34: DaggerfallHUD's second text surface
// DISC19-D: STATIC. This was the one module of the foe subsystem's lazy
// block that nothing else imports, so the build gave it a lazy-only
// chunk - and a tab opened before a deploy asked for a chunk the deploy
// had deleted, the whole subsystem failed, and every enemy in the
// dungeon stood as a flat no blow could reach (Discord: "In a dungeon
// that I cant hurt enemy's"). Its own imports (enemyMotor, navmesh)
// were static elsewhere already, so the lazy block's gate never saved
// their bytes; this one module is ~16 KB of source.
import { EnhancedEnemyAI, makeNavWorld } from '../ai/enhancedMotor.js';
import { foeFrameDt } from '../characters/enemyMotor.js';   // FOE-CATCHUP: the one cap every pool hands its foes
import { spaceFoes, spacingSkips, clearDoorways, actionDoorSpots } from '../characters/foeSpacing.js';   // FOE-SPACING: the pack keeps apart; AUDIT TACT C7: and the doorways clear
import { isStaleChunk, STALE_CHUNK_IN_PLAY_TEXT, STALE_CHUNK_IN_PLAY_SECONDS } from '../systems/staleChunk.js';   // DISC19-D: a chunk gone mid-session is said, not swallowed
import { hudRenderEnabled } from '../ui/hudShortcuts.js';   // AUDIT 64 F37: the Draw override covers popupText too
import { FntFile } from '../formats/fntFile.js';
import { ImgFile } from '../formats/imgFile.js';
import { createWeapon, bowDamageArrow } from '../combat/enemyEquipment.js';   // MAC-N1: the recovered shaft is CreateWeapon's arrow, value and all
import { setDefaultEnchantCtx } from '../systems/enchantments.js';   // FS1 (wave D): this host mounts the enchant ctx too
import { createEnchantCtx, standLooseFoe } from './hostEnchant.js';   // FS1 (wave D): the ONE ctx body + SD1's loose-foe placement
import { playerArrowHitFoe } from '../combat/arrowFlight.js';   // AUDIT 39 (#64) wave D: the FOURTH host calls the shared player-arrow law rather than carrying a fourth body of it
import {
  hasBowAttack, isBowWeapon, backstabChanceOf,
  tallySwingSkills, zeroDamageHitSound, SWING_FATIGUE_COST,
  CORPSE_ACTIVATION_DISTANCE,
  enemyMissSound, enemyAttackVoice, enemyPainVoice, playerAttackGrunt,   // C2-slice (combat-9/17)
  tickEnemySound, playEnemyClip,   // AUDIT 24 (wave 41): EnemySounds through the host's devices
  tryLanguagePacification,         // AUDIT 24 (wave 42): EnemySenses:504-527
  playerPainVoice, playPlayerVoice,   // AUDIT 24 (wave 46): PlayerFootsteps.RemoveHealth's 40% cry
  applyDamageToNonPlayer,          // MT-iv: EnemyAttack.ApplyDamageToNonPlayer (:303-392)
  makeEnemiesHostile,              // ROAD-B: GameManager.cs:790-806
  spawnEnemyLoot,                  // RF2: SetEnemyCareer's whole loot chain, one seam
} from './hostCombat.js';   // AUDIT 18: the laws every host must share
import { createCharacter } from '../systems/chargen.js';
import { createChargenFlow, createChargenWindow, finishChargen, applyHeadlessChargen, applyCreationExtras } from '../systems/chargenSession.js';   // S3c/U9 + 17i: one construction seam   // FS-slice (wave D): and the SKIN FORK, which this host held the raw flow to avoid
import { preloadChargenArt, stopConstellationAnim } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { LevelUpScreen, preloadCharSheetArt } from '../ui/charsheet.js';
import { createCharSheetWindow, warmLevelUpWindow } from '../ui/charSheetDoor.js';
import { announceLevelUp, levelOwed } from '../ui/levelNotice.js';   // LV2: the level-up notification, and the skin fork over whether the window opens itself   // U52: the sheet's ONE seam, and the skin fork in front of it
import { preloadQuestJournalArt } from '../ui/questJournal.js';   // U43: the LogBook and NoteBook doors
import { createChronicleWindow } from '../ui/chronicleDoor.js';   // PX24d: the chronicle's one door
import { DeathScreen } from '../ui/deathScreen.js';
import { preloadSpellbookArt } from '../ui/spellbookWindow.js';
import { createSpellbookWindow } from '../ui/spellbookDoor.js';   // PX23: the book's one door
// U26: the dungeon finally gets the SAME inventory window the exterior
// hosts have had since U8d - tabs, paperdoll, the real info panel and
// point-and-click Use. The keyed InventoryWindow it used until now is
// retired from this host.
import { preloadInventoryArt, WAGON_ACCESS_DISTANCE } from '../ui/nativeInventory.js';
import { createInventoryWindow } from '../ui/inventoryDoor.js';   // U53: the pack's ONE seam, and the skin fork in front of it
import { preloadPaperDollForEntity } from '../ui/paperDoll.js';   // U26: the doll the keyed window never had
import { createDroppedLoot, droppedLootHooks, containerDropPos } from './droppedLoot.js';   // U8e, mounted here at U26; G5: the pile's DaggerfallLoot identity
import { createPlayerMagic } from './hostMagic.js';   // M3: the ONE cast engine
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE, CAPSULE_HEIGHT, EYE_HEIGHT, startRestGroundedCheck } from '../player/motor.js';   // the rest gate's grounded input, one home
import { applyLevelUp } from '../systems/advancement.js';
import { initVirtueLeveling, LEVELING_CLASSIC } from '../systems/oblivionLeveling.js';   // ORL1: the font-less creation path answers the question it could not ask
import { tickPlayerMinutes, claimMagicRounds, runMagicRoundsFor, playerWeaponHitEntity } from '../systems/worldTick.js';   // AUDIT 18: the player tick every host shares; DISC10-D H1: OnWeaponHitEntity's one dispatcher
import { mintSharedStamp, hitPoisonOf, hitSpellOf, hitSpellFields, HIT_ARROWS_MAX, respawnDue, wallMsForClassicMinutes, validFoeRecord, validSharedFoe, FOE_HEALTH_MAX, FOES_FRAME_MAX, CELL_FRAME_RECORDS_MAX } from '../net/wire.js';   // AUDIT ONCRASH1 B4a/A3: the stream's door and the memory's, which this host had neither of   // WORLD8: the hour's respawn   // AUDIT WORLD6a B7: the memory's stamp, from the wire's one mint
import { spendPoolLowest } from '../systems/chargen.js';
import { ClassFile } from '../formats/classFile.js';
import { fetchBytes, ensureAudio, loadMagicRegistries, wireInfectionVideos, endRunToTitleMenu, exitToTitleMenu, sensesContext, wireDoorSpells, createDetectFeed, foeNearbyRecord, nearbyLootRecords, restFullyHealed, createRestDeps, fatigueLossMultiplierFor, realmSaveSink} from './shared.js';
import { sayRealmSave } from '../systems/realmSaves.js';   // REALM P1.3: a save online lands in the realm; AUDIT REALM2 C2: said once it has
import { getNearbyObjects } from '../systems/nearbyObjects.js';   // X9: the dispel sweep filters the same scan
import { preloadBookArt } from '../ui/bookReader.js'; import { makeOpenBookHook } from '../ui/bookDoor.js';   // B1; EB1: the reader's ONE door
import { worldMinutes, skyMinutes, ownMinutes, setOwnMinutes, advanceOwnMinutes, sharedClockOn } from '../systems/worldTick.js';   // WORLD8: the relay's clock stamps a death and a take
import { ListPickerWindow, listPickerArtLoaded, preloadListPickerArt } from '../ui/listPicker.js';   // X11b: the Create Item picker
import { createItemLabels, grantCreatedItem, lastCreateItemIndex, setLastCreateItemIndex } from '../systems/createItem.js';   // X11b
import {
  missileArchive, MISSILE_SPEED, missileReach,   // ROAD-H tail: the reach along the normalised direction
  MISSILE_LIFESPAN_S,
  missileHitsFoe, missileHitsCapsule, playerShotOrigin, PLAYER_BODY_RADIUS,   // FIELD-GUN17: playerMuzzleOrigin - the gun's own barrel, where GetAimPosition speaks for the bow   // AUDIT 62 F21: the capsule contact test DFU spherecasts against   // ROAD-H H1c: GetAimPosition's player arrow arm (DaggerfallMissile.cs:540-550)   // AUDIT 65 CV-2: measured at the player's own controller radius
} from '../systems/spellcast.js';
import { silenceBlocksCast, attemptSoulTrap, peerSoulTrapOf, SOUL_TRAP_TEXT, dispelNearby, fillEmptyTrap, liveBundles, dispelBundle, dispellableBundles, DISPEL_MAGIC_TEXT } from '../systems/mysticism.js';   // S27; X5 the soul trap's kill intercept; DR1: X10's bundle picker, in this host too
import { preloadTradeArt } from '../ui/nativeTrade.js';   // DR1: X7's Identify window - the SPELL's, castable underground
import { createTradeWindow, tradeDoorReady } from '../ui/tradeDoor.js';   // the enhanced/native fork, same law as ui/inventoryDoor.js
import { identifySpellPass, identifiedTallyText, NOT_ENOUGH_SPELL_POINTS_TEXT } from '../systems/tradeModes.js';   // DR1: DoModeAction's spell arm (:954-995)
import { isEquipped } from '../systems/equip.js';   // DR1: FilterLocalItems' `!item.IsEquipped` (:693)
import { totalGoldAmount } from '../systems/court.js';   // DR1: the trade screen's gold strip - AUDIT 58: PlayerEntity.GetGoldAmount (:1313-1316), coins PLUS letters
import { isAzurasStarEquipped, registerFoeDoor } from '../systems/artifactEffects.js';   // V3: the Star's kill capture; AUDIT PSCALE1 DOORS-2: Namira's reflection through this pool's door
import { applySpell, hasActiveEffect, isEntityWaterWalking, entityIsParalyzed, maxFatigue, applyEnemyMotorEffectFlags, concealmentFlags, concealFlagsOfBits, isSoulTrapEffect, spellSways } from '../systems/effects.js';   // A5: the enemy Levitate arm, the foe-target concealment closure + EntityConcealmentBehaviour's visual
import { liveStat, killIfAnyLiveStatZero } from '../systems/statMods.js';
import { breathStep } from '../systems/breath.js';
import { onMonsterHit, SPIDER_TOUCH_SPELL_INDEX } from '../systems/diseases.js';
import { inflictPoison } from '../systems/poisons.js';
import { exhaustionOutcome } from '../systems/rest.js';
import { restDecision, getPreventedRestMessage } from '../systems/restSession.js';   // the scene-free open gate, one home   // ROAD-B B5: GetPreventedRestMessage
import { giveOffer } from '../ui/pendingOffer.js';   // AUDIT 58: DaggerfallUI.GiveOffer, the rung in front of the rest press
import { intermittentEnemySpawn, setEnemyAlert, decayEnemyAlert, areEnemiesNearby } from '../systems/encounters.js';   // E-slice; S40: the resting test, one home
import { preloadRestArt } from '../ui/restWindow.js';   // D3: REST00I0/01I0/02I0
import { createRestWindow } from '../ui/restDoor.js';   // the enhanced/native fork, same law as ui/tradeDoor.js
import { AmbientEffects, DUNGEON_AMBIENT_WAITS } from '../systems/ambientEffects.js';
import { enemyWeightClassicUnits, weaponKnockbackSpeed, weaponKnockbackApplies, reportPlayerAttack } from '../combat/formulas.js';   // C15: + knockback; WB4b: a spell's number on the court's boss pops as a blow's does
import { HIT_KINDS } from '../net/gateBrain.js';   // WB4b: a blow on the court's boss says its kind
import { bossReach, BOSS_SWAY_TEXT, BOSS_SWAY_TELL_MS } from '../world/gateBoss.js';   // WB4b: a swing meets the court's boss at his skin; WB8a: and a sway meets his refusal
import { duelSpellOf } from '../combat/duelCombat.js';   // WB4b: the harmful families alone reach the court's boss, as they alone reach a duel opponent
import { assignEnemySpells, SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { ARENA_PUPPET_OWNER } from '../net/arenaLaw.js';   // ARENA4: the relay's fighters' puppets - a blow on one is the referee's
import { calculateCastCost } from '../systems/spellcost.js';
import { snapshotPlayer, restorePlayer, composeSessionState, restoreSessionState , copyEffectEntry } from '../systems/save.js';   // B4: the ONE quest+talk composer
import { saveSlot, loadSlot, quickLoadSlot, QUICK_SAVE_NAME, requestScreenshot, slotLoaded } from '../systems/saveSlots.js';   // SAV4: the quicksave is a SLOT named QuickSave; SS1: the shot arms here, the HOST loop delivers it
import { bindQuestFoeHost, placeFoeEnv, entityOccupancy } from './questFoeHost.js';
import { validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX, validLooseSeqs, companionNames } from './exteriorFoes.js';   // QUEST-PARTY phase 3c: the party's quest words and the marker's law, one home   // B1: quest foes ride this pool   // RE1: the placement ring's env over this host's collider
import { placeFoeFreely } from '../systems/quest/sceneMount.js';   // RE1: FoeSpawner.PlaceFoeFreely, the one home
import { dungeonQuestSpawnSpots } from '../systems/quest/place.js';   // FIELD BUGS 29h (BOUNTY-LAIR)
import { fieldOfView } from '../ui/viewSettings.js';   // RE1: the ring needs the view cone the LOS arm avoids
import { dungeonKey } from '../systems/songManager.js';
import { audio } from '../systems/audio.js';
import { immersiveFootsteps } from '../systems/immersiveFootsteps.js';   // IF1: Immersive Footsteps owns the stride and the three landing sounds once its clips are in (DisableVanillaFootsteps)
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4: the shared PlayRandomlyIfPlayerNear pass
import {
  SOUND, hitSoundFor, swingSoundFor, ENEMY_HIT_VOLUME, PLAYER_HIT_VOLUME,   // AUDIT 58: DFU's two hit volumes
  TORCH_ARCHIVE, TORCH_RECORDS, TORCH_MAX_DISTANCE, TORCH_VOLUME,
  ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD,
} from '../systems/soundClips.js';
import { FOOTSTEP_VOLUME } from '../systems/footsteps.js';   // AUDIT 58: PlayerFootsteps.FootstepVolumeScale (:30) - the stride's 0.7, which its three one-shots carry too
import { CLASSIC_UPDATE_INTERVAL } from '../characters/weaponStates.js';
import { BUILD_TAG } from '../buildTag.js';
import {
  generateItems as generateLootItems, addPileLootExtras,   // AUDIT 24 (wave 43)
  validLootList, LOOT_LIST_MAX, LOOT_NEWER_TEXT,   // WORLD4: a container's list off the wire, projected and clamped (AUDIT WORLD3 A2's law); AUDIT WORLD4 A2: and the cap the SENDER obeys too
  RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS,
  RANDOM_TREASURE_MARKER_RECORD, DUNGEON_LOOT_KEYS,
} from '../systems/loot.js';
import { unbound } from '../systems/itemBound.js';   // SS3: a bound piece in the room's containers, or on a body, never lands
import { floorLanding, closestDoorTo } from '../player/enterExit.js';   // DE1: TransitionDungeonInterior orients away from the door it came through
import { trs, multiply, identity, UP_Y } from '../world/mat4.js';
import { StaticBatchBuilder, keyResolver, SHADOW_CELL_SIZE } from '../render/staticBatch.js';   // PERF5: the level's static models as one mesh; LA-AUDIT A1: with its shadow cells
import { Collider } from '../player/collider.js';
import { ActionSystem } from '../world/actionSystem.js';
import { collectDungeonEnemies, expandEliteEnemies, enemyHierarchyOrder } from '../characters/dungeonEnemies.js'; import { markDungeonChampions, applyChampion, championName } from '../systems/champions.js'; import { lootCrown } from './lootLines.js';   // LOOT7: the layout's champions; LOOT11: a find's line of light
import { isOnlinePage } from '../systems/onlineLane.js';   // ELITE FOES: online play only
import { elitesAllowed, pickDungeonElites, promoteEliteFoe, grantEliteLoot, eliteGlow, setBatchEliteGlow, eliteSize, isEliteCorpse, markEliteCorpseBatch, eliteCorpseSize } from '../systems/eliteFoes.js';   // ELITE FOES: 3-4 champions in an Elite Dungeon
import { ELITE_FOE_MULTIPLIER, ELITE_HEALTH_SCALE, ELITE_DAMAGE_SCALE, ELITE_LOOT_DROP_MULT, ELITE_LOOT_QUALITY_MULT } from '../world/spawnedDungeons.js';   // ELITE: an elite spawn's foe count and strength
import { ENEMY_BASICS, enemyDisplayName } from '../characters/enemyBasics.js';
import { foeTitle } from '../systems/foeTitle.js';   // FOE-TITLE: what a revenant, a champion or an elite is called
import { revenantFleeStep, revenantFleeHealth, revenantDeed, revenantSlain, revenantSay, revenantFleeEvent, revenantCorneredEvent, revenantEscapeEvent, revenantSlainEvent } from '../systems/revenant.js';
import { revenantMayYield, beginYield, yieldStep, slipEvent, kneelPose, beginExecution, executionStep, finishExecution, beginSpare, spareDone, fateDissolve, fateModel, dropFateHeld } from '../systems/revenantFate.js';   // REVENANT-FATE: beaten, it yields - kill it or spare it (the open world's law, one home)
import { setBatchDissolve } from '../systems/dissolve.js';   // DISSOLVE
import { createPortalSet } from './portalFx.js';   // COMPANION-PORTAL   // REVENANT-DUNGEON: a special foe of mine alone may run, and get away
import { bloodDecalDeps } from '../combat/bloodSwitch.js';   // BLOOD1a
import { createBloodMarks } from '../combat/bloodMarks.js';   // BLOOD1a: HARD1 - the ring is this context's to own and to end
import { createHitEffects, bloodCentre } from './hitEffects.js';
import { orbArchiveFor, ORB_RECORD, noteOrbColour, ORB_SCALE } from '../characters/thunderlockIds.js';   // FIELD-GUN14: what this weapon's shot LOOKS like - the leaf, so no cycle   // FIELD-GUN17: ...and its colour   // FIELD-GUN18: ...and how big it is drawn
import { bloodHit } from '../combat/bloodDecals.js';   // BLOOD1b: the blow, in the shape the mark's ladder reads
import { createDroppedTorches } from './droppedTorches.js';
import { createCamps } from './camps.js';   // SURV3: a fire on the dungeon floor (no tent below - the camp law says so)
import { campWire, validCampRecord } from '../systems/survival/camp.js';   // SURV3: the room's memory carries the camps as the wire says them   // HT1: Handheld Torches' dropped lights in the dungeon   // AUDIT 24 (wave 39): EnemyBlood.ShowBloodSplash
import { EnemySoundSource, acuteHearingMultiplier } from '../characters/enemySounds.js';   // AUDIT 24 (wave 41): EnemySounds.cs, one home
import { flashPlayerDamage, shakePlayerDamage } from '../ui/damageFlash.js';   // WB13d: the gate boss's elemental blows shake, unflashed
import { resetVitalsDetector } from '../ui/hudVitals.js';   // BLOOD AUDIT 5: the load's detector reset   // AUDIT 24 (wave 39): ShowPlayerDamage
import { activeMemberships } from '../systems/guilds.js';   // F117
import { avoidDeath, AVOID_DEATH_TEXT } from '../systems/guildServices.js';   // F117: Stendarr
import { activationTargets, liveFoeTargets, liveFoeFor, pickActivatableHit, RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';
import { raceWinner } from '../player/activationRace.js';   // WORLD-HOVER H2: the ONE precedence the press and the plaque share
import { composeActivationTargets, composeNamer } from '../systems/worldHover.js';
import { worldTooltipsOn, hideInteractTooltip, corpseName, mobileEntityName, liveEntityName, lootPileName, actionName, actionDoorName } from '../systems/worldTooltips.js';   // WORLD-HOVER: the mod's ladder, arm by arm   // WORLD-HOVER: the composition law is pure, so it lives with the model and can be DRIVEN   // WORLD-HOVER: the ONE construction seam composes the action objects' targets here; AUDIT 65 MC-2: the ray's reach, and each family's own
import { worldHoverFrame, destroyWorldPlaque } from '../ui/worldPlaque.js';   // PX21c, WORLD-HOVER: one seam, one plaque
import { quickLootTake } from '../systems/quickLoot.js'; import { showPickups } from '../ui/pickupFeed.js';   // QUICK-LOOT B4: the take, through the window's own door; PICKUP-FEED: what a take moved, as cards (the take's `took`)
import { combatVisualsOn, foeDraw, markConcealedHit } from '../systems/combatVisuals.js';   // ECV1: what the enhanced skin draws for a concealed foe
import { UnderwaterFog } from '../render/underwaterFog.js';   // ROAD-B (b3): UnderwaterFog.cs, called from PlayerEnterExit.Update's dungeon guard
import { NavClient } from '../ai/navClient.js';   // ENHANCED AI 3b
import { getPref } from '../systems/uiPrefs.js';   // ENHANCED AI 3b: the Enhanced tab's switch
import { raiseEnemyDeath, playRareDrop, pileBody, sayEnemyDied } from './corpseMarker.js';   // UL1: OnEnemyDeath; LR3: the drop chime; LOOT-STACK: a body as the loot window's tab; LOOT7-CHECK DUNGEON-DIED: the kill notice
import { FOE_LEVEL_MAX, CELL_LOOSE_PUPPETS } from '../net/wire.js';   // AUDIT RENOWN1 GAME-3: the stream's bound on a class foe's level; SUMMON-SYNC: an owner's loose stands a reader stands, the cell's allowance
import { partyFoeLoses, partyFoeHits, partyFoeHeals, noteFighter, foeFighters, takeWholeBlow, PARTY_ME } from '../systems/partyScale.js';   // PSCALE1: a shared foe weighs whoever fights it
import { renownFoeStruck, renownFoeDied, renownFoeCarry, renownFoeRevived } from '../net/renownTracker.js';   // RENOWN1: a foe the player fought pays its Renown XP when it dies, by any hand   // AUDIT RENOWN1 GAME-10: a rebuilt foe keeps my blows, a revived one forgets them
import { reportPlayerKill } from '../systems/playerKills.js';   // SET2: my own kills, told
import { sparedByPlayer } from '../combat/friendlyFire.js';   // AUDIT CC-B6: the thrown torch's pass
/** AUDIT SET P-M3: a kill the host's record names me for - its kind, as the exterior owner's `slain` word says it. */
const REMOTE_KILL = Object.freeze({ kind: 'remote' });
/** WB8b: a gate Warden's frost, lightning and venom, heard as they land on me - each element's own cast
 *  (systems/enemySpells.js SPELL_CAST_SOUND, by the classic element: Frost 1, DiseaseOrPoison 2, Shock 3); his fire is
 *  the Burning clip, as it was. */
const GATE_STRIKE_CAST = Object.freeze({ frost: SPELL_CAST_SOUND[1], poison: SPELL_CAST_SOUND[2], shock: SPELL_CAST_SOUND[3] });
import { lootPile } from '../player/lootStack.js';   // LOOT-STACK: the pile under the reticle, as the loot window's tabs
import { rollLootRarity, pileSource, dungeonRarityTier, dungeonFamily, stampWonWeapons } from '../systems/lootRarity.js';   // LR1: the item ladder over every list this host mints (a foe's through hostCombat.spawnEnemyLoot, RF2)
import { foeHitFlash, setBatchHitFlash, puppetHurtStep } from '../systems/hitFlash.js';   // HITFLASH1
import { coverDistance, coverStep, createCoverIndex, isCoverFlat, coverProxy } from '../ai/cover.js';   // TACT1: billboards are cover
import { blowConnects, blowScaled } from '../ai/foeBlows.js';   // TACT4



/**
 * @param deps {{renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord}}
 * @param dfLocation location with a dungeon
 * @param blocks BlocksFile
 * @param climateBaseType ClimateBases value for the table remap
 */
// AUDIT 26 F079: the ONE CreateItem.lastSelectedIndex static now
// lives with the law in systems/createItem.js - this host and the
// world host each kept a copy, so the picker opened on the other's row.

/** WORLD2: a puppet's feet ease toward the streamed feet over the stream's interval (FOES_MS, net/online.js). */
const PUPPET_EASE_S = 0.2;
/** WORLD2: a streamed jump past this (scene units) is a teleport: snapped, not walked. */
const PUPPET_SNAP = 3;
/** WORLD2: a streamed move under this per frame is standing still (the walk cycle stops). */
const PUPPET_STILL = 0.02;
const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000; const GENDER_BIT = ['male', 'female'];   // WORLD3: the stream's x bit, decoded (no roll - the host's word)
/** AUDIT WORLD3 F2: how far from the origin a streamed striker's feet may be before the host stops believing them.
 *  A dungeon block is 4096 classic units and a location is at most 8 of them a side, so this is orders past any
 *  honest position and still far inside the range where the collider's substep arithmetic is bounded. */
const HIT_POS_MAX = 1e6;
// AUDIT FOES FOE5: the most damage one peer's blow may claim. The host TRUSTS the number (it never recomputes - the
// striker's own calc is the game's), so without a bound any joiner could one-shot every foe in the room and empty it
// through the kill door. The exterior twin has carried this bound since WORLD6b (exteriorFoes.js:2685); the dungeon
// had none. Past anything a legal swing, shaft or blast can roll.
const HIT_DMG_MAX = 10000;
/** REST-SYNC: a joiner's ask is answered - or given up on - inside this long: its rest breaks once, at the next hour. */
export const REST_ASK_WAIT_MS = 15000;
/** REST-SYNC: one ask a player this often (a rest breaks at its first encounter; an honest client asks once a rest). */
export const REST_ASK_GAP_MS = 20000;
/** REST-SYNC: the widest band an ask may name - IntermittentEnemySpawn's dungeon arm is 20 (encounters.js). */
export const REST_ASK_BAND_MAX = 64;
/** REST-SYNC: the most shared encounters one frame carries (the standing first) - a rest spawns one; past any honest room. */
export const SHARED_FOES_MAX = 32;
/** AUDIT FINAL F7: how long a death's record names the joiner whose blow it was (roomRecord's `v`) - two of the stream's
 *  full frames (net/online.js FOES_FULL_MS, 2000), so the one that heals a dropped delta carries it too. The name is for
 *  the joiner's own kill door, which hears the death once, as it lands; a corpse that named its striker for as long as it
 *  lay grew every full frame by its name, and 453 of an elite dungeon's (joiners' kills, most of them) broke the frame's
 *  64 KiB - the host's stream refused whole, for good (online.js sendFoes). */
export const KILLED_BY_MS = 4000;
/** REST-SYNC: the bytes a foes frame keeps back from FOES_FRAME_MAX for its envelope (`{"t":"foes","data":}`) and keys. */
const FOES_FRAME_SLACK = 64;
/** AUDIT WORLD3 E3: can the ONE build chain actually stand this species? Both of buildFoeAt's branches need a truthy
 *  maleTexture (ENEMY_BASICS[39] has 0), and without this the rebuild fell to the build-time flat fallback, never
 *  stood, and was retried on every frame of the stream. ONE HOME for the two readings. */
const canStandFoe = (mobileType) => !!ENEMY_BASICS[mobileType]?.maleTexture;

/** WATER-D1: the dungeon water plane's colour - the classic water tile
 *  (the climate ground archive's record 0, the 0xFF tilemap sentinel's
 *  target) tinted only by alpha. ONE HOME: both dungeon hosts carried
 *  this literal beside their own copy of the draw call, and the draw
 *  is the context's now (see drawFoes), so the colour is too.
 *  AUDIT 65 CV-3/MC-5: this 0.82 is the FLAT alpha drawWater's quad
 *  takes - NOT render/waterSurface.js's WATER_OPACITY, which is the
 *  enhanced surface's Fresnel FLOOR (a different pass, no Fresnel, no
 *  shore feather). They agree by taste, not by law. */
export const DUNGEON_WATER_COLOR = Object.freeze([1, 1, 1, 0.82]);

/**
 * OH-D: Renderer.bounds.max.y of one placed model - the mesh's own local
 * box (Mesh.bounds, the vertices' extent), its eight corners through the
 * placement matrix, the highest (a MeshRenderer's world bounds are the
 * transformed box's, not the transformed vertices').
 */
export function boundsTopY(positions, m) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!(x1 >= x0)) return -Infinity;
  let top = -Infinity;
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) top = Math.max(top, m[1] * x + m[5] * y + m[9] * z + m[13]);
  return top;
}

export async function buildDungeonContext(deps, dfLocation, blocks, climateBaseType, opts = {}) {
  const { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette } = deps;

  // Layout needs synchronous models (doors/exit extraction); a unit-size
  // pre-pass mirrors the standalone scene.
  const preModels = new Map();
  const getModelPre = (id) => {
    if (!preModels.has(id)) {
      const custom = customModelFor(id);   // DS1: a registered model (world/customModels.js), asked before ARCH3D
      const alias = custom ? null : customAliasFor(id);   // WD3: an alias stands its classic model's geometry
      const index = custom ? -1 : alias ? arch.getRecordIndex(alias.model) : arch.getRecordIndex(id);
      if (custom) preModels.set(id, custom);
      else if (index === -1) {
        // DS1: GetModelData answers false (RDBLayout.cs:634-638) - nothing drawn, no door taken - a world-data
        // block naming a model no one supplies is DFU's logged miss, never a thrown dungeon
        console.warn(`[dungeon] model ${id}: not in ARCH3D and no mod supplies it - nothing stands there, as in DFU`);
        preModels.set(id, emptyModel());
      } else preModels.set(id, dfMeshToModel(arch.getMesh(index), () => ({ width: 1, height: 1 })));
    }
    return preModels.get(id);
  };

  const dungeon = layoutDungeon(dfLocation, blocks, getModelPre);
  // ARENA-FIX 4: THE ARENA UNDERCROFT IS THE FIGHTERS' HALL (world/arenaUndercroft.js): its people, the training pit's
  // dummy, the Hall of Champions' trophies and the beasts' chains stood at the layout's own markers, as flats of the
  // block they stand in (a copy of the layout - the laid block is shared); its beasts below, and no random foe
  const _undercroftHall = isArenaUndercroft(dfLocation) ? undercroftPopulation(dungeon.blocks) : null;
  if (_undercroftHall) {
    for (const [bi, b] of dungeon.blocks.entries()) {
      const mine = _undercroftHall.flats.filter((f) => f.block === bi);
      if (mine.length) b.layout = { ...b.layout, flats: [...b.layout.flats, ...mine] };
    }
  }
  const remap = (archive) => applyTextureTable(archive, dungeon.textureTable, climateBaseType);

  // SPAWNED-DUNGEONS-TTL: told once, the moment this context is built for a dungeon this client's own
  // hash synthesized (world/spawnedDungeons.js's `spawned: true` - never true for any real location).
  // The host wires this to the online room's spawn notice, which is itself a no-op outside a world
  // room, so it costs nothing offline or in a real dungeon - and nothing at all until a host passes it.
  if (dfLocation?.spawned) opts.onDungeonSpawned?.();

  const drawList = [];
  const dynamicDraws = [];
  // PERF5: THE LEVEL'S STATIC MODELS AS ONE MESH. drawList draws every
  // placed model with its own call (the automap still walks it, one
  // entry per revealed model); the main view draws the merge instead -
  // one call per resolved texture for the whole level - and skips the
  // entries it holds. Action objects (dynamicDraws) move and stay out.
  // Built lazily on the first read, after every block has been placed;
  // freed by destroy().
  let staticBatch = null, staticBuilt = false;
  const staticBuilder = new StaticBatchBuilder({ shadowCell: SHADOW_CELL_SIZE });   // LA-AUDIT A1: every light's lo map culls the level by cell
  const automapEntries = [];   // A1: { key, aabb } per draw entry - the reveal index's rows
  // OH-D: the highest point of any model the dungeon stands (every DaggerfallMesh's Renderer.bounds.max.y,
  // inactive ones included) - There's a Hole in the Bottom of the Ocean floods the abyss a metre over it
  let meshTopY = -Infinity;
  const collider = new Collider(() => -Infinity);
  collider.cover = createCoverIndex();   // TACT1: the flats' cover, read with the switch on
  // DISC29-A: THE SURFACES A WALK-ON READS. An effect or relay model's triangles go into the shared 'dungeon' bucket
  // (the player stands on them there), so the walk-on pass could not ask whether THIS object was under the feet and
  // read the top of its box instead - a throne's box tops its backrest, a metre and a half over the seat. A Collision01
  // effect or relay keeps a copy of its triangles here under its own key. Nothing moves against this collider; the
  // walk-on pass only probes it (collisionTriggers, actionSystem.js ownSurfaceUnderFeet). Movers and doors are already
  // their own buckets in `collider`.
  const triggerSurfaces = new Collider(() => -Infinity);
  // Effect actions (Hurt traps) damage the shared player entity;
  // health floors at 0 (death screen: UI arc). Traps work with or
  // without ?foes - the entity import is static.
  const actions = new ActionSystem(collider, {
    // ROAD-B: PlayerEnterExit.IsPlayerInsideDungeonCastle, the read
    // AttemptBash's tail makes (DaggerfallActionDoor.cs:220-221). The
    // SAME live block lookup the music context takes below - it is the
    // same question, asked at the door instead of at the song.
    insideDungeonCastle: () => (lastPlayerFeet ? castleBlockAt(lastPlayerFeet[0], lastPlayerFeet[2]) : false),
    // AUDIT 64 F40: DaggerfallAction.cs:739 (DrainHealth21) and :768
    // (DrainHealth, flags 22-25) SEND `RemoveHealth`, and Unity's
    // SendMessage reaches EVERY component on PlayerObject - both
    // PlayerHealth.cs:36-44 (the flash, rung by the action system)
    // AND PlayerFootsteps.cs:348-364 (the 40% pain cry). The cry
    // belongs HERE, on the trap sink, not inside hurtPlayer: that
    // function also carries the fall (:4493), and PlayerHealth.cs:57
    // CALLS its own RemoveHealth, so a fall flashes and stays silent.
    // The roll rides the RAW damage - PlayerFootsteps knows nothing of
    // the shield pool, and its heavyDamage test (:356) is on `amount`.
    damagePlayer: (dmg) => {
      hurtPlayer(dmg);
      playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
    },
    castSpell: (index, origin) => { _pendingCasts.push({ index, origin }); },   // consumed once spells load
    drainMagicka: (n) => {
      playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
      surfacePlayer();
    },
    // SetGlobalVar (0x1f): DFU's delegate writes
    // PlayerEntity.GlobalVars; the port's 64-global store lives on the
    // quest machine (systems/quest/machine.js globalVars - the same
    // Map a GlobalVarLink task reads), so the sink is the bridge's
    // machine. No bridge (a headless boot) leaves the action inert
    // beyond its cascade.
    setGlobalVar: (index, value) => { opts.questBridge?.machine?.globalVars?.set(index, value); },
    playerLevel: () => playerEntity.level,
    lockpickSkill: () => skillValue(playerEntity, SKILLS.Lockpicking),   // R1: GetLiveSkillValue at attempt time
    // ROAD-B B4: CastleDaggerfallMagicDoorsSpecialOpenHack's three
    // ambient reads (DaggerfallAction.cs:261-263). This host IS the
    // dungeon, so IsPlayerInsideDungeon is true by construction; the
    // teleport latch is the entity field TeleportAnchor writes
    // (PlayerEnterExit.PlayerTeleportedIntoDungeon), and the map id is
    // the location's own MapTableData.MapId.
    magicDoorsContext: () => ({
      playerTeleportedIntoDungeon: !!playerEntity.playerTeleportedIntoDungeon,
      isPlayerInsideDungeon: true,
      currentMapId: dfLocation?.mapTableData?.mapId ?? 0,
    }),
  });
  // A1: sound. DAGGER.SND loads through the data seam; the context
  // starts on the first gesture (mobile discipline). Dungeon doors
  // ride the DFU dungeon clips (DaggerfallActionDoor's RDB shape).
  // AUDIT 19 F1(doctrine): this host called audio.ensure and music.ensure
  // DIRECTLY, not through the shared seam - so the F6 pin's own
  // justification ("a host physically cannot take one and miss the
  // other") was false here, and deleting the music bootstrap left a
  // ?dungeon boot permanently silent while the whole suite passed. It
  // takes the seam now, like the other three hosts, and the pin requires
  // it of every host rather than asserting it of the seam alone.
  const _audioUp = ensureAudio(fetchBytes);   // AUDIT 18 F6: sound + music, one idempotent bootstrap
  // AUDIT 19 F4 (critical): the music start USED to sit right here and
  // read `classicMinutes` - a `let` declared ~1000 lines and THIRTY awaits
  // later. The promise resolved DURING one of those awaits, so every
  // dungeon boot threw a TDZ ReferenceError and painted the crash overlay.
  // It now starts at the end of this function, where every binding exists.
  // A `.then` registered early is not "later"; it is "as soon as the first
  // await yields".
  actions.onDoorState = (o, opening) => {
    const m = o.matrix;
    audio.play3d(opening ? SOUND.DungeonDoorOpen : SOUND.DungeonDoorClose, [m[12], m[13], m[14]]);
  };
  const texRemap = new Map();
  const resolveTexKey = keyResolver(texRemap);   // PERF5: drawMesh's own remap resolution
  const flatGroups = new Map();
  /** AUDIT 64 F13: THE DUNGEON'S STATIC NPCs. RDBLayout.AddFlat
   *  (RDBLayout.cs:1204-1247) does two things to a flat that the port
   *  had dropped whole:
   *    :1226-1231  a flat in NPCFlatArchives (334/346/357/175-184,
   *                :1250-1254) gets a StaticNPC with SetLayoutData(obj)
   *                - the overload that stamps Context.Dungeon
   *                (StaticNPC.cs:145-160) - which is what makes the
   *                people in Castle Daggerfall, Wayrest and Sentinel
   *                clickable, nameable and talkable, and what
   *                systems/topicTree.js's castle-questor arm reads.
   *    :1233-1236  SetupIndividualStaticNPC runs for EVERY flat, NOT
   *                only the NPC ones - the away arm deactivates the
   *                home copy of an individual a quest has placed
   *                elsewhere, and everyone else gets the bootstrap
   *                QuestResourceBehaviour a follow-up quest is handed
   *                out through.
   *  The billboard IS hittable in DFU only because of the first act:
   *  DaggerfallBillboard.cs:318-319 gives an NPC-archive flat
   *  FlatTypes.NPC and :343-349 gives that type a trigger BoxCollider. */
  const people = [];
  const lights = [];
  const iilLightFlats = [];   // IIL1: Improved Interior Lighting hangs its dungeon lights on these
  const waterQuads = [];
  let _waterArchive = null;   // WATER-D1: the climate ground archive whose record 0 is the water tile - the host names it after the build
  let _waterT = 0;            // WATER-D1: the scroll clock, in seconds of drawn frames
  const exitDoors = [];
  /** AUDIT-SEATS (Seats-Arc 9.2): a castle block's shelf-set models - `{ aabb }` - which a crown's Hall of Records is read
   *  from (scenes/worldModes.js); geometry in DFU's castle, as a palace's are. */
  const castleShelves = [];
  let colliderTris = 0;

  const ensureRemap = async (id) => {
    // NEVER TRAPS: cpuModels is written only on getGpuMesh's SUCCESS
    // path, so a model id this ARCH3D lacks arrives here as undefined.
    // The seam guards that VALUE and not the receiver - this was safe at
    // its placement call site only because `if (!gpu) continue` runs
    // one line before it, and the action-door arm below had no such
    // guard, so a missing door model threw here at LOAD.
    //
    // The dungeon's law is its own RDB texture table, keyed on the
    // archive alone; everything below it is the same law the climate
    // hosts run (WM3 gave the four copies one home).
    await remapSubMeshes(cpuModels.get(id)?.subMeshes, texRemap, (archive) => remap(archive), deps);
  };

  // The MOVE-flag flats, each with its own single-flat billboard batch
  // (wave D). A grouped batch cannot move one of its members, which is
  // why these leave flatGroups: `{ o, archive, record, drawn }`, and
  // the batch is minted with the rest of the flat art below.
  const moveFlats = [];
  const moveFlatBatches = new Map();   // action key -> its batch
  // ActionSystem tweens the flat and tells the host where it got to -
  // the same shape onDoorState has. The batch was built ONCE at the
  // flat's placed origin, so flight rides the batch's origin uniform
  // (the missile law, :2135 - zero GL churn).
  actions.onFlatMoved = (o) => {
    const b = moveFlatBatches.get(o.key);
    if (b) b.origin = [o.offset[0], o.offset[1], o.offset[2]];
  };

  // One registration path for acting FLATS (audit 2026-08-16: flat and
  // marker actions were never registered - classic flat levers/trigger
  // zones were dead). The box brackets the billboard the way DFU's
  // AddAction BoxCollider brackets the flat; effects keep their verbatim
  // origin.
  //
  // WAVE D - THE MOVE-FLAG FLAT MOVES. This arm used to send every
  // move-flag flat to addRelay: the chain lived and the motion did not,
  // recorded (loudly) as "no mesh to tween here". DFU hands a flat the
  // SAME DaggerfallAction a model gets - AddActionFlatHelper
  // (RDBLayout.cs:904-944) calls AddAction, whose Translation /
  // Rotation / PositiveX..NegativeZ cases build ActionTranslation and
  // ActionRotation for description "FLT" exactly as for a model - and
  // a flat is a transform, so iTween.MoveTo carries it. It needed no
  // mesh: a billboard batch moves by its origin uniform, which is how
  // the missiles above have flown since S5. `drawn` is false for an
  // acting MARKER (archive 199), which has no billboard in this port
  // at all - its chain and its state machine are the whole of it.
  const registerFlatAction = async (ns, position, action, x, y, z, archive, record, drawn = true) => {
    let aabb = null;
    const t = await getTexture(archive);
    if (t && record < t.recordCount) {
      const size = billboardSize(t, record);
      aabb = {
        min: [x - size.w / 2, y - size.h / 2, z - size.w / 2],
        max: [x + size.w / 2, y + size.h / 2, z + size.w / 2],
      };
    }
    if (EFFECT_ACTION_FLAGS.has(action.actionFlag)) {
      const eo = actions.addEffect(ns, position, action, [x, y, z]);
      if (aabb) eo.aabb = aabb;
    } else if (MOVE_ACTION_FLAGS.has(action.actionFlag)) {
      const o = actions.addMoveFlat(ns, position, action, [x, y, z], aabb);
      moveFlats.push({ o, archive, record, drawn });
    } else {
      actions.addRelay(ns, position, action, aabb, [x, y, z]);
    }
  };

  // P10: teleport destinations resolve through a per-block-instance
  // position index (destinations are usually actionless editor flats
  // that live in no other runtime structure). Keys are `${ns}:${pos}`
  // where ns = the block INSTANCE index - positions are block-local
  // byte offsets and 3108/4232 dungeons repeat blocks (the same ns
  // that namespaces every chain key).
  const positionIndex = new Map();
  const torches = [];         // A2: { pos, handle } - looping Burning sources gated by range
  const ambientAnimals = [];  // A2: { pos, sound } - random-cadence barks (A4: consumed by the shared module)
  const dungeonHearths = []; // HEARTH1: { x, y, z, foot, w, h } - the braziers and fire bowls, for the survival law (FIX-D: and their sprites, for the eye)
  const animalAmbience = createAnimalAmbience(audio, () => ambientAnimals);
  for (const [bi, b] of dungeon.blocks.entries()) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    // ROAD-C c2/S1: DFU's automap discovery record is POSITIONAL -
    // block -> blockElement -> model (Automap.cs:66-79). The two
    // elements are RDBLayout's "Models" and "Action Models" nodes, in
    // that creation order (:165-168), and a model lands in one by
    // `(hasAction) ? actionModelsParent : modelsParent` (:644). The
    // port keeps its own stable `${bi}:${position}` key as the SAVE
    // key and carries this address as metadata beside it.
    const amapModelCount = [0, 0];
    const amapWater = automapWaterLevel(b.layout.waterLevel);
    // ROAD-C c2/S7: the row also carries the CPU TRIANGLES and the
    // matrix they were placed with, so the automap PICKER can answer a
    // mouse position with a triangle-precise hit instead of a box. The
    // two are REFERENCES to arrays this loop already holds - the shared
    // `cpuModels` entry and the placement matrix the draw list keeps -
    // so the whole picker costs two pointers per entry and no copy.
    const amapRow = (key, aabb, hasAction, cpu = null, matrix = null) => {
      const elementIndex = hasAction ? 1 : 0;
      return {
        key,
        aabb,
        blockIndex: bi,
        blockName: b.name,
        elementIndex,
        elementName: ELEMENT_NAMES[elementIndex],
        modelIndex: amapModelCount[elementIndex]++,
        waterLevel: amapWater,
        positions: cpu?.positions ?? null,
        indices: cpu?.indices ?? null,
        normals: cpu?.normals ?? null,   // DISC22-G: the file's facing - the enhanced map tells a floor from a ceiling by it
        matrix,
      };
    };
    for (const [pos, e] of b.layout.objectPositions) {
      positionIndex.set(`${bi}:${pos}`, { pos: [e.x + b.originX, e.y, e.z + b.originZ], yawDeg: e.yawDeg });
    }
    for (const p of b.layout.placements) {
      const matrix = multiply(originMatrix, p.matrix);
      const gpu = await getGpuMesh(p.modelIdNum);
      if (!gpu) continue;
      await ensureRemap(p.modelIdNum);
      const cpu = cpuModels.get(p.modelIdNum);
      // A1: every placement's world AABB, computed once - the action
      // arms below and the automap reveal index both read it.
      const aabb = worldAabb(cpu.positions, matrix);
      if (b.layout.castleBlock && isShopShelfModel(p.modelIdNum)) castleShelves.push({ aabb });   // AUDIT-SEATS: a crown's Hall of Records
      meshTopY = Math.max(meshTopY, boundsTopY(cpu.positions, matrix));   // OH-D
      let standable = null;   // DISC29-A: the effect or relay this model is, for triggerSurfaces below
      if (p.action) {
        // Verbatim AddActionModelHelper classification (audit
        // 2026-08-16: only move/effect registered before - every
        // chain through a Teleport/Activate/verb/text object died,
        // and lever-driven stone doors never swung).
        const cls = classifyPlacementAction(p.action.actionFlag, false);
        if (cls === 'move') {
          const o = actions.addAction(bi, p.position, cpu, matrix, p.action);
          // Audit 06f: movers carry their AT-REST bounds so step-on
          // platforms (classic Collision01 elevators) collision-trigger;
          // the pass only tests movers while parked at 'start', where
          // the static AABB is truthful.
          o.aabb = aabb;
          o.restOnlyTrigger = true;
          dynamicDraws.push({ gpu, object: o });
          automapEntries.push(amapRow(o.key, aabb, true, cpu, matrix));   // A1: revealed at the AT-REST bounds (a moved platform's probe misses - recorded)
          continue;
        }
        if (cls === 'specialDoor') {
          // DaggerfallActionDoorSpecial: OpenDoor (or CloseDoor on a
          // non-door) turns a plain model into a hinged special door -
          // own bucket, swings on the chain or the player's hand.
          const o = actions.addSpecialDoor(bi, p.position, cpu, matrix, p.action);
          // AUDIT 63 F38: a special door is a plain model that went
          // through AddActionModelHelper, so AddAction (RDBLayout.cs:897)
          // gave it DaggerfallActionCollision on a Collision01/03/09 or
          // MultiTrigger flag exactly as it does any other model
          // (RDBLayout.cs:992-996). It needs a box to be walked into.
          o.aabb = aabb;
          o.restOnlyTrigger = true;
          dynamicDraws.push({ gpu, object: o });
          automapEntries.push(amapRow(o.key, aabb, true, cpu, matrix));   // A1
          continue;
        }
        if (cls === 'effect') {
          // Hurt/Poison/DrainMagicka/CastSpell: chain-participating
          // logic object; the model stays static (draw + collider
          // below). Origin = the placement translation (CastSpell
          // fires missiles from here, +40*GlobalScale up, verbatim).
          const eo = actions.addEffect(bi, p.position, p.action, [matrix[12], matrix[13], matrix[14]], p.modelIdNum);
          eo.aabb = aabb;   // collision triggers test against this
          standable = eo;
        } else {
          // Relay: the delegate is routed (Teleport/text) or a
          // verbatim no-op; the CHAIN through it must live, and its
          // collider makes it a Direct/Attack/collision target.
          standable = actions.addRelay(bi, p.position, p.action, aabb, [matrix[12], matrix[13], matrix[14]], p.modelIdNum);
        }
      }
      // A1: the entry carries its identity (the action system's own
      // `${bi}:${position}` key) + world AABB so the automap window
      // can filter the LIVE list by the revealed set - no duplicate
      // geometry (Automap.cs duplicates the whole level instead).
      drawList.push({ mesh: gpu, matrix, key: `${bi}:${p.position}`, aabb });
      // PERF5: the remap for this model is in the map (ensureRemap above); the entry stays in drawList for the automap
      if (cpu.normals && cpu.uvs) { staticBuilder.add(cpu, matrix, resolveTexKey); drawList[drawList.length - 1]._batched = true; }
      automapEntries.push(amapRow(`${bi}:${p.position}`, aabb, !!p.action, cpu, matrix));
      collider.addMesh('dungeon', cpu.positions, cpu.indices, matrix);
      if (standable && hasActionCollision(standable)) triggerSurfaces.addMesh(standable.key, cpu.positions, cpu.indices, matrix);   // DISC29-A; AUDIT PRE-MERGE 0929 D1/D2: every collision-trigger model's, for its contact
      colliderTris += cpu.indices.length / 3;
    }
    for (const d of b.layout.actionDoors) {
      if (d.disabled) { const c = cpuModels.get(d.modelIdNum) ?? null; if (c) meshTopY = Math.max(meshTopY, boundsTopY(c.positions, multiply(originMatrix, d.matrix))); continue; }   // OH-D: an overlapping door is SetActive(false), still a DaggerfallMesh the flood's GetComponentsInChildren(true) reads
      const matrix = multiply(originMatrix, d.matrix);
      const gpu = await getGpuMesh(d.modelIdNum);
      // THE FOURTH SEAM. The placement loop fifty lines above has
      // `if (!gpu) continue`; this arm did not, and a door model
      // absent from the player's ARCH3D trapped it three ways over -
      // ensureRemap's undefined receiver, then addDoor's cpu.positions,
      // and then a {gpu: null} entry the frame loop draws unguarded.
      const cpu = cpuModels.get(d.modelIdNum);
      if (!gpu || !cpu) {
        console.warn(`[dungeon] action-door model ${d.modelIdNum} is not in this ARCH3D - the door is skipped`);
        continue;
      }
      await ensureRemap(d.modelIdNum);
      meshTopY = Math.max(meshTopY, boundsTopY(cpu.positions, matrix));   // OH-D: the door at rest
      // Chain key + own action record + the starting lock (audit
      // 2026-08-16 + P10: chained doors were unreachable and locks
      // had no state to gate on; the P10 player-toggle lock gate now
      // reads currentLockValue).
      const o = actions.addDoor(cpu, matrix, {
        ns: bi, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue,
        loadID: d.loadID,   // ROAD-B B4: RDBLayout.cs:242 - the Castle Daggerfall foyer hack names its two doors by this
      });
      // AUDIT 63 F38: an action door WITH a record is a
      // DaggerfallActionCollision too. RDBLayout.cs:255-259 runs
      // AddActionModelHelper on the door GameObject `if (HasAction(obj))`,
      // that reaches AddAction (:897), and AddAction attaches the
      // collision component on Collision01/Collision03/MultiTrigger/
      // Collision09 (:992-996) with no door exclusion - which is why
      // DaggerfallActionDoor.cs:263 can note "Some Castle Wayrest doors
      // have 'MultiTrigger' trigger flag". Without a box the port's
      // collision pass skipped every door, so bumping such a door never
      // fired its record: no plaque line and no trespass check. The box
      // marks the door as walkable-into; restOnlyTrigger is the door's
      // OWN law, since Open() calls MakeTrigger(true)
      // (DaggerfallActionDoor.cs:293, :354-358) and a swinging or open
      // door can no longer be collided with at all.
      if (d.action) {
        o.aabb = worldAabb(cpu.positions, matrix);
        o.restOnlyTrigger = true;
      }
      dynamicDraws.push({ gpu, object: o });
      // ROAD-C c2/S1: ACTION DOORS ARE NOT ON THE AUTOMAP. DFU's
      // automap copy has none - AddModels skips them outright
      // ("Filter action door models / These must be added by
      // AddActionDoors()", RDBLayout.cs:625-627) and AddActionDoors is
      // never called on the automap run. A1 pushed them here, which
      // both drew doors the classic map never draws and made a closed
      // door a revealable surface. The door still matters to the map:
      // it is the BLOCKER the three-ray scan reads off its own
      // collider bucket (systems/automap.js).
    }
    for (const f of b.layout.flats) {
      // AUDIT 64 F13, first act: the StaticNPC identity, in the parent
      // frame like every other coordinate here. `y` stays the RDB flat's
      // raw pivot (the batch below base-centres it); the activation box
      // takes the same conversion once the archive answers its size.
      const pn = f.npc ? {
        x: f.x + b.originX, y: f.y, z: f.z + b.originZ,
        textureArchive: f.archive, textureRecord: f.record,
        factionID: f.factionID, flags: f.flags,
        // StaticNPC.cs:149-151 hashes the RAW, UN-NEGATED record ints.
        rawX: f.rawX, rawY: f.rawY, rawZ: f.rawZ,
        // StaticNPC.cs:155 seeds the name off the FLAT RESOURCE's
        // stream position, not the object offset the actions key on.
        position: f.flatPosition,
        // StaticNPC.cs:159. buildingKey stays 0 (:158) - the struct
        // default, and a dungeon has no building.
        context: NPC_CONTEXT.Dungeon,
        // PlayerActivate.cs:745-751 keeps its own copy of the flat's
        // action: an NPC "carrying specific non-dialog actions" is not
        // activated as a person at all.
        action: f.action,
        active: true, questBehaviour: null,
        arenaRole: f.role ?? null,   // ARENA-FIX 4: an undercroft person's office (the Pit Master, the Keeper of the Hall, ...)
      } : null;
      if (pn) people.push(pn);
      // ...and the second act, for EVERY flat carrying a faction id.
      if (f.factionID) {
        const host = {
          staticNpcFactionId: f.factionID,
          isActive: () => (pn ? pn.active !== false : true),
          setActive: (a) => { if (pn) pn.active = !!a; },
          destroy: () => { if (pn) pn.active = false; },
        };
        const setup = opts.setupStaticNpc?.(f, host);
        if (setup && setup !== true && pn) pn.questBehaviour = setup;
        // QuestMachine.cs:1334-1341's away arm has already called
        // SetActive(false), and a disabled GameObject is out of the
        // draw, out of the ray and out of its own action chain - so the
        // flat is WITHHELD here, which a centre already baked into a
        // shared batch could not be.
        if (setup === false) continue;
      }
      const key = `${f.archive}_${f.record}`;
      // WAVE D: a MOVE-flag flat is drawn by its OWN single-flat batch
      // (registerFlatAction mints it) - a member of a grouped batch
      // cannot be moved on its own, and this is the one flat in the
      // block that has to move.
      if (!(f.action && MOVE_ACTION_FLAGS.has(f.action.actionFlag))) {
        if (!flatGroups.has(key)) flatGroups.set(key, []);
        const at = [f.x + b.originX, f.y, f.z + b.originZ];
        if (pn) at.noCover = true;   // AUDIT TACT B3: a person is no cover (the world's people never are)
        flatGroups.get(key).push(at);
      }
      // A2 ambient sources: burning torches (RDBLayout.IsTorchFlat,
      // 210/{0,1,6,16..20}) loop within 5; animal flats (201) bark on
      // the classic random cadence within 19.2.
      if (f.archive === IIL_LIGHT_ARCHIVE) iilLightFlats.push({ x: f.x + b.originX, y: f.y, z: f.z + b.originZ });   // IIL1: every light billboard's centre (an RDB flat's y is its centre)
      if (f.archive === TORCH_ARCHIVE && TORCH_RECORDS.has(f.record)) {
        torches.push({ pos: [f.x + b.originX, f.y, f.z + b.originZ], handle: null });
      } else if (f.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[f.record] != null) {
        ambientAnimals.push({ pos: [f.x + b.originX, f.y, f.z + b.originZ], sound: ANIMAL_SOUND_BY_RECORD[f.record] });
      }
      if (f.action) await registerFlatAction(bi, f.position, f.action, f.x + b.originX, f.y, f.z + b.originZ, f.archive, f.record);
      // HEARTH1 (Mac: "Does this version of C&C not let you use braziers
      // as extra campfires to cook from?"): a dungeon's own fires. The
      // block frame, off the walk that was already reading every flat -
      // unlike the two exterior hosts there is no lantern list to split
      // this from, because a dungeon's lights are RDB Light RESOURCES
      // (collectDungeonLights) with no texture record at all, and the
      // fires are flats.
      //
      // FIX-D: and its SPRITE, for the eye's box - an RDB flat's stored
      // y is its CENTRE (the batch below shifts down half a height to
      // stand it), so the foot is half the flat's own height under it.
      if (isHearthFlat(f.archive, f.record)) {
        const t = await getTexture(f.archive);
        const size = t && f.record < t.recordCount ? billboardSize(t, f.record) : null;
        dungeonHearths.push({ x: f.x + b.originX, y: f.y, z: f.z + b.originZ, foot: size ? f.y - size.h / 2 : undefined, w: size?.w, h: size?.h });
      }
    }
    for (const m of b.layout.markers) {
      // Acting markers join the runtime too (DFU AddActionFlatHelper
      // runs for EVERY flat with action > 0, editor flats included).
      // Records 15/16 are SetActive(false) in DFU - Receive early-outs
      // on inactive objects, so their actions are inert; preserved by
      // skipping them (audit 2026-08-16).
      if (!m.action || m.record === 15 || m.record === 16) continue;
      await registerFlatAction(bi, m.position, m.action, m.x + b.originX, m.y, m.z + b.originZ, m.archive ?? 199, m.record, false);
    }
    for (const l of collectDungeonLights(b.dfBlock)) {
      lights.push({ x: l.x + b.originX, y: l.y, z: l.z + b.originZ, range: l.range });
    }
    if (_undercroftHall && bi === 0) for (const l of _undercroftHall.lights) lights.push({ ...l });   // ARENA-FIX 4: the hall's lamps (the dungeon's frame), once
    // WATER-BACK (2026-09-22, kurkku: "invisible water", with a picture
    // of a dry dungeon): THE BAND-AID OUTLIVED ITS BUG BY ONE DAY.
    //
    // AIWATER (2026-09-20) took the water out of every SPAWNED dungeon
    // because "a spawn's water has been reported wrong every time -
    // shown well below the floor, in patches, reading like a no-clip
    // glitch", and said so honestly: "rather than keep chasing the
    // placement". WATER-D1 (2026-09-21, the next morning) then chased
    // it and CAUGHT it, and it was not the placement at all - both
    // dungeon hosts called `renderer.drawWater` AFTER drawFoes
    // returned, which is after the first screen quad, which is where
    // the enhanced-lighting lane resolves its frame target; the quad
    // landed on the default framebuffer whose depth buffer holds no
    // world, so it passed the depth test everywhere. A plane through
    // every wall and every floor, wherever you stood. WATER-D1's own
    // words: "The level itself was never the defect: the quads sit
    // exactly where DFU's AddWater puts its plane (R7)."
    //
    // A spawn was never special. It was just where people met the bug,
    // because spawns are where people were. With the cause closed the
    // exclusion only does what kurkku photographed: it makes a
    // flooded dungeon dry, which is the ONE thing nobody asked for.
    //
    // LostMyLeg's caution on the report - "when water textures are
    // activated again they clip through walls and players will see
    // water all the time" - is a memory of the pre-WATER-D1 defect, and
    // it is the right thing to be careful about: test/waterback.test.js
    // holds the draw ORDER that makes it safe, so the day someone moves
    // the call back after a screen quad, that reddens rather than
    // shipping.
    //
    // `b.layout.waterLevel` is still left alone, and that reason stands
    // whatever else changes: `dungeon.blocks` is the TEMPLATE'S own
    // shared array (world/spawnedDungeons.js synthesizeDungeonLocation),
    // so writing the sentinel into it would corrupt the real dungeon
    // this was cloned from and every other spawn sharing that template.
    if (b.layout.waterLevel !== 10000) {
      waterQuads.push({
        x: b.originX, z: b.originZ, size: RDB_SIDE,
        y: -b.layout.waterLevel * GLOBAL_SCALE,
      });
    }
    for (const door of b.layout.exitDoors) {
      // CRUX-DOOR: the layout's list is every door face the block's models carry; only a DungeonExit door leaves
      // (world/dungeonLayout.js isDungeonExitDoor, PlayerActivate.cs:649) - any other one is the model's, whose own
      // action (a Teleport) answers the click
      if (!isDungeonExitDoor(door)) continue;
      // Exit-door matrices are model-local under the block origin.
      exitDoors.push({ ...door, matrix: multiply(originMatrix, door.matrix) });
    }
  }

  // Enemies (C3): the classic selection over this dungeon's markers -
  // fixed (record 16) + random (record 15, LocationId-seeded tables).
  // Classic billboards join the flat batches (RDB raw-pivot rule);
  // gender picks the archive; record 0 is the standing frame (no AI -
  // Characters C5 rigs replace these).
  const _layoutEnemies = collectDungeonEnemies(
    dungeon.blocks.map((b) => ({
      markers: b.layout.markers, waterLevel: b.layout.waterLevel,
      originX: b.originX, originZ: b.originZ,
    })),
    {
      locationId: dfLocation.dungeon.recordElement.header.locationId,
      dungeonType: dfLocation.mapTableData.dungeonType,
      playerLevel: effectiveLevel(playerEntity),   // SOFTCAP2: a mentor's dungeon draws the GROUP's monsters. ChooseRandomEnemyType bands on the LIVE level (wired audit 2026-08-16; was stuck at the default 1)
    });
  // PROF2: A DUNGEON VEIN'S WALL (profIdentity / veinWall below; bible/06-Systems/Professions-Arc.md 23) - over the
  // layout's own markers, before an elite copy is added: every client of the dungeon casts the same rays.
  const PROF_VEIN_WALL_M = 12, PROF_VEIN_OFF_M = 0.33, PROF_VEIN_CHEST_M = 0.9, PROF_VEIN_UP_M = 0.5;
  /** AUDIT 29 C3: the rays read the dungeon's own mesh (its 'dungeon' bucket), never a door's or a platform's */
  const PROF_VEIN_ONLY = Object.freeze({ only: Object.freeze(['dungeon']) });
  function profVeinWall(marker, bearing) {
    const list = _layoutEnemies;
    if (!list?.length || !collider) return null;
    const first = Math.min(list.length - 1, Math.max(0, Math.floor(marker * list.length)));
    for (let m = 0; m < Math.min(4, list.length); m++) {
      const mk = list[(first + m) % list.length];
      for (let k = 0; k < 8; k++) {
        const a = bearing + (k * Math.PI) / 4;
        const dir = [Math.sin(a), 0, Math.cos(a)];
        const from = [mk.x, mk.y + PROF_VEIN_CHEST_M, mk.z];
        // AUDIT 29 C3: the dungeon's own mesh alone - a closed door's bucket (it exists only while shut) or a moving
        // platform's stood a vein in a doorway, and the next stand moved it: every client, every stand, one wall
        const hit = collider.raycastHit(from, dir, PROF_VEIN_WALL_M, PROF_VEIN_ONLY);
        if (!Number.isFinite(hit?.dist) || !hit.normal || Math.abs(hit.normal[1]) > 0.35) continue;   // a wall, not a floor or a ramp
        const d = Math.max(0, hit.dist - PROF_VEIN_OFF_M);
        const at = [from[0] + dir[0] * d, from[1], from[2] + dir[2] * d];
        const down = collider.raycast(at, [0, -1, 0], 3, PROF_VEIN_ONLY);
        if (!Number.isFinite(down)) continue;   // AUDIT 29 C11: no floor under it (a pit, deep water) - the next bearing, never a vein in the air
        return [at[0], at[1] - down + PROF_VEIN_UP_M, at[2]];
      }
    }
    return null;
  }
  // ELITE DUNGEONS: an elite spawned dungeon stands ELITE_FOE_MULTIPLIER foes at every marker.
  // The extras are pulled back from walls by a ray through this dungeon's own collider (every
  // peer has the same geometry, so every peer builds the same list - the foe frame's index law).
  // The ray starts at chest height so a step or a floor seam does not read as a wall.
  // ARENA-FIX 4: the hall stands no random foe - only the beast tier's chained beasts, passive at their markers (the undercroft is the city's own keep, never an elite spawn)
  const _hallBeasts = _undercroftHall ? _undercroftHall.beasts.map((b, i) => ({ x: b.x, y: b.y, z: b.z, mobileType: b.mobileType, fixed: true, reaction: 'passive', gender: 'unspecified', spawnDistanceType: 0, loadID: 0x55430100 + i, blockIndex: -1, arenaChained: i })) : null;
  const enemies = dfLocation?.elite
    ? expandEliteEnemies(_layoutEnemies, {
      copies: ELITE_FOE_MULTIPLIER,
      clearance: (from, dir, dist) => collider.raycast([from[0], from[1] + 0.9, from[2]], dir, dist),
      // DROPS-AUDIT ELITE-LEDGE: and the floor under a copy - a ray down from a metre over the marker's height, so a
      // copy off a walkway's edge (or onto a crate) reads as another floor and turns to the next bearing
      floor: (at) => { const d = collider.raycast([at[0], at[1] + 1, at[2]], [0, -1, 0], 3); return Number.isFinite(d) ? at[1] + 1 - d : null; },
    })
    : (_hallBeasts ?? _layoutEnemies);
  if (!_undercroftHall) markDungeonChampions(enemies, dfLocation.dungeon.recordElement.header.locationId);   // ARENA-FIX 4: no champion among the chained beasts   // LOOT7: the layout's champions, a hash of the place and the marker - every client the same, no wire word
  // ELITE FOES: an Elite Dungeon holds 3 or 4 champions among its foes - a pure pick over the list every client builds,
  // seeded by the dungeon's own id, so every client marks the same records (systems/eliteFoes.js)
  // ...and a normal dungeon at most one, one time in five
  // ONLINE ONLY: offline, no elites (the room's id is read straight off opts - onlineRoom() is declared below)
  // (ARENA-FIX 4: the undercroft's chained beasts stand passive, which the pick never takes)
  if (elitesAllowed({ onlinePage: isOnlinePage(), inRoom: opts.selfId?.() != null })) pickDungeonElites(enemies, dfLocation?.dungeon?.recordElement?.header?.locationId ?? dfLocation?.name ?? '', { elite: !!dfLocation?.elite });
  // C8 E1 (?foes): CLASS enemies (mobileType > 43, human morphology)
  // spawn as canonical rigs instead of their C3 billboards - one rig
  // per enemy (individual animation state), floor-snapped through the
  // dungeon collider (the FixStanding counterpart), IDLE gait, fixed
  // deterministic facing. Monsters (0-42) stay billboards until their
  // morphologies are authored (E4, rewrite/ bench). Flag off = C3
  // verbatim, untouched.
  const foes = [];
  // OH-E: GameManager.OnEnemySpawn for the foes stood after the layout (the layout's own are the build's, and There's a
  // Hole in the Bottom of the Ocean - the one listener - reads those at OnSetDungeon), and their LoadID:
  // DaggerfallUnity.NextUID's, here the context's own count (a layout foe's is its block position + marker's)
  let _layoutStood = false;
  let _spawnUid = 0;
  let foeDeps = null;
  let _staleChunkNotice = false;   // DISC19-D (AUDIT DISC19): the foe subsystem's chunk was gone - said on the first frame
  // ENHANCED AI 3b + 4. Declared HERE, above every foe mint, because
  // buildFoeAt runs in this function's top-level flow and reads
  // `enhancedNav.world` at construction - not through a thunk. The
  // first cut declared this 700 lines lower and every dungeon foe hit
  // the temporal dead zone inside buildFoeAt's per-foe try: no motor,
  // a floating billboard, no pursuit, no attack. Mac saw exactly that.
  // V4's sweep did not catch it because the read is inside a function
  // it cannot date. `world` is filled in the lazy block below, where
  // makeNavWorld is in scope; a foe-less dungeon leaves it null.
  const enhancedNav = { requested: false, client: null, chf: null, world: null };
  // S16: the SPELLS.STD map SetEnemyCareer resolves its lists against.
  // It loads after the marker foes are built (the `const spellsByIndex`
  // below), so the load loop runs with this still null and the one-time
  // pass at the load site fills it in; every foe minted AFTER that -
  // a rest interruption, a quest CreateFoe - assigns at BUILD time,
  // which is where DFU does it (EnemyEntity.cs:350-386, inside
  // SetEnemyCareer, i.e. on every construction).
  let foeSpellTable = null;
  if (opts.foes && palette) {
   try {
    // One import for the whole context; every per-enemy dependency
    // lives here (a fetchBytes reference inside the loop once pointed
    // at a name only in THIS block's scope - caught in review, hoisted).
    // AUDIT 68 S04-v-dungeon-dead-rig-deps: the rig's engineRig/raceCharacter imports and the BODY00I0 ramp derive
    // fed foeDeps keys nothing read (class enemies are sprite mobiles since C17), and a failure in them cost the dungeon its class enemies.
    const [{ EnemyAI, withinYaw, isBackFacing, openDoorsStep }, { EnemyAttack }, { makeEnemyEntity, loadMonsterCareer, applyProgressionScaling }, { EnemyCaster, castEnemySpell: castShared, hasMagickaToCast },
      { runTargetMachine, boutGate, isPlayerTarget, isLocalPlayerTarget, PLAYER_TARGET, PEER_CAST_TARGET, resetAllyTeamOnPlayerAttack, targetAimPoint, enemyArrowOrigin, enemyTransformPoint, arrowAimDirection, bumpAtkCount }] = await Promise.all([
      import('../characters/enemyMotor.js'), import('../characters/enemyAttack.js'),
      import('../characters/enemyEntity.js'), import('../characters/enemyCasting.js'),
      // MT-iv: dynamic, as the rest of this block. (AUDIT DISC19: the
      // gate saves nothing for these any more - enemyMotor, enemyTargets
      // and the rest were in this module's static graph already, and the
      // world host's bundle holds every one of them; only the standalone
      // ?dungeon host still loads five of them late.)
      import('../characters/enemyTargets.js'),
    ]);
    const formulas = await import('../combat/formulas.js');
    const { REACTIONS, sampleClip } = await import('../characters/anims.js');


    foeDeps = {
      REACTIONS, sampleClip,
      isBackFacing,
      chooseEnemyWeapon: formulas.chooseEnemyWeapon,
      dropWeaponIfTargetImmune: formulas.dropWeaponIfTargetImmune,   // AUDIT 58: EnemyAttack.cs:191-194

      calculateAttackDamage: formulas.calculateAttackDamage,
      openDoorsStep,   // C-slice: EnemyMotor.OpenDoors
      enemyLanguageSkill: formulas.enemyLanguageSkill,           // C-slice: pacification
      calculateEnemyPacification: formulas.calculateEnemyPacification,
      meleeHitConnects: formulas.meleeHitConnects,
      MELEE_HIT_YAW_DEG: formulas.MELEE_HIT_YAW_DEG,
      withinYaw,
      fetchBytes,
      floorLanding, EnemyAI, EnhancedEnemyAI, makeNavWorld, EnemyAttack, makeEnemyEntity, applyProgressionScaling, loadMonsterCareer, EnemyCaster, ClassFile, playerEntity,   // floorLanding/playerEntity/ClassFile/fetchBytes/generateItems ride the STATIC imports (audits 06c-06e)
      castEnemySpell: castShared,   // X3: the ONE cast executor (characters/enemyCasting.js)
      hasMagickaToCast,   // D9: GetDestination's `entity.CurrentMagicka > 0` (the stand-off band reads the caster's SelectedSpell instead)
      // MT-iv: the target machine. Every consumer below the lazy block
      // reads foeDeps.* and must guard on foeDeps first, as
      // resolvePlayerHit already does.
      runTargetMachine, isPlayerTarget, isLocalPlayerTarget, PLAYER_TARGET, PEER_CAST_TARGET, resetAllyTeamOnPlayerAttack, boutGate, bumpAtkCount,   // ARENA2: the bout team's gate (the foe yield floor's twin below); AUDIT WATCH1 (one home): the attack count's spelling on the wire, through the LAZY subsystem (MT-iv)   // AUDIT WORLD3 C3: the local player, told from any player; AUDIT WORLD6b-iii(a) A10: the peer's cast stand-in
      targetAimPoint, enemyArrowOrigin, enemyTransformPoint, arrowAimDirection,   // AUDIT 62 F21 (review): the ONE aim-point law, shared with the exterior pool   // ROAD-H H1/H1b: and the ONE arrow loose point + the crouch dip beside it
    };
    // ENHANCED AI 4: the routes' world - the per-frame findPath budget
    // and the nav epoch, one per host, every foe reading the same one.
    enhancedNav.world = makeNavWorld();
   } catch (err) {
     // The foe SUBSYSTEM failing to initialize (a dynamic import)
     // must not black-screen the level: degrade to a foe-less
     // dungeon, loudly. foeDeps stays
     // null; the class branch is skipped, monsters still billboard.
     // DISC19-D: WITHOUT ANY LIVE ENEMY - buildFoeAt falls back to a flat
     // for every marker, class or monster (the old line said "without
     // class enemies", which sent a reader to the wrong half). A chunk
     // the build no longer has is said on the screen: the page is from
     // an older deploy, and a reload is the whole fix (systems/staleChunk.js).
     console.error('[foes] subsystem init failed; the dungeon builds with no live enemies (every marker a flat):', err?.message ?? err);
     if (isStaleChunk(err)) _staleChunkNotice = true;   // said once the level is up - drawFoes below (AUDIT DISC19: set here, mid-build, it had timed out before the first frame)
     foeDeps = null;
   }
  }
  /** IF1: the infighting census for the F8 debug HUD. Counts what the
   *  target machine is actually doing to THIS host's live pool, so a
   *  report of "enemies don't fight each other" can be read off the
   *  screen instead of reasoned about. See the call site for how each
   *  reading is diagnosed. */
  function _foeCensus() {
    const live = foes.filter((f) => !f.dead && f.ai);
    const armed = live.filter((f) => f.ai._armedTargeting).length;
    const vsFoe = live.filter((f) => f.ai._armedTargeting && f.ai.target
      && !(foeDeps?.isPlayerTarget?.(f.ai.target) ?? true)).length;
    const teams = [...new Set(live.map((f) => f.entity?.team ?? '?'))];
    return `foes ${live.length}  armed ${armed}  vsFoe ${vsFoe}  deps ${foeDeps ? 'yes' : 'NO'}  teams ${teams.join(',') || 'none'}`;
  }

  /** One foe from a spawn record { mobileType, gender, x, y, z,
   *  spawnDistanceType } - the load loop's body, extracted so the
   *  E-slice encounter spawner can mint foes at runtime (a rest
   *  interruption builds through the SAME chain: entity, loot,
   *  equipment, AI, attack, sprite). Load-time flat fallbacks stay
   *  inside; a runtime caller passes fallbackFlat = false. */
  /** ObstacleCheck's DaggerfallActionDoor arm (EnemyMotor.cs:1167-1176):
   *  a door in the way is NOT an obstacle, it is a door - the foe walks
   *  at it and OpenDoors deals with it. The AI holds collider bucket
   *  KEYS and this host owns the registry that turns one into an action
   *  object, which is the same resolution the OpenDoors arm below
   *  already does with senses.LastKnownDoor.
   *
   *  AUDIT 63 F36: the question is `GetComponent<DaggerfallActionDoor>()`
   *  (EnemyMotor.cs:1159), not the door-verb ACTION family. This arm
   *  tested DOOR_VERB_FLAGS.has(o.actionFlag), which the ordinary
   *  dungeon door fails - RDBLayout.cs:247-259 gives every action-door
   *  model the component and only a door that ALSO has a record gets
   *  one - so a plain closed door stayed `obstacleDetected` and the foe
   *  detoured around it instead of walking at it. */
  const isActionDoor = (key) => {
    if (key == null) return false;
    return isActionDoorObject(actions?.objects.get(key));
  };
  /** EnemyEntity.cs:350-386 + SetEnemySpells (:453-461), the tail of
   *  SetEnemyCareer: a monster takes its per-career list, a CastsMagic
   *  class enemy takes EnemyClassSpells[min(6, level/3)], and either
   *  pins MaxMagicka = 10*level + 100 with the six magic skills at 80.
   *  DFU runs it on EVERY construction, so the port runs it on every
   *  build - the load loop, the rest interruption and the quest
   *  spawner alike. A caster foe then gets the EnemyCaster the frame
   *  loop's `f.caster` arm reads. */
  function assignFoeSpells(rec) {
    if (!foeSpellTable || !foeDeps || !rec?.entity) return;
    assignEnemySpells(rec.entity, foeSpellTable);
    if (rec.entity.spells?.length) rec.caster = new foeDeps.EnemyCaster(rec.entity);
  }
  /** MT-iv: THE RECORD IS THE CANDIDATE (exteriorFoes' law, one
   *  spelling). getTargets reads `ai` and `entity` off it and its
   *  identity IS the target handle. The two quest halves are LIVE
   *  GETTERS, never frozen booleans: bindQuestFoeHost runs after the
   *  record is stood, and ChangeFoeInfighting flips IsAttackableByAI
   *  mid-quest. Non-enumerable, so the save/snapshot walks that
   *  iterate a record are untouched. */
  function asCandidate(rec) {
    // A5 adds `concealment`: the closure the illusion gate has read
    // since MT-i and nothing ever built (exteriorFoes' law, one
    // spelling). BlockedByIllusionEffect (EnemySenses.cs:658-683)
    // reads the TARGET's IsInvisible/IsBlending/IsAShade whether that
    // target is the player or another enemy, and ConcealmentEffect
    // writes the flag entity-blind (:63).
    Object.defineProperties(rec, {
      isQuestFoe: { get: () => !!rec.questBehaviour, enumerable: false },
      questAttackable: { get: () => !!rec.questBehaviour?.isAttackableByAI, enumerable: false },
      concealment: { value: () => concealmentFlags(rec.entity), enumerable: false },
    });
    // the cross-pool damage door another enemy's blow lands through.
    // `fromPlayer: false` - a monster's blow is not the player's
    // (DaggerfallEntityBehaviour.cs:203).
    rec.hurtFromFoe = (dmg, dir, striker = null) => damageFoe(rec, dmg, null, dir ?? null, { fromPlayer: false, striker });   // AUDIT CC-E1: and whose blow
    // A5 - SetupDemoEnemy.cs:191-195: "Add special behaviour for Daedra
    // Seducer mobiles", gated on the mobile ID and nothing else. The
    // component is added at SETUP, so every seducer carries its
    // eight-second transform clock from the frame it stands.
    if (rec.mobile && rec.mobileType === MOBILE_DAEDRA_SEDUCER) {
      rec.seducer = new SeducerTransformBehaviour(rec.mobile, rec.entity);
    }
    return rec;
  }

  /** MT-iv: a DESTROYED foe (Destroy(gameObject) - the quest teardown,
   *  the dispel sweep, the restore cull) is marked dead with its
   *  health still ABOVE zero, so the target machine's dead-target cull
   *  (which reads health, as EnemySenses:315-318 does) can never drop
   *  it. Every other foe holding it would chase an object that no
   *  longer draws. DFU never has this problem: its database stops
   *  yielding a destroyed behaviour and its `target` reference goes
   *  null with the object. One sweep, called from every removal. */
  function dropCandidate(f) {
    for (const o of foes) {
      if (o === f || !o.ai) continue;
      if (o.ai.target === f) o.ai.target = null;
      if (o.ai.secondaryTarget === f) o.ai.secondaryTarget = null;
      if (o.ai.targetSenses === f) o.ai.targetSenses = null;
    }
  }

  /** ELITE DUNGEONS: a foe minted from an elite record stands with ELITE_HEALTH_SCALE times its
   *  rolled health and hits for ELITE_DAMAGE_SCALE times the damage (combat/formulas.js
   *  calculateAttackDamage reads `damageScale` at the tail, so every blow door - melee, bow,
   *  foe-on-foe - is covered). The record's `elite` rides `src`, so a respawn or a retype keeps it. */
  function eliteLootOpts(e) {
    return e?.elite ? { lootDropMult: ELITE_LOOT_DROP_MULT, lootQualityMult: ELITE_LOOT_QUALITY_MULT } : {};
  }
  /** MT-ii's law, at the build (AUDIT OH-F C4): SetupDemoEnemy.cs:85-86 overwrites the MobileEnemy STRUCT COPY
   *  before SetEnemy and EnemyEntity.cs:316 seeds Entity.Team from that copy - so BOTH per-instance fields turn and the
   *  shared frozen basics row does not. At the build, not after it: an ally is one when OnEnemySpawn hears it, and a
   *  rebuild (retypeFoe stands `{ ...f.src }`) stands an ally again. */
  function applySpawnAlliance(entity, e) {
    if (e?.allied && entity) { entity.team = 'PlayerAlly'; entity.mobileTeam = 'PlayerAlly'; }
  }
  /** SOFTCAP2: TOUGHER FOES, by where you are. The dungeon KIND gives the
   *  place's share (skillSoftcap.js DUNGEON_SHARE - 11% in a mine or a cave,
   *  100% in a vampire haunt or a Daedra's temple); the foe's own base level gives its share (a
   *  class foe counts in full); the player's standing - veteran (75..100) and
   *  edge (past 100), both 0 while mentoring - gives the size. skillSoftcap.js has the whole law and its numbers. */
  const _dungeonShare = dungeonShare(dfLocation.mapTableData?.dungeonType);
  function applyProgressionScalingTo(entity, basics) {
    if (!(_dungeonShare > 0)) return;
    const scaling = progressionScaling(combatStanding(foeDeps.playerEntity), _dungeonShare, foeShare(basics?.level ?? entity.level, entity.isClass));
    foeDeps.applyProgressionScaling?.(entity, scaling);   // lazily loaded beside makeEnemyEntity; the dungeon's own deps (the import used `D`, which only the spawn builders below bind)
  }
  function applyEliteScaling(entity, e) {
    if (e?.eliteFoe && entity && promoteEliteFoe(entity, { eliteDungeon: !!e.elite, checkLevel: false })) { if (e.elite) entity.elite = true; return; }   // ELITE-FLOOR: the pick's own (by the kind's level, every client alike)   // ELITE FOES: 5x health, 3x damage - 7x / 4x in an Elite Dungeon, in place of its doubling
    if (!e?.elite || !entity) return void applyChampion(entity, e?.champion);   // LOOT7: a plain dungeon's champion (its loot reads the mark, so before it)
    entity.maxHealth = Math.max(1, Math.round(entity.maxHealth * ELITE_HEALTH_SCALE));
    entity.health = entity.maxHealth;
    entity.damageScale = ELITE_DAMAGE_SCALE;
    entity.elite = true; applyChampion(entity, e.champion);   // LOOT7: an elite dungeon's champion - its scale on the elite's
  }
  async function buildFoeAt(e, fallbackFlat = true, { at = -1, puppet = false, feetGiven = false } = {}) {   // DISC28-H: `feetGiven` - the position is already a motor's FEET (a streamed puppet), not a marker's sprite centre
    const basics = ENEMY_BASICS[e.mobileType];
    if (!basics) return;
    if (at >= 0 && !canStandFoe(e.mobileType)) return;   // AUDIT WORLD3 E3: a rebuild has a live record standing there - the flat fallback has nothing to draw and its flatGroups push is dead after the build
    // WORLD3: a rebuild (retypeFoe) stands in the OLD record's place - the old batch freed, the old record dead to
    // everything still holding it (the target machine's cull, a stale frame), the new one posed by the next frame
    const stand = (rec) => {
      registerFoeDoor(rec.entity, (n) => damageFoe(rec, n, null, null, { fromPlayer: true, kind: 'spell' }));   // AUDIT PSCALE1 DOORS-2: a reflected blow is a blow through the one door (its death, its fighters, the host)
      const old = at >= 0 ? foes[at] : null;
      if (!old) {
        foes.push(rec);
        if (_layoutStood && !puppet) { if (rec.src) rec.src.loadID ??= ++_spawnUid; opts.onEnemySpawn?.(rec); }   // OH-E; AUDIT PRE-MERGE 0928 M1: a puppet (another player's foe stood here) is no spawn of mine - its runner's abyss had it
        return;
      }
      // AUDIT WORLD3 E4: the context died while this rebuild awaited its art (a stream frame can start one at any
      // moment, and destroy() has already walked the pool). Free what we minted rather than write a live VAO into an
      // array nothing will iterate again. `at >= 0` short-circuits the read, so the initial build - which runs long
      // before _ctxDead is declared - never touches it.
      if (_ctxDead) { if (rec.batch) { renderer.destroyBillboardBatch(rec.batch); rec.batch = null; } rec.dead = true; return; }
      if (old.batch) { renderer.destroyBillboardBatch(old.batch); old.batch = null; }
      old.dead = true;
      dropCandidate(old);
      // AUDIT 68 S19-retype-orphans-corpse: the replaced record takes its BODY with it - the flat and the body's loot
      // record - on every rebuild door, on success only. Only the hour's respawn cleaned up after itself; the stream's
      // un-death and both species-mismatch rebuilds left the old corpse drawn for ever and `corpse:<i>` spoken for.
      freeCorpse(old);
      _lootSeen.delete(`corpse:${at}`); _lootAt.delete(`corpse:${at}`);
      foes[at] = rec;
      takeRoomPlace(old, rec);   // AUDIT PRE-MERGE 0928 M1: the room's word on it goes with the place
    };
    // NT2 (F210): GetTextureArchive's gender arm, at the ONE entry every
    // spawn record passes - a human with unspecified gender rolls the
    // shared DFRandom stream (== 0 male). The dungeon LAYOUT path never
    // rolled at all before this, so every random human class enemy
    // stood male; a monster stays unspecified and reads the male texture.
    e.gender = MobileUnit.resolveGender(e.gender, basics);
    // C17 THE HUMANOID PIVOT: class enemies (128+) render as classic
    // sprite mobiles too - the voxel foe rig goes ON ICE with the
    // voxel FP weapon (Mac's classic-visuals direction). The entity
    // build below (career/equipment/poison/archer) is UNCHANGED.
    if (foeDeps && e.mobileType > 43 && basics.maleTexture) {
     try {
      const D = foeDeps;
      const pos = D.floorLanding(collider, [e.x, e.y + 0.2, e.z]);
      const yawDeg = ((e.mobileType * 73 + Math.round(e.x + e.z)) % 8) * 45;   // deterministic facing, no engine PRNG (Ledger A rule)
      const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const t = await getTexture(archive);
      const idleH = idleSpriteHeight(t);   // INCIDENT 2026-09-04: SetupDemoEnemy.cs:104 - the capsule reads the idle sprite
      // E3a: the real entity - career from CLASS{ID-128}.CFG, level =
      // player level, HP/skills/LiveSpeed verbatim (SetEnemyCareer)
      const careerIndex = e.mobileType - 128;
      const cf = new D.ClassFile();
      cf.load(await D.fetchBytes(`CLASS${String(careerIndex).padStart(2, '0')}.CFG`));
      const entity = D.makeEnemyEntity(e.mobileType, basics, cf.career, e.level ?? effectiveLevel(D.playerEntity));   // SOFTCAP1: a mentor's dungeon is built at the group's level; ARENA2: a bout fighter at its tier's
      applyEliteScaling(entity, e);   // ELITE: double health, double damage
      if (!puppet && e.level == null) applyProgressionScalingTo(entity, basics);   // SOFTCAP1: tougher high-tier foes against skills past 100 (a puppet is its owner's build); ARENA2: never a bout fighter (the ladder is a fixed mountain)
      applySpawnAlliance(entity, e);   // MT-ii / AUDIT OH-F C4
      // S1/E4b/AUDIT 18/AUDIT 24/LR1: SetEnemyCareer's whole loot chain -
      // the table on the PLAYER's level and gender, the equipment
      // appended and put on, the map/potion/recipe trio, the port's
      // rarity roll over the carried loot - ONE seam (RF2:
      // hostCombat.spawnEnemyLoot); the loot rides the entity and the
      // corpse carries it on death.
      spawnEnemyLoot(entity, e.mobileType, basics, D.playerEntity, { ...eliteLootOpts(e), where: 'dungeon' });   // ELITE: +20% drops, +20% quality; AUDIT OH-F B3: the dungeon's own
      if (e.eliteFoe) grantEliteLoot(entity, effectiveLevel(D.playerEntity));   // ELITE FOES: better loot
      const ai = new (getPref('enhancedAI') ? D.EnhancedEnemyAI : D.EnemyAI)(collider, pos, yawDeg * Math.PI / 180, {   // ENHANCED AI 4: the switch chooses the motor; the bake is read per step
        nav: () => enhancedNav.chf, navWorld: enhancedNav.world, navSeed: (yawDeg * 1000) | 0,
        // AUDIT 39: a THUNK, not a snapshot - TakeAction re-reads
        // Stats.LiveSpeed every FixedUpdate (EnemyMotor.cs:432).
        liveSpeed: () => liveStat(entity, 'speed'),
        // AUDIT 39: RDBLayout.AddEnemy :1519-1521 -> EnemyMotor.cs:122.
        // The marker's Passive action byte (99) was minted by
        // collectDungeonEnemies and dropped here, so a castle guard
        // charged on sight instead of standing down until struck.
        isHostile: e.reaction !== 'passive',
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,   // P13: the illusion-gate exemption
        height: enemyControllerHeight(idleH, basics.behaviour ?? 'General'),   // INCIDENT 2026-09-04: SetupDemoEnemy.cs:103-115, not the player's capsule
        centreOffset: idleH / 2,   // REVIEW 2026-09-05: transform.position = the sprite centre, whatever the capsule became
        spawnDistanceType: e.spawnDistanceType ?? 0,   // AUDIT 23 (characters-7): EnemySenses.cs:231 - the marker's band row
        isActionDoor,   // wave 34: ObstacleCheck's DaggerfallActionDoor arm
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight does NOT pursue (EnemyMotor.cs:468-470,
        // :610 `return true`), it stands off and turns to face.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => rec?.caster?.canCastRangedSpell() ?? false,   // D9: SelectedSpell, from the caster that owns the pick
        hasMagickaToCast: () => foeDeps.hasMagickaToCast(entity), vitals: () => entity,   // GetDestination's own term (:539-540) - CurrentMagicka > 0, not the band gate; TACT2: the brain reads its health
      });
      const attack = new D.EnemyAttack({ liveSpeed: () => liveStat(entity, 'speed'), playerLevel: () => effectiveLevel(D.playerEntity), reflexes: D.playerEntity.reflexes });   // AUDIT 39: EnemyAttack.cs:69-72 re-reads LiveSpeed per FixedUpdate
      // Combat bows: EnemyMotor.cs:131-137 reads the MobileEnemy
      // FLAGS, with zero inventory involvement (AUDIT 18 - minting
      // this from an equipped bow meant no enemy could ever fire one,
      // because AssignEnemyStartingEquipment never rolls a bow).
      attack.rangedAttack = hasBowAttack(basics);
      const mobile = new MobileUnit(e.mobileType, basics, (rec) => t.getFrameCount(rec), Math.random, e.gender);
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const rec = asCandidate({ mobile, mobileArchive: archive, mobileTex: t, batch, ai, attack, entity, mobileType: e.mobileType, gender: e.gender, idleH, marker: [e.x, e.y, e.z], src: e });   // REVIEW 2026-09-05: the layout marker, for a pre-fix save's ghost
      assignFoeSpells(rec);   // SetEnemyCareer's tail, on every spawn
      stand(rec);
      return rec;   // B1: the quest spawner binds its behaviour to the stood record
     } catch (err) {
       // One foe failing to build (a missing CLASS*.CFG, a rig or
       // equipment error on a specific mobile type) MUST NOT abort
       // buildDungeonContext and black-screen the whole dungeon -
       // the class-foe block was unguarded on the critical build
       // path, and with ?foes a single bad enemy took the level
       // down with no signal. Skip the foe, keep the dungeon.
       console.error(`[foe] mobileType ${e.mobileType} failed to build; skipping this enemy:`, err?.message ?? err);
     }
      return;
    }
    // C11 THE MONSTER PIVOT: monster types (0-42) become REAL foes -
    // the same EnemyAI/senses/stealth, EnemyAttack cadence, entity
    // (ENEMY{nnn}.CFG career + basics HP/level/armor, E4a), loot,
    // S16 fixed spell lists, S18 OnMonsterHit riders, and corpses -
    // rendered as classic ANIMATED sprite mobiles (MobileUnit: the
    // DFU orientation/anim laws over the real TEXTURE archive).
    if (foeDeps && e.mobileType <= 42 && basics.maleTexture) {
     try {
      const D = foeDeps;
      const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
      const t = await getTexture(archive);
      // INCIDENT 2026-09-04 (Mac: "bat enemies stuck in the ceiling").
      // RDBLayout.cs:1537 stands the enemy TRANSFORM on the marker and
      // :1546-1548 ground-aligns everything but a FLYING unit - a
      // Spectral grounds too (C12 read CanFly = Flying|Spectral here,
      // which is the motor's law, not the layout's). The transform is
      // the sprite's CENTRE (DaggerfallMobileUnit.cs:409, localPosition
      // zero for a flyer), and the port's motor keeps FEET: a bat's
      // feet sit half its idle sprite under the marker, else its head
      // is in the ceiling. Walkers and swimmers ground (a fish lands
      // on its pool bed and swims up on pursuit).
      const behaviour = basics.behaviour ?? 'General';
      const idleH = idleSpriteHeight(t);
      // DISC28-H: a flyer hangs on its marker, never with its feet under the floor below it; a streamed puppet's position
      // is the owner's feet already, and re-hanging it built the flyer half a sprite low. AUDIT DISC28 MO-4: both through
      // the anchor's one door (enemyAnchor.js flyerStandFeet), whose floor read is pinned on the real collider
      const pos = behaviour === 'Flying' ? flyerStandFeet(collider, [e.x, e.y, e.z], idleH, feetGiven) : D.floorLanding(collider, [e.x, e.y + 0.2, e.z]);
      const yawDeg = ((e.mobileType * 73 + Math.round(e.x + e.z)) % 8) * 45;   // deterministic facing (Ledger A rule)
      const career = await D.loadMonsterCareer(e.mobileType, D.fetchBytes);
      const entity = D.makeEnemyEntity(e.mobileType, basics, career, e.level ?? effectiveLevel(D.playerEntity));   // SOFTCAP1: a mentor's dungeon is built at the group's level; ARENA2: a bout fighter at its tier's
      applyEliteScaling(entity, e);   // ELITE: double health, double damage
      if (!puppet && e.level == null) applyProgressionScalingTo(entity, basics);   // SOFTCAP1: tougher high-tier foes against skills past 100 (a puppet is its owner's build); ARENA2: never a bout fighter
      applySpawnAlliance(entity, e);   // MT-ii / AUDIT OH-F C4
      spawnEnemyLoot(entity, e.mobileType, basics, D.playerEntity, { ...eliteLootOpts(e), where: 'dungeon' });   // ELITE: +20% drops, +20% quality. RF2: SetEnemyCareer's whole loot chain, one seam (the table, the kit, the trio, the port's roll)
      if (e.eliteFoe) grantEliteLoot(entity, effectiveLevel(D.playerEntity));   // ELITE FOES: the champion's own drop
      // C12: the behaviour motors - flying/spectral pursue in 3D at
      // the face with no gravity, aquatic ride WaterMove against the
      // block water surface (beached = frozen, verbatim).
      const ai = new (getPref('enhancedAI') ? D.EnhancedEnemyAI : D.EnemyAI)(collider, pos, yawDeg * Math.PI / 180, {   // ENHANCED AI 4: the switch chooses the motor; the bake is read per step
        nav: () => enhancedNav.chf, navWorld: enhancedNav.world, navSeed: (yawDeg * 1000) | 0,
        liveSpeed: () => liveStat(entity, 'speed'),   // AUDIT 39: EnemyMotor.cs:432 re-reads it per FixedUpdate
        isHostile: e.reaction !== 'passive',          // AUDIT 39: RDBLayout.AddEnemy :1519-1521 -> EnemyMotor.cs:122
        seesThroughInvisibility: basics.seesThroughInvisibility ?? false,
        behaviour, mobileId: e.mobileType, waterSurfaceY: waterSurfaceYAt,
        height: enemyControllerHeight(idleH, behaviour),   // INCIDENT 2026-09-04: SetupDemoEnemy.cs:103-115 - sprite height, halved for a flyer, never under 1.6
        centreOffset: idleH / 2,   // REVIEW 2026-09-05: transform.position = the sprite centre, whatever the capsule became
        spawnDistanceType: e.spawnDistanceType ?? 0,   // AUDIT 23 (characters-7)
        isActionDoor,   // wave 34: ObstacleCheck's DaggerfallActionDoor arm
        // wave 35: DoRangedAttack's band - a shooter inside 6..51.2 with
        // the target in sight does NOT pursue (EnemyMotor.cs:468-470,
        // :610 `return true`), it stands off and turns to face.
        hasBowAttack: hasBowAttack(basics),
        canCastRangedSpell: () => rec?.caster?.canCastRangedSpell() ?? false,   // D9: SelectedSpell, from the caster that owns the pick
        hasMagickaToCast: () => foeDeps.hasMagickaToCast(entity), vitals: () => entity,   // GetDestination's own term (:539-540) - CurrentMagicka > 0, not the band gate; TACT2: the brain reads its health
      });
      const attack = new D.EnemyAttack({ liveSpeed: () => liveStat(entity, 'speed'), playerLevel: () => effectiveLevel(D.playerEntity), reflexes: D.playerEntity.reflexes });   // AUDIT 39: EnemyAttack.cs:69-72 re-reads LiveSpeed per FixedUpdate
      // The same EnemyMotor.cs:131-137 flag test the class branch
      // runs - false for all 43 monsters today, but it must not stay
      // undefined (the archer draw/loose path reads it every frame).
      attack.rangedAttack = hasBowAttack(basics);
      const mobile = new MobileUnit(e.mobileType, basics, (rec) => t.getFrameCount(rec), Math.random, e.gender);
      // One live billboard batch per foe: record/size/origin mutate
      // per frame (the batch geometry is a unit quad; size is a
      // uniform, origin a live translation - zero rebuilds).
      const batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
      const rec = asCandidate({ mobile, mobileArchive: archive, mobileTex: t, batch, ai, attack, entity, mobileType: e.mobileType, gender: e.gender, idleH, marker: [e.x, e.y, e.z], src: e });   // REVIEW 2026-09-05: the layout marker, for a pre-fix save's ghost
      assignFoeSpells(rec);   // SetEnemyCareer's tail, on every spawn
      stand(rec);
      return rec;   // B1: the quest spawner binds its behaviour to the stood record
     } catch (err) {
       // Same guard as the class branch: one bad monster must not
       // take the dungeon down - fall back to the static flat.
       console.error(`[foe] monster ${e.mobileType} failed to build; static flat fallback:`, err?.message ?? err);
       if (fallbackFlat) {
         const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
         const key = `${archive}_0`;
         if (!flatGroups.has(key)) flatGroups.set(key, []);
         flatGroups.get(key).push(Object.assign([e.x, e.y, e.z], { noCover: true }));   // AUDIT TACT B3: a foe's stand-in is no cover
       }
     }
      return;
    }
    if (!fallbackFlat) return;
    const archive = e.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
    const key = `${archive}_0`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push(Object.assign([e.x, e.y, e.z], { noCover: true }));   // AUDIT TACT B3: a foe's stand-in is no cover
  }
  for (const e of enemies) await buildFoeAt(e);
  // ONLINE-DUNGEON-FOES (2026-09-20, Mac: "Issues with non-reactive enemies in dungeons in the
  // online mode" and "The lysander ghost enemy isn't synced online between players"). BOTH
  // REPORTS ARE THIS ONE LINE, and it was flagged rather than fixed because the fix is a slice,
  // not an edit. `_layoutFoes` is the layout's run, and every foe appended past it - a quest
  // foe (spawnQuestFoe), an encounter (IntermittentEnemySpawn), a summon - is a PRIVATE object
  // in a shared dungeon, two ways at once:
  //   NOT SYNCED. `foesFrame` loops `i < _layoutFoes`, so a foe past the run is in no frame any
  //   peer ever receives. The Lysandus ghost is quest-placed, so it exists only on the client
  //   whose quest placed it - nobody else has it to see.
  //   NOT REACTIVE. The target machine's `candidates(streamed)` admits peers only under
  //   `_authority && streamed`, and `streamed` IS `_fi < _layoutFoes`, so a foe past the run
  //   never sees another player as a target at all - it ignores everyone but the client it
  //   belongs to.
  // The two halves must be paid TOGETHER: arming a foe against peers while it is still unsynced
  // is worse than the bug, because it would chase and swing at a player who cannot see it and
  // has no damage frame to resolve the blow with. The shape of the answer already exists and is
  // proven - WORLD6b's owner law in scenes/exteriorFoes.js, where a cell's foe is ITS SPAWNER'S:
  // the spawner steps and streams it, everyone else puppets it by (owner, seq), and a blow on
  // another's foe goes to its owner as a hit. The dungeon needs that law for its non-layout run,
  // which is a new frame shape, puppet build/teardown, hit routing and a stale sweep.
  // REST-SYNC (below) paid it for a rest's encounter - the HOST's, not its spawner's; QUEST-PARTY phase 3c paid it for
  // a quest the party SHARES - its spawner's, on the room's own lane (OWN1), to the party alone (the own lane, below);
  // SUMMON-SYNC (2026-09-27, Mac: "Finish the 2 gaps") paid the last, a summon's foe - a loose stand, its spawner's, on
  // the same lane, to the whole room. RETIRED there: every foe past the run the room should see, it sees, and hunts it.
  // A PRIVATE quest's foe stays its player's own - the party's law, Mac's ("Party shares them"), not a hole.
  const _layoutFoes = foes.length;   // AUDIT WORLD B2: the layout's run - every foe past it (an encounter's, a summon's, a quest's) is this player's own
  // ARENA-FIX 4: a chained beast - the bout team's tag nobody else carries, always held (it targets nobody and nobody
  // it), held at the yield floor if struck, no loot; the keepers' warning when it is
  for (const f of foes) {
    if (f.src?.arenaChained == null || !f.entity) continue;
    f.entity.bout = chainTag(f.src.arenaChained, () => hudText.add(ARENA_TEXT.undercroft.chained));
    f.entity.items = [];
  }
  _layoutStood = true;   // OH-E: every foe stood from here on is a spawn (GameManager.OnEnemySpawn's, with its own LoadID)
  // REST-SYNC (2026-09-26, Mac: "when resting in a dungeon it spawns enemys that are out of sync with others"; asked,
  // "Sync them into the room"): A REST'S ENCOUNTER IS THE ROOM'S - the rest half of the flag above (a summon's and a
  // quest's foes stay their player's own). The room already has one simulation, the host's (WORLD2), so the encounter
  // is the HOST's: the host stands it as a SHARED foe, numbered by the room (`_encId` - the host's count, carried on
  // by whoever takes the seat after it), streamed on the layout's own frame (`x`, the full frame's list whole `xf`), and
  // hunting every player as the layout's foes do; every joiner stands it as a puppet from its first record, strikes it
  // through the host as it strikes the layout's (the hit names it `xs`), and takes it down when a full frame no longer
  // lists it. A joiner's own rest ASKS the host to stand the encounter by the joiner's feet (an act frame, `rs`), and
  // its rest breaks at the hour's check as DFU's does. Offline nothing changes.
  let _sharedSeq = 0;
  const _sharedById = new Map();   // REST-SYNC: id -> foe - the host's live encounters, and each joiner's puppets of them
  const _sharedPending = new Map();   // REST-SYNC: id -> the newest record while its puppet builds
  /** REST-SYNC: a foe the room shares - the layout's run, or a shared encounter. */
  const isRoomFoe = (f, i = foes.indexOf(f)) => (i >= 0 && i < _layoutFoes) || (f != null && f._encId != null);
  /** AUDIT PRE-MERGE 0928 M1: A REBUILT BODY KEEPS ITS PLACE IN THE ROOM. retypeFoe stands the new body in the old
   *  record's slot of the pool, and the layout's run is known by that slot alone - but a shared encounter is known by its
   *  number (`_encId`, and the room's map to it) and my loose stand by its mark and its lane's number, and they stayed on
   *  the dead record. The abyss's replacement (ApplyEnemySettings on the same enemy) rebuilds foes past the run, so a
   *  replaced rest encounter or summon left the room: a foe this player alone could see. */
  function takeRoomPlace(old, rec) {
    if (old._encId != null) { rec._encId = old._encId; _sharedById.set(rec._encId, rec); }
    if (old._loose) rec._loose = true;
    if (old._ownSeq != null) rec._ownSeq = old._ownSeq;
  }
  /** AUDIT PRE-MERGE 0928 O6: a foe another client steps here - the room's while another holds the seat, a party
   *  member's own on the own lane: the frame's puppet test, and the one the host asks before it moves a foe itself. */
  const isPuppetFoe = (f, i = foes.indexOf(f)) => f != null && ((!_authority && isRoomFoe(f, i)) || f._ownFrom != null);
  /** REST-SYNC: this dungeon is in a room - an online page's (world.js hands it this player's id; offline, and on the
   *  standalone page, there is none). The blow and act doors are handed to every page, so they cannot say it. */
  const onlineRoom = () => opts.selfId?.() != null;

  /** B1: one QUEST foe through the SAME build chain as the load loop
   *  and the rest-encounter spawner, at the placement point CreateFoe's
   *  raycast picked. Binds the QuestResourceBehaviour host at the
   *  stand (the activation moment); faces the player (LookAt,
   *  CreateFoe.cs:328) via yawRad. */
  /** SD1: the BEHAVIOUR-FREE half of spawnQuestFoe. A released soul
   *  (SoulBound's break) and the Sanguine Rose's Daedroth are not
   *  quest resources - they have no behaviour to bind - and until this
   *  existed the enchant ctx's only spawner was the exterior one, so
   *  firing either underground stood a foe in the STREAMING world the
   *  player was not in: alive, ticking and invisible. EC1 made those
   *  arms refuse rather than misroute; this is the door they refused
   *  for want of.
   *
   *  `allied` is MT-ii's law, and the same two lines exteriorFoes
   *  carries: SetupDemoEnemy.cs:85-86 overwrites the MobileEnemy
   *  STRUCT COPY before SetEnemy and EnemyEntity.cs:316 seeds
   *  Entity.Team from that copy, so BOTH per-instance fields turn and
   *  the shared frozen basics row does not - getting that wrong would
   *  ally every foe of the type. */
  async function spawnLooseFoe(mobileType, position, { gender = null, yawRad = null, allied = false, questSpawn = false, loadID = null, level = null, bout = null } = {}) {
    // AUDIT OH-F C3/C4: the alliance and the quest mark ride the build's record - DFU sets both before OnEnemySpawn
    // is raised (GameObjectHelper.cs:1286-1294's QuestSpawn, SetupDemoEnemy.cs:85-86's team), and a rebuild keeps them
    // ARENA2: a bout fighter (scenes/arenaBouts.js) at its tier's `level`, carrying its `bout` from its first frame -
    // no loot (nobody dies on the sand to drop it), and never the room's (the instance is one player's)
    const e = { mobileType, gender, x: position[0], y: position[1], z: position[2], spawnDistanceType: 0, ...(allied ? { allied: true } : {}), ...(questSpawn ? { questSpawn: true } : {}), ...(loadID != null ? { loadID } : {}), ...(Number.isFinite(level) ? { level } : {}) };
    const f = await buildFoeAt(e, false);
    if (!f) return null;
    if (yawRad != null && f.ai) f.ai.yaw = yawRad;
    if (bout) { f.entity.bout = bout; f.entity.items = []; f._bout = true; return f; }
    f._loose = true;   // SUMMON-SYNC: a loose stand - it rides the room's own lane to everyone in the room (ownLoose)
    return f;
  }
  async function spawnQuestFoe({ mobileType, gender, position, yawRad = null, behaviour, marker = false }) {
    const f = await spawnLooseFoe(mobileType, position, { gender, yawRad, questSpawn: true });
    if (!f) { console.error(`[quest] foe ${mobileType} failed to stand in dungeon`); return null; }
    f._loose = false;   // SUMMON-SYNC: a quest's foe rides by its quest's law (ownQuestTag), never as a loose stand
    if (marker) f._questMarker = true;   // QUEST-PARTY phase 3c: a quest marker's foe - every copy of the quest stands it here
    bindQuestFoeHost(f, behaviour, questPoolOps);
    return f;
  }
  /** B1: the quest behaviour's pool surface (the questFoeHost
   *  contract) - the dungeon twin of exteriorFoes' questPoolOps. */
  /** REVENANT-DUNGEON: a fleeing foe out of reach - retired through the quest pool's own door (no corpse, no kill; a
   *  layout foe due back as any it retires), made a revenant (or a stronger one), and said. */
  function escapeDungeonFoe(f, { slip = false } = {}) {
    questPoolOps.removeFoe(f);
    f.fleeing = false;
    f.escaped = true;
    f.yielded = null;
    if (f.ai?.detected) setEnemyAlert(playerEntity, false);
    const r = revenantDeed(playerEntity, f.entity, 'fled', { mobileType: f.mobileType, gender: f.gender, rec: f, archive: f.mobileArchive });
    if (r) revenantSay(slip ? slipEvent(playerEntity, r, { archive: f.mobileArchive }) : revenantEscapeEvent(r, playerEntity?.name, { archive: f.mobileArchive }), (l) => hudText.add(l));   // REVENANT-FATE: a slip says the hesitation
  }
  // ── REVENANT-FATE underground: the open world's law (scenes/exteriorFoes.js), for a foe of the player's alone ─────
  const portals = createPortalSet({ renderer, audio });   // COMPANION-PORTAL: this place's own, drawn with its foes
  const fateSay = (ev) => { if (ev) revenantSay(ev, (l) => hudText.add(l)); };
  /** It yields: held at 1, kneeling, its plea said. */
  function yieldDungeonFoe(f) {
    if ((!foeDeps || !f.ai?._armedTargeting || foeDeps.isLocalPlayerTarget(f.ai?.target)) && f.ai?.detected) setEnemyAlert(playerEntity, false);
    const ev = beginYield(playerEntity, f, { now: Date.now() });
    // AUDIT (2026-10-02): a FLYER beaten kneels on the floor below, never in the air out of the player's reach
    if (f.ai?.flies) { const g = floorLanding(collider, [f.ai.feet[0], f.ai.feet[1] + 0.1, f.ai.feet[2]]); if (g && g[1] < f.ai.feet[1]) f.ai.feet[1] = g[1]; }
    audio.play3d(SOUND.BodyFall, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 0.8, { maxDistance: 16 });
    fateSay(ev);
  }
  /** The choice's model for a kneeling one (the host's window), or null. */
  function fateFor(f) {
    if (!f || f.dead || !f.yielded || !foes.includes(f)) return null;
    return fateModel(playerEntity, f, { choose: (id) => chooseFate(f, id) });
  }
  function chooseFate(f, id) {
    if (!f?.yielded || f.dead) return false;
    const at = [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]];
    if (id === 'kill') {
      renownFoeStruck(f);   // AUDIT (2026-10-02): the execution is my blow - a kneel past RENOWN_ASSIST_MS paid nothing
      const ev = beginExecution(playerEntity, f, { now: Date.now() });
      audio.play3d(SOUND.SwingLowPitch, at, 1, { maxDistance: 16 });
      opts.shakeCamera?.(1.4);
      fateSay(ev);
      return true;
    }
    if (id === 'spare') {
      const sp = beginSpare(playerEntity, f, { now: Date.now() });
      if (!sp) return false;
      portals.open(at);
      fateSay(sp.event);
      return true;
    }
    return false;
  }
  /** One frame of a judged or kneeling foe (its pose held, its beats played) - 'gone' when it left the place. */
  /** AUDIT (2026-10-02): the portal's hand-offs, run AFTER the foe loop - a lift takes its record out of `foes`, and a
   *  splice under the loop's own iteration skipped the next foe for that frame (no step, no draw: a flicker). */
  const _leftDone = [];
  function runLeftDone() {
    for (let i = 0; i < _leftDone.length; i += 2) { const f = _leftDone[i]; try { _leftDone[i + 1](); } catch { questPoolOps.removeFoe(f); } }
    _leftDone.length = 0;
  }
  function dungeonFateFrame(f, dt, playerFeet, eye) {
    const now = Date.now();
    if (f.leaving) {
      f._mout = f.mobile?.heldPose ? f.mobile.heldPose('idle', 0, f.ai.yaw, f.ai.feet, eye ?? f.ai.feet) : f._mout;
      if (now - f.leaving.at >= 900) { _leftDone.push(f, f.leaving.done); f.leaving = null; }   // handed off after the foe loop (runLeftDone)
    } else if (f.executing) {
      const st = executionStep(f, now);
      f._mout = kneelPose(f, eye, now);
      if (st === 'burst') {
        const mark = ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0;
        hitEffects.showBloodSplash(mark, f.ai._centre?.() ?? f.ai.feet, null, { ...bloodHit((f.entity?.maxHealth || 100) * 4, f.entity, { fromPlayer: true, weapon: { templateIndex: 126 } }), markIndex: mark });   // the heaviest blow there is: the gibs thrown
        audio.play3d(SOUND.Hit2, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 20 });
        audio.play3d(SOUND.Burning, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 0.7, { maxDistance: 20 });
        opts.shakeCamera?.(3);
        f._hfAt = performance.now() / 1000;   // the red flash, on foeHitFlash's own clock (the frame's write reads it)
      } else if (st === 'done') {
        const feet = floorLanding(collider, [f.ai.feet[0], f.ai.feet[1] + 0.1, f.ai.feet[2]]);   // AUDIT (2026-10-02): its pile on the floor, never in the air
        // AUDIT (2026-10-02): ITS SOUL - the kill door's X5 trap and V3 Star, which the yield ran ahead of (the open world's law)
        const trap = attemptSoulTrap(f.entity, f.mobileType, playerEntity.items, Math.random());
        if (trap.alert && trap.alert !== 'trapNoneEmpty' && SOUL_TRAP_TEXT[trap.alert]) hudText.add(SOUL_TRAP_TEXT[trap.alert]);
        if (f.mobileType < 128 && isAzurasStarEquipped(playerEntity) && fillEmptyTrap(playerEntity.items, f.mobileType, { azurasStarOnly: true })) hudText.add(SOUL_TRAP_TEXT.trapSuccess);
        reportPlayerKill(f.entity, { kind: 'melee' });
        renownFoeDied(f);
        raiseEnemyDeath(f.entity, { luck: liveStat(playerEntity, 'luck') });
        const items = finishExecution(playerEntity, f);
        f.executing = null;
        questPoolOps.removeFoe(f);   // gone with no body
        f.executed = true;
        if (items.length) { droppedLoot.dropPile(items, feet); playRareDrop(audio, feet, items); }
      }
    } else if (f.sparing) {
      f._mout = f.mobile?.heldPose ? f.mobile.heldPose('idle', 0, f.ai.yaw, f.ai.feet, eye ?? f.ai.feet) : f._mout;
      if (spareDone(f, now)) { questPoolOps.removeFoe(f); f._swornAway = true; }
    } else if (yieldStep(f, playerFeet, dt * 1000) === 'slip') escapeDungeonFoe(f, { slip: true });
    else f._mout = kneelPose(f, eye, now);
    return f.dead ? 'gone' : 'held';
  }
  /** COMPANION-PORTAL: the place's portal work for the companion layer (crewAshore.js `place.fx`). */
  const companionFx = {
    arrive(rec) { if (!rec?.ai) return; portals.open(rec.ai.feet); rec.portalFx = { dir: 'in', at: Date.now(), delay: 220, ms: 640 }; },
    leave(rec, done) {
      if (!rec?.ai || rec.dead) { done(); return; }
      portals.open(rec.ai.feet);
      rec.portalFx = { dir: 'out', at: Date.now(), delay: 180, ms: 600 };
      rec.leaving = { at: Date.now(), done };
    },
    jump(rec, from) {
      if (!rec?.ai) return;
      portals.open(from, { short: true });
      portals.open(rec.ai.feet, { short: true, quiet: true });
      rec.portalFx = { dir: 'in', at: Date.now(), delay: 140, ms: 480 };
    },
  };
  const questPoolOps = {
    removeFoe: (f) => {
      if (f.dead) return;
      // AUDIT (the pre-merge audit, D1): A PUPPET IS ITS RUNNER'S - a party member's own foe, a room's foe while another
      // holds the seat. Dispel handed this door every live foe near the caster: the puppet went dead with no batch, its
      // runner's next record stood it up again with none, and the draw's `f.batch.conceal` threw and stopped the loop.
      // Nothing of mine removes it, as the Wabbajack's replace (SUMMON-SYNC) and the cell's door (exteriorFoes) never did
      if (f._ownFrom != null || (!_authority && isRoomFoe(f))) return;
      f.dead = true;
      f._diedAt ??= _wallNow();   // AUDIT WORLD7/8 B6: a layout foe this door retires (Wabbajack's replace) is due back like any other
      if (f.batch) { renderer.destroyBillboardBatch(f.batch); f.batch = null; }
      f.questBehaviour?.notifyDestroyed();
      dropCandidate(f);
    },
    // AUDIT 58: this is the SetHealth(0) door, not a damage source -
    // like hurtPlayer's bypassShield it must not be mitigated, or a
    // quest that removes a foe would be eaten by its own Shield.
    zeroFoeHealth: (f) => { if (!f.dead) damageFoe(f, f.entity.health, null, null, { fromPlayer: false, bypassShield: true }); },   // AUDIT RENOWN1 GAME-6: SetHealth(0) is nobody's blow - it paid Renown as mine, and woke the area as my attack
    spellsByIndex: () => spellsByIndex,
    foeSinks: (f) => foeSinks(f),
    rolls: Math.random,
  };

  // S3: the REAL player entity - chargen rolls from a CLASS*.CFG
  // career before anything consumes the player. Career = ?class= (an
  // index into the 18 careers, through applyHeadlessChargen) or the
  // real 18-career wizard from createChargenFlow; the Warrior-16
  // default this sentence used to name is GONE, as the boot that
  // mounts them says at its own site below.
  // S4b: trap spells - SPELLS.STD by index; CastSpell actions queue
  // missiles that fly at the player (speed 25, radius 0.45, life 8s,
  // element billboards 375-379). Resolution: the WHOLE library, since
  // M3 moved this host's missiles onto the shared cast engine - a
  // landed trap bolt goes through magic.explodeAt /
  // magic.applySpellToPlayer to applySpell, so a paralysis or drain
  // trap lands exactly as its SPELLS.STD record says. (EF1c: this read
  // "the classic damage-health family... other effects FLAGGED to the
  // effect-library slice" long after both halves stopped being true.
  // IN1: that quote used to be deliberately lower-cased, because
  // tools/regenOpenFlags.mjs harvested the token off any line and put
  // a QUOTED flag back on the board as open work. The tool strips
  // quoted spans now - EF1c's own unquote rule, moved from the pins
  // into the ledger - so a correction may say what it retired in the
  // retired words, and this one does.)
  const _pendingCasts = [];
  const missiles = [];
  // G4: BOTH magic registries, through the one shared loader. This
  // used to be two try blocks HERE, which is why the exterior host
  // never had them - see scenes/shared.js for the rule and the
  // duplicate-index law it still carries.
  const { spellsByIndex } = await loadMagicRegistries(fetchBytes);
  // U6: the TEXT.RSC database goes LIVE for the action text boxes
  // (the reader shipped with the U-series; the hudText note's
  // "database FLAGGED" narrows to the skill/loot message ids).
  let textRsc = null;
  try {
    textRsc = new TextRsc().load(await fetchBytes('TEXT.RSC'));
  } catch { console.warn('[text] TEXT.RSC unavailable; action text boxes no-op'); }
  // AUDIT 17g F1: the parchment frame warms HERE, beside the records
  // it frames. U11 wired it inside toggleCharSheet() - the comment
  // even said "for the action boxes" - so a dungeon trigger that
  // popped a ShowText box drew the FLAT fallback unless the player had
  // pressed F5 at some point first. Nothing failed loudly; the box
  // just quietly wasn't classic.
  preloadMessageBoxArt({ renderer, fetchBytes, palette });
  // I3: the Escape window's panel, same failure posture (a missing
  // OPTN00I0 costs the pause menu, loudly, never the boot).
  preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));
  // PX19c: the pack's PAPER DOLL warms here too, beside the arts it
  // rides with - the world host preloaded it and this one never did,
  // so a new game's first dungeon opened a pack with the schematic
  // where the avatar belongs (the 17g F1 shape exactly, one art
  // over). Same failure posture: loud, never the boot. The 'dungeon'
  // context is CONTEXT_BG's SCBG07I0, classic's backdrop underground.
  // AUDIT 68 S19-double-paperdoll-preload: the ONE warm - U26 added a
  // second in the same tick, which loaded and decoded the doll twice.
  preloadPaperDollForEntity({ renderer, fetchBytes, palette, getTexture }, playerEntity, 'dungeon')
    .catch((e) => console.warn('[pack] paper doll art unavailable:', e?.message ?? e));
  // S16: enemy spell lists ride SPELLS.STD (loaded just above, after
  // the foe build) - SetEnemyCareer's assignment tail per live foe:
  // class enemies with CastsMagic take EnemyClassSpells[min(6,
  // level/3)] (monsters' fixed lists ship in the same table and go
  // live when monsters leave their billboards). A caster foe gets an
  // EnemyCaster driving the classic decide-and-release shape.
  //
  // Publishing the table is what makes assignFoeSpells live: the
  // marker foes above were built before SPELLS.STD landed and are
  // caught up here, and every LATER build - _spawnEncounter's rest
  // interruption, spawnQuestFoe's CreateFoe - assigns inside
  // buildFoeAt, as DFU assigns inside SetEnemyCareer. This loop was
  // the only assignment site, so a runtime-spawned Imp, Orc Shaman,
  // Vampire or Lich had no spells and no caster at all.
  foeSpellTable = spellsByIndex ?? null;
  for (const f of foes) assignFoeSpells(f);

  let chargenFlow = null;
  // scenes/chargenSession.js FS-slice (wave D): the WINDOW that
  // wraps the flow. `chargenFlow` stays the flow itself - the AUDIT
  // 17i probe surface answers it and finishChargenHere reads its
  // result - and this is what occupies the overlay slot.
  let chargenWindow = null;
  let activeOverlay = null;
  /** ROAD-B B1: the DEPTH under this context's one slot, exactly as
   *  worldModes' interior half took it. `activeOverlay` stays the live
   *  slot every read in this file already uses; the stack
   *  (UserInterfaceManager.cs, ported in ui/windowStack.js) carries
   *  what is suspended beneath it and writes the slot back through
   *  `onTop`. showOverlay pushes; tickOverlay reconciles, so the ~15
   *  hand-written `activeOverlay = null` close paths read as
   *  PopWindow and uncover the window they were laid over. */
  const dungeonWindows = makeWindowStack({ onTop: (w) => { activeOverlay = w; } });
  /** THE PAUSE - ONE ANSWER, ASKED OF THE STACK (worldModes'
   *  `interiorPaused` carries the full note; this is the same law for
   *  this context's stack). AddWindow (UserInterfaceManager.cs:179-186)
   *  raises `GameManager.PauseGame(true)` for a PauseWhileOpen window,
   *  RemoveWindow (:190-216) lowers it only when the stack drains, and
   *  PauseGame (GameManager.cs:600-635) is the `Time.timeScale = 0`
   *  every gate in the dungeon frame reads. `paused()` is that latch.
   *  The `pauseWhileOpen(activeOverlay)` term is the PORT SEAM: the ~15
   *  hand-written slot writes in this file are not PushWindow, so
   *  between such a write and the next `reconcile` the live slot is the
   *  only witness - and it is asked through the module's own law
   *  (UserInterfaceWindow.cs:141), not by truthiness. */
  const dungeonPaused = () => dungeonWindows.paused() || pauseWhileOpen(activeOverlay);
  /** ROAD-B B5 - THE PUSH DOOR, one home. B1 landed it as
   *  `ctx.showOverlay` and recorded that a scatter of older
   *  `if (!activeOverlay) activeOverlay = ...` REFUSALS was left
   *  behind: each of those is a place DFU calls DaggerfallUI.MessageBox
   *  (which is `new DaggerfallMessageBox(...); mb.Show()` ->
   *  uiManager.PushWindow) and the port dropped the message on the
   *  floor instead. The door is here rather than only on the returned
   *  ctx because the sites that owe it are built above that object. */
  // NT1 (F213): the context's own dead latch - destroy() sets it so the
  // async continuations (a corpse whose texture is still warming) stop
  // publishing GPU batches onto a torn-down scene. Declared HERE, above
  // its first reader (AUDIT ENH-NOTICE3, re-audit C3): pushDungeonWindow
  // below reads it, and a `let` is in its temporal dead zone until its
  // line runs - a call from inside the build would have thrown rather
  // than refused.
  let _ctxDead = false;
  function pushDungeonWindow(win) {
    if (!win) return false;
    // AUDIT ENH-NOTICE3 F2: a dead context takes nothing. destroy()
    // drains this stack and nulls the host's handle AFTER it returns
    // (worldModes' `dungeonCtx = null` follows the call), so for that
    // gap both doors into the stack - this one and worldModes'
    // showQuestOverlay, which is this one by another name - would land
    // a box on a stack nobody draws again. Refused, it falls to the
    // host that stands.
    if (_ctxDead) return false;
    dungeonWindows.reconcile(activeOverlay);   // whatever the slot holds NOW is the top
    if (dungeonWindows.containsWindow(win)) return true;
    dungeonWindows.pushWindow(win);
    return true;
  }
  // V1: the infection's host seam - the dream/death videos, the
  // fortnight clock raise and the popup (THE FOUR HOSTS RULE). AUDIT 39
  // (#37): borrowed, and handed back in destroy().
  // DISC10-D V3: the dungeon has no FACTION.TXT of its own, and needs
  // none - the clan is read off the PLAYER's own faction store
  // (FormulaHelper.cs:403), which a turn underground carries like any
  // other. DISC10-D V4: and the cemetery transfer rides in from the
  // host that mounted this context (worldModes hands world.js's arm
  // down); a standalone dungeon cannot arrive anywhere and passes none.
  const _prevInfectionHost = wireInfectionVideos(renderer, {
    textAt: (id) => textRsc?.plainText(id) ?? null,
    // ENH-NOTICE3: THE `showText` THIS HOST USED TO PASS IS GONE. The
    // box is raised by the shared seam itself (scenes/shared.js ->
    // systems/notify.js), and it is still the PUSH ROAD review-p
    // converted it to: VampirismInfection.cs:186-188 is
    // `DaggerfallMessageBox mb = DaggerfallUI.MessageBox(
    // deathIsNotEternalTextID); mb.Show();` and MessageBox is `new
    // DaggerfallMessageBox(uiManager, uiManager.TopWindow); ...;
    // messageBox.Show()` (DaggerfallUI.cs:1346-1353) - a PushWindow
    // that has never asked what is open. What the four hosts each
    // wired by hand, the presenter registered above now answers for.
    transferToCemetery: opts.transferToCemetery ?? null,
    // DISC10-D V8: "Cancel rest window if sleeping" (VampirismInfection.cs
    // :152-154) - the dungeon's one slot; dispose is CloseWindow's plain pop.
    cancelRest: () => { if (activeOverlay?.isRestWindow) activeOverlay.dispose?.(); },
  });

  // ── U26: THE NATIVE INVENTORY IN THE DUNGEON ─────────────────────
  // This host kept ui/deathScreen.js's keyed window while the exterior
  // hosts moved to the classic one at U8d, so a dungeon had no tabs,
  // no paperdoll, no real info panel and - after U25 - no Use mode
  // either, which is where a torch is actually lit. It was the last
  // host without it.
  //
  // What the swap needed, and why it was a slice rather than an edit:
  //  - a GROUND PILE for Remove-mode drops. droppedLoot is written
  //    host-agnostically (renderer + getTexture + uploadRecordFrame)
  //    and simply had never been mounted here, so items dropped in a
  //    dungeon had nowhere to land.
  //  - RAW KEY CODES. routeKey handed every overlay an ACTION
  //    ('back'/'confirm'/'up'), which is the keyed windows'
  //    vocabulary and cannot express F6, a mode button or a digit.
  //    ui/input.js now passes the code through for a native window,
  //    exactly as townTalk's seam has since G2.
  const droppedLoot = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });
  preloadInventoryArt({ renderer, fetchBytes, palette });
  preloadSpellbookArt({ renderer, fetchBytes, palette })   // U42: SPBK00I0/01I0 + the ICON/MASK sheets warm at boot
    .catch((e) => console.warn('[spellbook] classic spellbook art unavailable:', e?.message ?? e));
  preloadBookArt({ renderer, fetchBytes, palette });   // B1: BOOK00I0 warms at boot
  preloadListPickerArt({ renderer, fetchBytes, palette });   // X11b: PICK00I0 for the Create Item picker AND (DR1) the Dispel Magic bundle picker - without this the seam is silently dead
  // DR1: INVE00I0 + SHOP00I0 + FONT0004 + the mode panels, warmed at
  // BOOT for the same reason X11c moved worldModes' warm off the
  // first door: the Identify WINDOW is a SPELL's, and a caster who
  // has never opened a shop still owns the spell. Without the warm
  // `tradeArtLoaded()` answers false for ever and the seam is
  // silently dead - the exact shape the PICK00I0 line above guards.
  preloadTradeArt({ renderer, fetchBytes, palette });
  preloadRestArt({ renderer, fetchBytes, palette });   // D3: REST00I0/01I0/02I0 for the rest window's two pages

  /** One builder for every way this host opens the window - the bare
   *  F6 press and each loot target - so a hook cannot reach one and
   *  miss the others (THE ONE CONSTRUCTION SEAM, which U25's sweep
   *  found four instances of in the exterior hosts). */
  // B1 + AUDIT B-C2: the fetch is ASYNC, so by the time it resolves
  // the player may have opened something else - the reader takes the
  // slot only if it is still free (never clobbers a live window).
  const openBookHook = makeOpenBookHook({ fetchBytes, showReader: (w) => { if (!activeOverlay || activeOverlay.done) activeOverlay = w; } });   // EB4: the pack is done, not yet dropped, when the file lands
  /** U42: the CLASSIC spellbook, ONE construction for the F5 sheet's
   *  button and the Backspace hotkey alike. PlayerEntity.GetSpells()
   *  is the player's own array and the window WRITES to it, so it is
   *  handed by reference. Null when the art has not landed - this
   *  host has no HUD line to say so with, and DFU without SPBK00I0
   *  has no window either. */
  // PX23: the book's ONE door. Four hosts built this identically but
  // for how each reaches TEXT.RSC; that difference is all this host
  // hands it now.
  const makeSpellbookWindow = () => createSpellbookWindow({
    entity: playerEntity,
    magic,
    castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
    rows: (id) => textRsc?.variantLinesById(id) ?? [],
  });

  /** The quest bridge's two reads, or NEITHER - charSheetHooks turns
   *  the absence into the sheet's refusal rather than an empty book. */
  //
  // HandleQuestClicks' find-place seam (DaggerfallQuestJournalWindow.cs
  // :439-466) is deliberately NOT here: this context owns no travel map
  // - openTeleportMap is read off the outer host for the same reason -
  // so there is nowhere to send the player and the journal leaves the
  // dialog unoffered rather than raising one that goes nowhere.
  const questJournalHooks = () => (opts.questBridge ? {
    questMessages: () => opts.questBridge.machine.getAllQuestLogMessages() ?? [],
    // MAC-K2: the chronicle's Quests section takes the WALK, the same
    // one the pause tab takes - see questBridge.js.
    questLog: () => opts.questBridge.questLog(),
    notebook: () => opts.questBridge.notebook ?? null,
    // QUEST1: the Share button, delegated through the SAME chain
    // dungeonOnline/useMagicItem/survivalEnv already ride - the dungeon
    // has no online layer of its own, only whatever the outer host
    // (world.js, through worldModes.js's own delegation) answers. This
    // is what makes the button work while actually standing in the
    // dungeon, not only after walking back outside it.
    partyMembers: () => opts.partyMembers?.() ?? [],
    shareQuest: (uid, questName, displayName) => opts.shareQuest?.(uid, questName, displayName),
    // JOURNAL1: a note's Share - who a page can be held out to, and the letter - through the same chain
    pageShare: () => opts.pageShare?.() ?? null,
    // GUIDE2: the journal's WHERE - HandleQuestClicks' two world questions, the outer host's (delegated through
    // worldModes.js). The find-place door stays unset, as above: this context owns no map.
    canFindPlace: opts.questCanFindPlace,
    currentLocationName: opts.questLocationName,
  } : {});

  /** AUDIT 39 (#38): the chronicle's ONE builder. The key doors mount
   *  it themselves; the pause window's Chronicle button needs the
   *  WINDOW back, because its own slot is still holding the pause
   *  overlay it has just closed. No bridge, no book - the same nothing
   *  the sheet's button gives. */
  function makeJournalWindow(mode) {
    if (!opts.questBridge) return null;
    preloadQuestJournalArt({ renderer, fetchBytes, palette });
    // PX24d: through the chronicle's door, the way the spellbook goes
    // through its own. This host has no map, so it leaves gotoPlace
    // unset - the same nothing a CanFindPlace miss gives.
    return createChronicleWindow({
      ...questJournalHooks(),
      mode,
      entity: playerEntity,
      // MAC-K2 (Mac: "Logbook not reflecting quests"). This read
      // `mode === 'messages' ? 'messages' : 'notes'`, with the note
      // that "the two quest modes land on Notes because the pause
      // window has carried quests since PX4" - which made the L key,
      // InputManager's own `LogBook`, open the player's NOTEBOOK. The
      // chronicle now has a Quests section (ui/enhancedChronicle.js)
      // fed by the SAME walk the pause tab uses, so each classic mode
      // lands on the page that holds what it names.
      section: mode === 'messages' ? 'messages'
        : (mode === 'notebook' ? 'notes' : 'quests'),
    });
  }

  /** U53's ONE-BUILDER LAW, held here too: this context's host-owned USE hooks
   *  in ONE bag, taken by the inventory builder below and by QS2's quickslot
   *  performers. They were written inline in the builder's argument list, which
   *  is one copy away from a potion behaving differently from the key than it
   *  does from the Use button. */
  const useHooks = {
    // ROAD-A7: the reader takes a PICK now. The painting arm of the
    // info panel asks for GetRandomTokens' dfRand draw (TextProvider
    // .cs:228); everything else keeps Random.Range's default.
    rows: (id, pick) => textRsc?.variantLinesById(id, pick ?? Math.random) ?? [],   // AUDIT 22 F2
    drinkPotion: (key, potent) => magic.drinkPotion(key, potent),   // U44: DrinkPotion through the ONE cast engine; PROF12: a Potent potion's share
    // QuestMachine.GetQuest - the use-click block
    // (DaggerfallInventoryWindow.cs:1673) and ResolveItemLongName's
    // quest-letter arm (ItemHelper.cs:338). The standalone `?dungeon`
    // page mounts no bridge and answers null, which is the same
    // fall-through DFU takes with nothing watching.
    getQuest: (uid) => opts.questBridge?.machine?.getQuest?.(uid) ?? null,
    // U44 / MAPLOOT1: no region index here - the OUTER host's reveal (world.js revealLocation via worldModes), null on ?dungeon
    revealMap: opts.revealMap ?? null,
    nowMinute: () => Math.floor(ownMinutes()),   // AUDIT 21 F2: the one clock; LIVED1: a meal, a dose, a food's age are the character's own time
  };
  /** QS2: the diamond's presses - see scenes/world.js's twin for the whole of
   *  the reason. `say` is this context's own HUD line, the one the weapon rig
   *  and the dropped torches already speak through. */
  /** UI2: the pack's three window doors, one bag with a hotbar slot's Use - see scenes/world.js's twin. */
  const packDoors = {
    openBook: openBookHook,   // B1: the use-mode book arm
    placeCamp: (item, list) => camps.placeItem(item, list ?? playerEntity.items ?? []),   // SURV3: a fire on the floor - AUDIT SURV-TIERS: off the list it was used from
    // U42: USING the Spellbook item opens the book
    // (DaggerfallInventoryWindow.cs:1748-1764). The inventory has
    // just run its own close law, so the slot is free.
    openSpellbook: () => { const b = makeSpellbookWindow(); if (b) activeOverlay = b; },
  };
  const quickUse = (n) => {
    useQuickslot(n === 1 ? 'c1' : 'c2', {
      entity: playerEntity, items: playerEntity.items ?? [], hooks: { ...useHooks, isEnchanted, hand: () => quickslotHand(weaponRig), ...packDoors }, say: (l) => hudText.add(l),   // DISC21-C; UI2: the pack's doors
    });
    return true;
  };
  const quickSwap = () => {
    swapQuickslot({ entity: playerEntity, say: (l) => hudText.add(l), rows: useHooks.rows, hand: weaponRig.handDoor() });   // LH1: the used hand
    weaponRig.refreshWorn();
    return true;
  };
  /** QS6: the spell slot's press - see scenes/world.js's twin. `magic` is
   *  THIS context's cast engine, which is the one the dungeon's hands cast
   *  from, so the ready the key makes is the ready the click fires. */
  const quickSpell = () => {
    spellQuickslotPress({ entity: playerEntity, magic, say: (l) => hudText.add(l) });
    return true;
  };
  /** QS4: the off-hand cell's press - see scenes/world.js's twin. Underground
   *  it is the one of the four that matters most.
   *  QS6: and the SWAP when that is what the cell shows - the key does what
   *  the cell shows, which is this cell's law since QS4. */
  const quickOffHand = () => {
    if (offHandOffersSwap(playerEntity)) return quickSwap();
    offHandQuickslot({ entity: playerEntity, say: (l) => hudText.add(l), switchHand: () => weaponRig.switchHand(), toggleLight: () => weaponRig.toggleLight() });   // MAC-R3: the hand's own act beside the light's
    return true;
  };
  const quickSwitchHand = () => { weaponRig.switchHand(); return true; };   // MAC-R3: the main cell's press - world.js's line
  /** QS6 - ONE FRAME of the hold machine, handed OUT rather than driven here:
   *  this context has no frame of its own, and BOTH hosts that mount it (the
   *  standalone `?dungeon` page and the world's dungeon mode) own one. They
   *  call this beside their own ReadyWeapon latch, which is where the other
   *  polled keys are read. `isHeld` is theirs too - the held-key Set is the
   *  host's - so the gate a key takes here is the gate that host gives it. */
  const tickQuickHold = (dt, { isHeld = null, blocked = false } = {}) => tickQuickslotHold(dt, {
    isHeld, blocked, entity: playerEntity,
    onTap: (slot) => (slot === 'spell' ? quickSpell() : quickUse(slot === 'c1' ? 1 : 2)),
  });

  function openInventory(lootItems, onEmptied = null, { wagonPrompt = false, lootHooks = null, lootKey = null } = {}) {
    // V4: GetSuppressInventory (LycanthropyEffect.cs:409-421) - a
    // transformed lycanthrope opens NO inventory, loot included.
    // DISC10-E L3: said by the DOOR now (ui/inventoryDoor.js, where DFU's
    // window says it), which answers null; every caller below mounts only
    // a window - the refusal's box is already on this host's stack.
    return createInventoryWindow({
      ...packDoors,   // UI2: the book, the camp and the spellbook - one bag with the hotbar's Use
      postItem: (text) => opts.postItem?.(text) ?? false, canPostItem: () => opts.canPostItem?.() ?? false,   // CHAT-POST: through the outer host
      usingRightHand: () => weaponRig.playerWeapon.usingRightHand,   // DISC12: the pack's figure holds the hand in USE
      say: (l) => hudText.add(l),   // FX1 (F128): the "Equipping %s" cue on close
      items: () => (playerEntity.items ??= []),
      wagonItems: () => (playerEntity.wagonItems ??= []),   // W-slice
      // W-slice: CheckWagonAccess's dungeon arm - the wagon is
      // reachable only within 5 units of an EXIT door
      // (DungeonWagonAccessProximityCheck :1099-1116; the classic
      // "your cart waits at the entrance" rule).
      horseCart: () => opts.horseCart?.() ?? null,   // HCC: the runtime's storage-access word, when the outer host runs the mod
      dungeon: {
        inside: true,
        wagonPrompt,   // AUDIT 28 W2c: AllowDungeonWagonAccess() before the push - CheckWagonAccess's FIRST arm
        nearExit: () => !!lastPlayerFeet && exitDoors.some((d) => {
          const p = [d.matrix[12], d.matrix[13], d.matrix[14]];
          return Math.hypot(p[0] - lastPlayerFeet[0], p[1] - lastPlayerFeet[1], p[2] - lastPlayerFeet[2]) <= WAGON_ACCESS_DISTANCE;
        }),
      },
      entity: playerEntity,
      icons: { getTexture, uploadRecord, textures: renderer.textures },
      openCharSheet: () => { const w = api.makeCharSheet(); if (w) activeOverlay = w; },   // MAC-C: the pack's other window key crosses over rather than doing nothing - the same door the sheet's own Items button takes back the other way
      ...useHooks,   // U53: the one bag
      // G5: a DROPPED pile hands DaggerfallLoot's whole identity
      // (playerOwned + TextureArchive/TextureRecord + position); an RDB
      // treasure pile or a corpse hands its FLAT alone, which is
      // UpdateRemoteTargetIcon's second arm (:880-884) and is not
      // player-owned, so CanChangeDropIcon refuses it.
      loot: lootItems ? { items: () => lootItems, ...(lootHooks ?? {}) } : undefined,
      // lastPlayerFeet is written by the frame loop; a drop before the
      // first frame has nowhere to land, and DFU's own container mint
      // is at the player's position - so no feet, no pile, loudly.
      // G5: the chosen drop icon and, when a loot target was replaced,
      // that container's own x/z (:698-714).
      onDrop: (items, icon = null, at = null) => (lastPlayerFeet
        ? droppedLoot.dropPile(items, containerDropPos(at, [...lastPlayerFeet]), null, icon)
        : console.warn('[loot] dropped before the first frame; no ground position yet')),
      // WORLD4: what is LEFT goes to the room on the close - the same moment DFU frees an emptied container's flat,
      // and the moment the taking is finished rather than half done
      onClose: () => { onEmptied?.(); if (lootKey) { _lootOpenKey = null; publishLoot(lootKey); } droppedLoot.releaseEmptied(); surfacePlayer(); },   // AUDIT WORLD4 C1: the window is closed before the close's word goes, so the room's next word may land
    });
  }

  const hudText = new HudText('dungeon');   // U5: classic popup messages   // AUDIT FONT F1: named, because scenes/townTalk.js owns a SECOND PopupText that draws in the same frame on ?world - under the enhanced skin the two shared one DOM column and each blanked the other
  // wave 22: this host has a HudText of its own, so it needs the same
  // notebook sink PopupText.AddText carries (:123).
  hudText.onMessage = (t) => opts.hudMessageSink?.(t);
  // ENH-NOTICE3: THIS CONTEXT'S STACK AND THIS CONTEXT'S PopupText,
  // offered to systems/notify.js for as long as the context stands.
  // Priority 20, in front of worldModes' presenter (10) and townTalk's
  // (0): underground the dungeon stack IS the top window, on ?world
  // and on ?dungeon alike, and every DaggerfallUI.MessageBox is a
  // PushWindow onto it (ROAD-B B5). destroy() takes the registration
  // back - a box raised after the context is gone belongs to whoever
  // stands next, never to a dead stack.
  //
  // AUDIT ENH-NOTICE3 F1 - NOT LIVE UNTIL ADOPTED. This registration
  // runs in the middle of the build, and the build awaits the HUD art,
  // the meshes and the textures for seconds AFTER it, with the world
  // host's frame, clock and magic rounds still running outdoors at
  // the door. A box raised in that window (the infection's deploy, a
  // holiday, a talk refusal) would land on a stack nothing draws yet -
  // and be destroyed with the context if the transition then aborts.
  // DFU has no such window: `uiManager.TopWindow` is always the one
  // live stack. So the presenter answers `active` only once the host
  // has ADOPTED the context (`goLive`, called by worldModes after
  // `mode = 'dungeon'` and by the standalone host after its await),
  // and never once it is dead.
  let _live = false;
  const _unregisterPresenter = registerPresenter({
    mount: (win) => pushDungeonWindow(win),
    hudText: (line, delayInSeconds) => { hudText.add(line, delayInSeconds); return true; },
    active: () => _live && !_ctxDead,
    priority: 20,
  });
  // AUDIT 64 F34: SetMidScreenText ends with the SAME
  // `Notebook.AddMessage(message)` PopupText.AddText carries
  // (DaggerfallHUD.cs:371 / PopupText.cs:123), so the label files into
  // the journal's Messages page through the same host sink.
  //
  // EVERY ALLOCATION HAS AN OWNER: `hudText` is this context's own, but
  // `midScreenText` is a MODULE SINGLETON (ui/midScreenText.js:183) -
  // the one label the outer host shares - so the seam is BORROWED, not
  // owned, and destroy() hands it back (the _prevPassiveHost idiom this
  // file already uses for its other process-global seams). A bare null
  // would not do: on ?world and ?exterior the previous holder is the
  // host's own townTalk sink (world.js:16022 / exterior.js:3926), set
  // once at boot and never again, so nulling on the way out of the
  // first dungeon would silently un-file every mid-screen label above
  // ground for the rest of the session - MC-1's own bug, re-opened.
  const _prevMidScreenSink = midScreenText.onMessage;
  midScreenText.onMessage = (t) => opts.hudMessageSink?.(t);
  // P10 action seams: teleport destination resolution (the scene
  // installs onTeleport to warp its motor) + the classic look-at-lock
  // text on a refused locked door (LookAtInteriorLock, chance-tiered
  // over the LIVE lockpicking skill).
  actions.resolvePosition = (ns, key) => positionIndex.get(`${ns}:${key}`) ?? null;
  // AUDIT 64 F34: LookAtInteriorLock speaks the whole difficulty
  // ladder and `magicLock` through SetMidScreenText
  // (PlayerActivate.cs:996-1007), never the popup queue.
  actions.onLockedDoor = (o) => setMidScreenText(lookAtLockText(o.currentLockValue, playerEntity.level, skillValue(playerEntity, SKILLS.Lockpicking)));
  // R1: the STEAL-mode pick attempt's doors - the tally
  // (TallySkill(Lockpicking, 1), DaggerfallActionDoor.cs:165), and the
  // attempt line + the picked-lock sound (ActivateLockUnlock :178-183;
  // the door's own open sound follows through onDoorState).
  actions.onLockpickTally = () => tallySkill(playerEntity, SKILLS.Lockpicking, 1);
  actions.onLockpickResult = (o, success) => {
    hudText.add(success ? LOCKPICKING_SUCCESS_TEXT : LOCKPICKING_FAILURE_TEXT);
    if (success) audio.play3d(SOUND.ActivateLockUnlock, [o.matrix[12], o.matrix[13], o.matrix[14]]);
  };
  // X1: the Open/Lock SPELL outcome - the same door, one law up
  // (systems/mysticism.js). The armed effect is consumed here, so a
  // cast is spent whether or not the lock yielded, exactly as DFU's
  // CancelEffect on trigger does.
  wireDoorSpells(actions, playerEntity, (t) => hudText.add(t));
  // X4: the Detect scan. This host has both nearby pools DFU walks -
  // live foes and loot piles - so all three Detect spells are real
  // here. The thunks are lazy: `foes` and `lootPiles` are populated
  // further down and only read at tick time.
  const detectFeed = createDetectFeed(playerEntity, {
    entities: () => foes.filter((f) => !f.dead && f.ai).map(foeNearbyRecord),
    // DT1: the loot pool was the RDB piles ALONE, while this host's own
    // activation walk (`lootTargets`) has answered three kinds since
    // U26 - piles, corpses and the player's dropped piles. DFU makes no
    // such distinction: `GetActiveLoot()` (PlayerGPS.cs:765-776) is
    // every active DaggerfallLoot in the scene, which underground is
    // all three. So Detect Treasure in a dungeon missed the corpse you
    // had just made and the sack you had just dropped - the F207
    // finding exactly, one host over, and this is where it bites
    // hardest because a dungeon is where the spell gets cast.
    loot: () => nearbyLootRecords({ piles: [...lootPiles, ...droppedLoot._piles], foes }),
    feet: () => lastPlayerFeet ?? [0, 0, 0],
  });
  // A2: DaggerfallAction.Play's sound - the RDB sound field fires from
  // the object on every Play (the default min1/max500 3D profile;
  // movers speak from their live matrix, effect objects from origin).
  // AUDIT 58: it is a sound ID, not a record index. RDBLayout names
  // the parameter `int soundID_and_index` (:951) and stores it as
  // action.Index (:964), whose own comment calls it "the raw sound
  // index from daggerfall" (DaggerfallAction.cs:42) - but the wiring
  // is unambiguous: AddActionAudioSource casts it to uint
  // (RDBLayout.cs:1075) so that `c.SetSound(id)` binds the UINT
  // overload (DaggerfallAudioSource.cs:170-181), which is the only one
  // of the three that runs GetSoundIndex. Played as an index, every
  // RDB action in every dungeon rang a different clip from the one the
  // block asked for.
  actions.onActionSound = (o) => {
    const p = o.origin ?? (o.matrix ? [o.matrix[12], o.matrix[13], o.matrix[14]] : null);
    if (p) audio.play3dId(o.index, p);
  };
  // AttemptBash's PlayerDoorBash (clip 7) from the door - the A1 seam
  // family (2026-08-16 audit: the hook existed unwired since the bash
  // slice routed it to Audio; A2's engine closes it).
  actions.onDoorBash = (o) => audio.play3d(SOUND.PlayerDoorBash, [o.matrix[12], o.matrix[13], o.matrix[14]]);
  // U6: the text-action seams. ShowText/ShowTextWithInput open modal
  // boxes on the overlay seam (the world holds); DoorText rides the
  // HUD popup (AddHUDText 2.0s); the trespass check is
  // MakeEnemiesHostile over this dungeon's pool (below).
  // MACRO1 (Discord, kurkku: "this prompt doesn't show the location
  // name properly" - "Do you wish to access your wagon and stay in
  // %cn?"): DFU's message boxes take their tokens through SetTextTokens,
  // which runs MacroHelper over EVERY record - so a TEXT.RSC line never
  // reaches the screen with a %code in it. This reader handed the raw
  // record on. The GLOBAL symbols are expanded here, at the one reader
  // every box in this host draws from: %cn is MacroHelper.CityName
  // (MacroHelper.cs:566-573) - the current LOCATION, which in a dungeon
  // is the dungeon's own location, falling back to the region - and
  // %pcn/%pcf the player's name. A code with no producer here stays
  // verbatim, exactly as the talk chain leaves one (talkSession.js).
  const rscLines = (id) => {
    const v = textRsc?.plainText(id);
    if (!v?.length) return null;
    const text = expandMacros(v[0], { playerName: playerEntity?.name ?? '', cityName: dfLocation?.name || dfLocation?.regionName || '' });
    return text.split('\n').filter((l) => l.length);
  };
  actions.onShowText = (id) => {
    const lines = rscLines(id);
    if (!lines) return console.warn(`[action] ShowText ${id}: TEXT.RSC record unavailable`);
    // ROAD-B B5: DaggerfallAction's ShowText is DaggerfallUI.MessageBox
    // (DaggerfallAction.cs) - PushWindow, not "only if the slot is
    // free". A dungeon's own plaque read as silence whenever anything
    // else was open.
    // AUDIT 64 F35 (review round): ...and it is the ONE box in the
    // port that passes a NULL previousWindow - `new
    // DaggerfallMessageBox(DaggerfallUI.UIManager, null)`
    // (Internal/DaggerfallAction.cs:536), where DaggerfallUI.MessageBox
    // passes the then-top. So this plaque covers the HUD where a quest
    // popup does not.
    // ENH-NOTICE3: through the one door, with that exception PASSED
    // rather than re-minted - `previousWindow: false` is the port's
    // spelling of DaggerfallAction's null (ui/windowStack.js:65 reads
    // it `=== true`, so false and null paint the same nothing). The
    // routing does not move: this context's presenter stands at
    // priority 20 while the dungeon is live, and its mount IS
    // pushDungeonWindow.
    messageBox(lines, { previousWindow: false });
  };
  actions.onShowTextInput = (id, submit) => {
    const lines = rscLines(id);
    if (!lines) return console.warn(`[action] ShowTextWithInput ${id}: TEXT.RSC record unavailable`);
    // ...and its DaggerfallInputMessageBox twin, which is worse to
    // lose: the box is the only way to answer the riddle it asks.
    pushDungeonWindow(new ActionInputBox(lines, submit));
  };
  actions.onDoorText = (id) => {
    const lines = rscLines(id);
    if (!lines) return console.error(`[action] bad DoorTextID requested: ${id}`);   // DFU throws; we log loudly
    // AUDIT 63 F39: AddHUDText(tokens, 2.0f) (DaggerfallAction.cs:875)
    // carries its delay PER LINE through PopupText.cs:130-141; the bare
    // add() took PopupText's 1.0 popDelay and halved every plaque.
    for (const l of lines) hudText.add(l, DOOR_TEXT_HUD_DELAY_S);
  };
  // ROAD-B: THE TRESPASS CHECK IS A REAL SWITCH NOW.
  // DaggerfallAction.cs:882-890 - a DoorText record whose
  // ActionAxisRawValue is over 5 is classic's trespass flag, and
  // stepping through it calls GameManager.MakeEnemiesHostile(). This
  // logged a warning instead, on a claim ("foes are hostile-on-sight")
  // that stopped being true when AUDIT 39 wired RDBLayout's passive
  // marker: both spawn branches below hand the motor the marker's
  // reaction, so a dungeon holds non-hostile foes this switch is the
  // whole point of. The walk is the host's own live pool - one
  // ActiveGameObjectDatabase, one dungeon.
  actions.onTrespass = () => makeEnemiesHostile(foes);
  // ...and the same law at DaggerfallActionDoor.cs:220-221: bashing
  // ANY action door while inside a dungeon CASTLE turns the castle
  // hostile, whether the bash opened it or not. The castle read is the
  // ActionSystem's own dep (above); this is the sink.
  actions.onMakeEnemiesHostile = () => makeEnemiesHostile(foes);
  // AUDIT 63 F33: the same GameManager.MakeEnemiesHostile call, for the
  // standalone host's ActivateMobileEnemy arm (PlayerActivate.cs
  // :1667-1669 - the failed pickpocket's room-wide aggro).
  const makeAreaHostile = () => makeEnemiesHostile(foes);
  let lastPlayerFeet = null, lastPlayerHeight = CAPSULE_HEIGHT;   // ROAD-H H2: the LIVE player capsule the last frame carried - explodeAt measures the AoE sphere against it (DaggerfallMissile.cs:481)
  // (enhancedNav is declared beside `foes` at the top of this function -
  // see the note there for why it cannot live here.)
  // S11: the save position
  let debugHud = false;   // F8 diagnostics
  let _motorState = '';
  let _motorYaw = 0;   // A1: the automap window's player-arrow heading
  let _mouseState = 'no events';
  let _inputState = '';
  const _activity = { running: false, runningTally: false, swimming: false, climbing: false, standing: false, jumped: false, parkoured: null, movingLessThanHalfSpeed: true, odometer: null, grip: null };   // CLIMB2: + the grip (a state, not an edge)   // MOVE-REAL: + the motor's odometer   // AUDIT 64 F7: the tally's gate is PlayerEntity.cs:311, the fatigue band's is :408   // AUDIT 26 F083: + climbing   // P11 fatigue state; P13 sneak state; C6 jump edge
  let _grounded = true;   // U7: the rest gate reads the motor's live grounded flag
  // U7: the rest session's scene seams. tickVitals = one rested hour
  // (the S20 rates + the Medical tally, clamped); enemiesNearby is
  // the RESTING AreEnemiesNearby variant - an aware foe at any
  // spawn-band range, an unaware one only within the 12-unit resting
  // distance; fullyHealed follows IsPlayerFullyHealed (magicka full
  // OR a NoRegenSpellPoints career).
  // S40: IsPlayerFullyHealed and the rested hour moved to shared.js -
  // this host was the only one that could rest, so it owned the
  // composition; three hosts now need the same two facts.
  const _restFullyHealed = () => restFullyHealed(playerEntity);
  // U3: the level-up screen replaces the headless auto-apply (shared
  // by the rest-end raise and any future travel arm).
  // AUDIT 44 (a11): dfuiOpenCharacterSheetWindow (RaiseSkills :1414) -
  // the SHEET is what classic opens, and the rollout mounts onto it.
  // `api.toggleCharSheet` is this host's ONE sheet construction (its
  // own free-slot guard included); calling it here rather than
  // building a second bag is the same rule U43 wrote for F5.
  const _onLevelUp = () => {
    // LV2 - THE RISING: the classic skin keeps this host's line and
    // its own sheet toggle (free-slot guard included); the enhanced
    // skin announces and lets the player choose the moment.
    announceLevelUp(playerEntity, {
      say: (m) => hudText.add(m),
      open: () => api.toggleCharSheet(),
    });
  };
  // E-slice: a rest-interruption ENCOUNTER - one foe minted through
  // the same chain as the load loop, at the classic minimum distance
  // from the player (CreateFoeSpawner's placement compressed to the
  // eight compass points, floor-landed, nearest workable first).
  /** RE1: DFU's spawner is a MonoBehaviour that retries every frame
   *  for free; a bounded loop is the port's own call, so a spawn that
   *  cannot find a spot in a sealed room does not spin. The same bound
   *  the enchantment stander uses. */
  const ENCOUNTER_PLACE_ATTEMPTS = 12;
  /** RE1: the rest interruption, stood through DFU's own placement.
   *
   *  This used to walk EIGHT COMPASS POINTS at minDistance and take
   *  the first with a floor under it, so the thing that woke you
   *  arrived due north unless north was blocked, could stand inside a
   *  wall the ray never tested, and could share a spot with a foe
   *  already there. PlayerEntity's arm goes out through
   *  CreateFoeSpawner - PlaceFoeFreely - like every other spawn.
   *
   *  ITS FLAG IS FALSE (PlayerEntity.cs:610), alone among the three
   *  encounter arms, and that is the one you feel: with the check set
   *  the foe is placed just outside your view, and cleared it takes
   *  any bearing in the circle. DFU's own comment is "Don't care about
   *  player's field of view (e.g. at rest)" - a monster that finds you
   *  asleep is allowed to be standing over you when you wake. The band
   *  and the flag both ride in on the hit; encounters.js carries them
   *  per arm because they are the spawner's arguments. */
  async function _spawnEncounter({ mobileType, minDistance, maxDistance, lineOfSightCheck }, { feet = lastPlayerFeet, yaw = _motorYaw, shared = false } = {}) {   // REST-SYNC: a joiner's feet when the host stands it by them; `shared` the room's
    if (!feet || !foeDeps) return null;
    if (!ENEMY_BASICS[mobileType]) return null;
    const env = placeFoeEnv({
      collider,
      // the cast origin is the controller centre, as every other
      // consumer of the ring has it
      playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
      playerYawRad: yaw,
      fovDegrees: fieldOfView() * 180 / Math.PI,   // fieldOfView() answers RADIANS
      isOccupied: entityOccupancy((f) => f.ai?.feet, () => foes, feet),
    });
    let spot = null;
    for (let i = 0; i < ENCOUNTER_PLACE_ATTEMPTS && !spot; i++) {
      spot = placeFoeFreely(env, { minDistance, maxDistance, lineOfSightCheck });
    }
    if (!spot) return null;
    // FinalizeFoe (FoeSpawner.cs:210-226): a flier hangs 1.5 above the
    // test point; a walker lands through the build chain's own floor.
    const fly = (ENEMY_BASICS[mobileType].behaviour ?? 'General') === 'Flying';
    // NT2 (F210): no ad-hoc roll - buildFoeAt resolves an unspecified
    // gender through GetTextureArchive's own DFRandom arm.
    const f = await buildFoeAt({
      mobileType, gender: 'unspecified',
      x: spot.x, y: fly ? spot.y + 1.5 : spot.y, z: spot.z, spawnDistanceType: 0,
    }, false);
    if (f?.ai) f.ai.yaw = Math.atan2(feet[0] - spot.x, feet[2] - spot.z);   // LookAt player
    if (f && shared && !_ctxDead) { f._encId = ++_sharedSeq; _sharedById.set(f._encId, f); }   // REST-SYNC: the room's, by the room's number
    return f ?? null;
  }
  /** REST-SYNC: THE REST'S ENCOUNTER - the player's own offline; online the ROOM's: the host stands it shared, and a
   *  joiner asks the host to stand it by the joiner's feet (the act frame's `rs`: the species, the band, the sight
   *  test, the feet and the yaw), its own rest breaking at the next hour's check (enemiesNearby) as DFU's does. An ask
   *  the wire refuses stands nothing and breaks nothing - never a foe only its asker can see, which was the report. */
  let _restAskAt = null;
  function restEncounter(hit) {
    if (!onlineRoom()) return _spawnEncounter(hit);
    if (_authority) return _spawnEncounter(hit, { shared: true });
    const feet = lastPlayerFeet;
    if (!feet) return null;
    if (opts.onActions?.({ k: _locationKey, rs: { t: hit.mobileType, lo: hit.minDistance, hi: hit.maxDistance, v: hit.lineOfSightCheck ? 1 : 0, f: [q2(feet[0]), q2(feet[1]), q2(feet[2])], y: q3(_motorYaw) } })) _restAskAt = Date.now();
    return null;
  }
  /** REST-SYNC: my ask is on its way - the rest it came from breaks at the next hour's check, once. */
  function roomEncounterComing() {
    if (_restAskAt == null || Date.now() - _restAskAt > REST_ASK_WAIT_MS) return false;
    _restAskAt = null;
    return true;
  }
  /** REST-SYNC: the host's half of a joiner's ask - one a REST_ASK_GAP_MS a player, the species a foe, the band a rest's,
   *  the feet inside the dungeon's reach; the encounter stood shared by those feet. */
  const _askAt = new Map();
  function roomEncounterAsked(id, rs) {
    if (!_authority || !onlineRoom() || typeof id !== 'string' || !rs || typeof rs !== 'object' || Array.isArray(rs)) return false;
    const t = rs.t, lo = rs.lo, hi = rs.hi;
    if (!Number.isInteger(t) || !ENEMY_BASICS[t]) return false;
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi >= lo && hi <= REST_ASK_BAND_MAX)) return false;
    const f = Array.isArray(rs.f) && rs.f.length === 3 && rs.f.every((v) => Number.isFinite(v) && Math.abs(v) <= HIT_POS_MAX) ? [rs.f[0], rs.f[1], rs.f[2]] : null;
    if (!f) return false;
    const now = Date.now();
    if (now - (_askAt.get(id) ?? -Infinity) < REST_ASK_GAP_MS) return false;
    _askAt.set(id, now);
    _spawnEncounter({ mobileType: t, minDistance: lo, maxDistance: hi, lineOfSightCheck: rs.v === 1 }, { feet: f, yaw: Number.isFinite(rs.y) ? rs.y : 0, shared: true })
      .catch((e) => console.error('[online] a joiner\'s rest encounter could not stand:', e));
    return true;
  }
  /** The rest window's clock jump for THIS host: the world minutes
   *  plus IntermittentEnemySpawn's catch-up loop, which is a dungeon
   *  law and is the one rest dep createRestDeps cannot supply. */
  const _restAdvance = (n) => {
    // E-slice: IntermittentEnemySpawn's catch-up loop across the
    // advanced minutes (PlayerEntity.Update:486-492) - resting in
    // a dungeon under an active enemy alert can spawn ONE foe; the
    // hourly enemy check then breaks the rest, DFU's own flow.
    //
    // AUDIT WORLD5 C8 read the span off the rest session's own counter
    // under the shared clock, where the write below was refused.
    // LIVED1: the write is the CHARACTER's clock now (classicMinutesRef
    // is its view) and it moves online as offline, so the span is simply
    // the n minutes the clock is about to take.
    const end = classicMinutesRef.value + n;
    const start = Math.floor(end) - n;
    advanceOwnMinutes(n);   // TIME3: a RaiseTime, counted - a quest charges a rest whole
    // AUDIT 24 (wave 30) - THE BROKER RUNS UNDER THE REST WINDOW.
    // The old line here said "the round loop catches the magic
    // rounds up", and it does not: dungeon.js returns at the
    // overlay gate (its `hold gameplay, keep the loop` return -
    // NAMED, not numbered: it was cited as :385-396, which drift has
    // since made the footsteps block) before this host's frame body, so
    // through a whole rested night nothing ticked a disease, a
    // poison or an active effect - and the marker then fired the
    // entire backlog in ONE burst on the first frame after the
    // window closed, after tickVitals had already healed every
    // hour of it. In DFU the broker's Update runs under
    // Time.timeScale = 0 and interleaves, minute by minute, with
    // TickRest's hourly heal; a poison can kill you in your sleep
    // and the rest ends "You never awaken."
    const _w = claimMagicRounds(start, end);
    // AUDIT LIVED1 A (K2/S1/R3): the sky these rounds read (the moon, VAMP-DAY, a sun-damaged career's light) is the
    // WORLD's, as the tick's own rounds read it (worldTick.js skyMinutes: worldTo) - without it the window's end, the
    // character's clock, forced a werewolf's change under the character's own full moon mid-rest
    runMagicRoundsFor(playerEntity, _w.from, _w.to, { sinks: playerSinks, say: (msg) => hudText.add(msg), skyMinutes: sharedClockOn() ? Math.floor(skyMinutes()) : null });   // TIME1: the sky's own clock
    // AUDIT SURV B: the NEEDS under the rest window too. This host's frame body holds the only tickPlayerMinutes call
    // and the rest overlay holds the frame, so the whole night reached the minute law on the first frame after the
    // window closed - with `isResting` already false, as AWAKE minutes: the sleep debt rose through a night by the
    // fire. Paid here while `isResting` stands (the env says sleeping and its kind); the record's own marker keeps
    // the frame from paying the same night again (runSurvivalMinutes).
    const feed = survivalFeed(playerEntity, survivalEnvNow(), { say: (msg) => hudText.add(msg) });
    if (feed) runSurvivalMinutes(playerEntity, start, Math.floor(end), feed.env, { ...feed.deps, sinks: playerSinks, rolls: Math.random });
    // ...and the FOE half of the same broker event. OnNewMagicRound
    // is global - every EntityEffectManager in the scene subscribes
    // - so a foe's poisons and effects age through the rest too.
    // The frame body's own foe loop anchors on the clock at the top
    // of THIS frame, so these minutes were not merely late for the
    // foes, they were lost.
    for (const f of foes) {
      if (f.dead) continue;
      runMagicRoundsFor(f.entity, _w.from, _w.to, { sinks: foeSinks(f, false) });   // AUDIT 68 S19-round-ticks-player-provenance: a round is nobody's blow unless its tick says so
    }
    // PlayerEntity.Update:380-384 runs BEFORE the catch-up loop below,
    // every frame - and in DFU a rest is frames, so an alert that turns
    // eight hours old mid-sleep goes out and the rest of the night
    // rolls unarmed. This window jumps the clock WITHOUT the player
    // tick (the tick's own call is in systems/worldTick.js), so the
    // decay has to be run here or the roll this loop gates on the flag
    // would stay armed for the whole rest.
    // AUDIT 68 S19-rest-alert-decay-wrong-clock: at the span's own end - the character's clock (LIVED1), which a
    // rested night moves online as offline.
    decayEnemyAlert(playerEntity, Math.floor(end));
    for (let l = 0; l < n && !_undercroftHall; l++) {   // ARENA-FIX 4: nothing breaks a rest in the fighters' hall
    const hit = intermittentEnemySpawn({
      gameMinutes: start + l + 1, inside: true, inDungeon: true, isResting: true,
      restAsks: playerEntity.restAsks,   // SURV4 + SURV-TIERS: priced at the open (scenes/shared.js) - the bare floor asks twice in Hard; a fire on it, or any Casual floor, once
      enemyAlertActive: !!playerEntity.enemyAlertActive,
      dungeonType: dfLocation.mapTableData.dungeonType,
      playerLevel: effectiveLevel(playerEntity),   // SOFTCAP2: mentor mode - the group's level
    });
    if (hit) { restEncounter(hit); break; }   // REST-SYNC: online the room's
    }
  };
  // S40: and the five closures every host owes the window, from the
  // ONE composition. This host wrote them out because it was the only
  // host that could rest; leaving them written out would have left the
  // shared version with two bodies, which is the drift THE FOUR HOSTS
  // RULE exists to stop. Only `advanceMinutes` stays here, because
  // IntermittentEnemySpawn's catch-up loop is a dungeon law.
  //
  // AUDIT 23 (entity-1): the rest-finished close raises skills - the
  // per-minute tick no longer does (DaggerfallRestWindow.cs:731).
  //
  // A dungeon is inside and never in daylight, so both of
  // CalculateHealthRecoveryRate's flags are fixed here.
  //
  // AreEnemiesNearby's RESTING variant is systems/encounters.js' now
  // too - three more hosts ask it, and two were asking a much coarser
  // question before this slice.
  const _restDeps = createRestDeps(playerEntity, {
    onClosedUnrested: () => opts.cancelPartyRestStart?.(),   // PARTY-REST29: the window closed with no rest chosen (restDoor.js)
    partyRest: () => opts.partyRestHere?.() === true,   // OVH4: a party's rest opens the party card on either skin (restDoor.js)
    // ROAD-B B5: `uiManager.TopWindow` for TickRest's two top-window
    // tests (:364, :399). B1 made this host's slot the MIRROR OF THE
    // TOP of its window stack, so the slot IS the answer - and the
    // reachable test is the second one, where a quest popup pushed by
    // the rest's own sub-tick suspends it mid-hour.
    topWindow: () => activeOverlay,
    // The MASTERY box (RaiseSkills :1390-1401) - TEXT.RSC 4020.
    // ROAD-B B5: a PUSH, as the interior host's has been since B1
    // (`box: (rows) => mountInterior(...)`). RaiseSkills runs from the
    // rest window's own close, so the slot it was testing was the one
    // the rest window had just left - and on the level-up path it is
    // not free at all.
    box: (rows) => pushDungeonWindow(new ActionTextBox(rows)),
    ask: (rows, onYes, onNo, boxOpts = {}) => pushDungeonWindow(new YesNoBoxWindow({ rows, onYes, onNo, ...boxOpts })),   // SOFTCAP3: the Master Skills box - DFU's Yes/No or OK box (both skins)
    advanceMinutes: (n) => _restAdvance(n),
    // TickRest :379 - QuestMachine.Instance.Tick() rides the same
    // sub-tick as the clock, UNPACED. This host holds the bridge as
    // opts.questBridge (world.js and worldModes hand theirs down); a
    // standalone ?dungeon page has none, and then there is nothing to
    // tick, which the optional chain says.
    tickQuests: () => opts.questBridge?.machine?.tick?.(),
    enemiesNearby: () => roomEncounterComing() || areEnemiesNearby(foes, { resting: true }),   // REST-SYNC: my ask's encounter is on its way
    // PARTY-REST5: forwarded straight from THIS host's own opts.onEnemyBreak (world.js's own hook, relayed
    // through worldModes.js exactly like opts.partyRestGate/opts.strangerRestGate already are) - see
    // world.js's outdoorRestDeps for what it's for.
    onEnemyBreak: () => opts.onEnemyBreak?.(),
    // PARTY-REST19: forwarded straight from THIS host's own opts.canceledByFollower, relayed the same way
    // opts.onEnemyBreak already is - see world.js's checkCanceledByFollower for what it's for.
    canceledByFollower: () => opts.canceledByFollower?.() ?? false,
    endLines: (id) => rscLines(id),
    say: (msg) => hudText.add(msg),
    onLevelUp: _onLevelUp,
    // PopToHUD before RaiseSkills (:728-732) - the fourth host's door,
    // which the first pass gave the other three and not this one. The
    // U24 identity guard: a window must not null a slot that has moved
    // on to something else (the death screen, above all).
    onClose: () => { if (activeOverlay?.isRestWindow) activeOverlay = null; },
    day: () => false, inside: () => true,
    restKind: () => (_fpFeet && camps.fireNear(_fpFeet) ? 'camp' : 'rough'),   // SURV4: a fire on the floor is the sleep; the bare floor is rough (AUDIT SURV-TIERS: the world's fire, in every tier)
  });
  // U4: the ONE player-damage door - every source (traps, melee,
  // arrows, spell missiles) lands here; death opens the overlay.
  function healPlayer(n) {
    if (n <= 0) return;
    playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n);
    surfacePlayer();
  }
  // AUDIT 21 (hosts lane, F6): this host's arm is now the PRESENTER on the one
  // shared damage door, not a second door of its own. It was the only one of
  // the four writers that checked for death, which is exactly why the other
  // three could go on writing health raw and nobody noticed.
  // AUDIT 39 (#35): the seam is BORROWED, not taken. playerEntity's
  // setter answers the previous holder for exactly this reason, and
  // destroy() hands it back - nothing above ground re-registers on the
  // way out, so a dungeon that kept the seam left every later death
  // above ground presenting into a torn-down context's overlay slot.
  const _prevDeathPresenter = setDeathPresenter(() => {
    opts.csaOnPlayerDeath?.();   // CSA-J (the audit): PlayerEntity.OnDeath -> ComeSailAway.OnPlayerDeath, underground too
    if (!(activeOverlay instanceof DeathScreen)) {
      // A1 review: this is the one FORCED overwrite of the overlay
      // slot - a window holding GL resources (the automap's batches
      // + micro-map texture) must release them or they leak per death.
      activeOverlay?.onPop?.();   // AUDIT-AMAP H9: the map saves its camera on the way out (DaggerfallAutomapWindow.cs:648-660)
      activeOverlay?.dispose?.();
      // DC1: the LIVE eye and capsule, as PlayerEntity_OnDeath reads
      // them. The motor lives in the scene host (dungeon.js, worldModes),
      // so it arrives through opts.motorState - the F222 pose seam's
      // shape, late-bound because the motor is built after this context.
      // A host that passes none falls to the constructor's standing
      // defaults, which is the crouched death's geometry lost.
      const _ms = opts.motorState?.() ?? null;
      activeOverlay = new DeathScreen({ eyeHeight: _ms?.eyeLevel, capsuleHeight: _ms?.capsule, onReset: () => { if (!opts.onlineRespawn?.()) endRunToTitleMenu(renderer); }, ...(opts.onlineRespawn ? {} : { online: false }) });   // AUDIT 28 B5: the standalone dungeon (no onlineRespawn) never respawns online - no loss shown   // D1; D-ONLINE1: online play respawns instead of ending the run (worldModes.js's opts.onlineRespawn, world.js's onlineRespawn)
    }
  });
  // F117: Stendarr's rank-in-fifty, consulted by the door before the
  // presenter. This is the ONE host with a submersion model, so the
  // breath tick's marker rides in - a drowning Stendarr priest is not
  // saved (Temple.AvoidDeath tests !IsPlayerSubmerged). AUDIT 39 (#35):
  // borrowed and handed back in destroy(), like the presenter above -
  // this hook closes over a submersion marker that dies with the
  // context, so above ground it must not be the one consulted.
  const _prevAvoidDeath = setAvoidDeathHook(() => {
    if (!avoidDeath(activeMemberships(playerEntity), { submerged: _submergedNow })) return false;
    hudText.add(AVOID_DEATH_TEXT);
    return true;
  });
  function hurtPlayer(dmg) {
    // ARENA2: in my bout on the arena's sand (world/arenaFloor.js - the host's word) the blow that would kill leaves me at
    // 1 and the bout hears I am down: playerEntity.hurtPlayer's `spare`, the duel's own floor
    hurtEntity(playerEntity, dmg, opts.playerSpare?.() ?? {});
  }
  // S13 magicka sink (parallel to heal/hurt): the SpellPoints damage
  // family drives it. DecreaseMagicka floors at 0; surfaces for the
  // HUD/F8 readout. (The S13 restoreMagicka door left with the S15
  // (10,9) parity fix - that classic key is HEAL FATIGUE; DFU's
  // Heal-SpellPoints is potion-only with no classic key, so no spell
  // reaches a magicka-restore sink until potions/absorption ship.)
  function drainMagicka(n) {
    if (n <= 0) return;
    playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n);
    surfacePlayer();
  }
  // S15 fatigue sinks: RAW fatigue points (the effect door applies the
  // x64). SetFatigue clamps 0..MaxFatigue (max derived LIVE - a
  // drained strength lowers the ceiling).
  // S20: SetFatigue's exhaustion event - hitting 0 with health left
  // raises OnExhausted (once; the popup guard mirrors DFU's
  // displayingExhaustedPopup so rapid drains - the Somnalius case -
  // never stack collapses).
  // AUDIT 68 S19-exhaustion-latch-stuck: the guard is the BOX, up while it stands in the slot or the stack and is not
  // done (DFU clears the flag in the popup's OnClose). A separate latch was lowered only by drawOverlay's empty-slot
  // arm, which no host calls, so every later exhaustion in the same dungeon ran at 0 fatigue with no collapse.
  let _exhaustedBox = null;
  const exhaustedShowing = () => !!_exhaustedBox && !_exhaustedBox.done
    && (activeOverlay === _exhaustedBox || dungeonWindows.containsWindow(_exhaustedBox));
  /** PlayerEntity.cs:396-400, through the ONE home in scenes/shared.js
   *  - AUDIT 26 F044 collapsed the copy that used to live here, whose
   *  comment said the port had no source for the Improved Athleticism
   *  enchantment. It has had one since E1 decoded ImprovesTalents. */
  const fatigueLossMultiplier = () => fatigueLossMultiplierFor(playerEntity);
  let _restFromBed = false;   // CSA-J (the audit): the rest press is a bed's - BedActivation's gate has no GiveOffer rung (RoleplayRealism.cs:487-525)
  function drainFatigue(n) {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    surfacePlayer();
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0 && !exhaustedShowing()) onExhausted();
  }
  /** PlayerEntity's OnExhausted handler: no enemies nearby (a foe
   *  actively seeing the player, or one inside the classic spawn
   *  band - the P13 senses fields) and dry feet = one rest hour (the
   *  clock advances 60 classic minutes, each pool recovers one
   *  hour's rate, Medical tallies); near enemies or swimming = the
   *  collapse KILLS. The text box is click-anywhere-to-close and
   *  holds the motor like every overlay. */
  function onExhausted() {
    // GameManager.AreEnemiesNearby() (PlayerEntity.cs:2397) - the
    // STRICT variant, through the ONE home the three hosts ask.
    const enemiesNearby = areEnemiesNearby(foes);
    const out = exhaustionOutcome({
      enemiesNearby, swimming: _activity.swimming, entity: playerEntity,
      day: false, inside: true,   // a dungeon rest: inside, no daylight (the InLight case pends exteriors with the rest UI)
    });
    // SWIM-SPENT (rest.js): in the dungeon's water a share of the health and a line - no box, no death heard
    if (out.kind === 'drown') { hudText.add(out.line); hurtEntity(playerEntity, out.damage, { bypassShield: true }); surfacePlayer(); return; }
    opts.csaOnPlayerDeath?.();   // CSA-J (the audit): PlayerEntity.OnExhausted -> ComeSailAway.OnPlayerDeath, underground too
    const lines = rscLines(out.textId);
    // AUDIT 68 S19-exhaustion-latch-stuck: a PUSH (ROAD-B B5) - DaggerfallUI.MessageBox never asks what else is open.
    if (lines) { _exhaustedBox = new ActionTextBox(lines); pushDungeonWindow(_exhaustedBox); }
    if (out.kind === 'rest') {
      advanceOwnMinutes(60);   // RaiseTime(1 hour) - the round loop catches up the magic rounds; TIME3: counted, as every raise is
      playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
      playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
      playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
      tallySkill(playerEntity, SKILLS.Medical);
      surfacePlayer();
    } else {
      // AUDIT-DEATH1 (2026-09-19, Mac: "sometimes get stuck at 0% health
      // and live"): THROUGH THE ONE DOOR, like the other three hosts.
      // This wrote `playerEntity.health = 0` raw, and raw is exactly what
      // the note ninety lines above warns about - "it was the only one of
      // the four writers that checked for death, which is why the other
      // three could go on writing health raw and nobody noticed". The
      // death presenter fires on the TRANSITION inside `hurtPlayer`
      // (characters/playerEntity.js), so a raw zero raises nothing: the
      // player sat at 0% health, alive, in the one host that owns the
      // DeathScreen. `bypassShield` is the SetHealth(0) door's own flag -
      // no shield stands between the player and a lethal collapse - and
      // it is what world.js, exterior.js and worldModes.js already pass.
      hurtEntity(playerEntity, playerEntity.health, { bypassShield: true });   // SetHealth(0): the fatal collapse
      surfacePlayer();
    }
  }
  function restoreFatigue(n) {
    if (n <= 0) return;
    playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + n);
    surfacePlayer();
  }
  const foeDrainMagicka = (ent) => (n) => { if (n > 0) ent.magicka = Math.max(0, (ent.magicka ?? 0) - n); };
  // The per-entity sink bundles the effect door consumes (S15 - one
  // definition; every applySpell/tick call site rides these).
  function restoreMagicka(n) {   // S19b: IncreaseMagicka (Aegrotat) - clamped at max
    if (n <= 0) return;
    playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + n);
    surfacePlayer();
  }
  const playerSinks = { hurt: hurtPlayer, heal: healPlayer, drainMagicka, drainFatigue, restoreFatigue, restoreMagicka, say: (l) => hudText.add(l) };   // S21: concealment start messages
  const foeSinks = (f, fromPlayer = true) => ({
    hurt: (n, o) => damageFoe(f, n, null, null, { kind: 'spell', fromPlayer: o?.fromPlayer ?? fromPlayer, whole: !!o?.whole }),   // WORLD2: the kind rides the hit; AUDIT WORLD2 B7: a foe's spell is not the player's blow; AUDIT 68 S19-round-ticks-player-provenance: a tick says whose it is (effects.js runEffectRound)
    heal: (n) => healFoe(f, n),   // AUDIT PSCALE1 DOORS-5: a heal on a shared foe is a heal of the bigger pool
    drainMagicka: foeDrainMagicka(f.entity),
    restoreMagicka: (n) => { if (n > 0) f.entity.magicka = Math.min(f.entity.maxMagicka ?? Infinity, (f.entity.magicka ?? 0) + n); },
    drainFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.max(0, (f.entity.fatigue ?? 0) - n); },
    restoreFatigue: (n) => { if (n > 0) f.entity.fatigue = Math.min(maxFatigue(f.entity), (f.entity.fatigue ?? 0) + n); },
  });
  // M3: THE ONE CAST ENGINE. dungeonContext's audited player-cast stack
  // moved to scenes/hostMagic.js (M1) and every host now consumes the
  // same implementation - this host's enemy missiles and arrows stay
  // below and reuse the engine's explodeAt/applySpellToPlayer. The
  // absorb context is the dungeon constant (inside, no daylight).
  //
  // FS1 - SHIPPED (wave D, THE FOUR HOSTS RULE): THE ENCHANT CTX IS
  // MOUNTED HERE NOW, below the engine it casts through.
  // setDefaultEnchantCtx (systems/enchantments.js:257) used to have
  // exactly ONE caller in the tree, scenes/world.js, so in the
  // standalone ?dungeon host every item-enchantment arm that needs a
  // host ran against no ctx at all: CastWhenUsed's CasterOnly assign
  // and its click-to-cast ready, the vampiric-drain and affinity
  // scans, and SoulBound's break release. Every one is
  // optional-chained, which is exactly the AUDIT 24 seam shape - a
  // ported law that evaporates in SILENCE with a green suite.
  //
  // The flag said the world host's mount was "~90 lines of live
  // plumbing and none of it is host-portable by copy". The plumbing
  // was real; "not portable" was not. Every host-specific term in it -
  // the pools, the sinks, the text channel, the two windows, the
  // spawn door - was already a closure over a host binding, which is
  // a PARAMETER everywhere else in this tree. So the body moved to
  // scenes/hostEnchant.js and both hosts hand in their own doors; a
  // copied mount would have diverged the first time an arm grew.
  /** DR1: THE TWO SPELL WINDOWS THIS HOST MOUNTS NOW, and the one door
   *  they go through. `mountSpellWindow` is worldModes'
   *  mountSpellWindow DUNGEON ARM (worldModes.js:1437,
   *  `dungeonCtx?.showOverlay(win)`) resolved to what it actually
   *  calls here - this file's own pushDungeonWindow, which IS
   *  UserInterfaceManager.PushWindow. So a spell window raised over an
   *  open automap or rest window lands ON TOP and uncovers it on
   *  close, rather than being refused or clobbering the slot.
   *
   *  There is no closeSpellWindow twin, for the same reason worldModes
   *  makes its dungeon arm a deliberate no-op (:857): both windows
   *  raise `done` from inside their own pick/cancel/close
   *  (ListPickerWindow._pick/_cancel, ui/listPicker.js:206/:215;
   *  NativeTradeWindow's close, ui/nativeTrade.js:684), and
   *  tickOverlay drains the slot and reconciles the stack. A second
   *  clear here would only race that drain. */
  const mountSpellWindow = (win) => pushDungeonWindow(win);

  /** DR1: IDENTIFY'S WINDOW, in the standalone `?dungeon` host.
   *  Identify.cs:71-76 refunds the cost, then pushes a
   *  DaggerfallTradeWindow in Identify mode with UsingIdentifySpell
   *  set and IdentifySpellCost = cost.spellPointCost - so the magicka
   *  the window charges on the Identify click IS the number the effect
   *  just gave back, which is what makes the round trip free when the
   *  player closes the window without identifying anything. That is
   *  worldModes.openIdentifyWindow's law (:6215-6226) and this is the
   *  same construction over THIS host's bindings.
   *
   *  The hook set is the one Identify mode actually reads, and the
   *  omissions are DFU's own mode gates, not port residue:
   *    shelfItems/otherItems/repairItems/nowMinutes/allowMagicRepairs/
   *    isBeingRepaired - Buy and Repair only (remoteList :256-259,
   *      _takeItemFromRepair :388, _clear :430)
   *    accepts/enchanted - localListAccepts' Sell and SellMagic arms
   *      (tradeModes.js:441-443); Identify returns true unfiltered
   *    weight - sellProceeds, on the Sell confirm alone (:490)
   *    priceCtx - read by tradeCost's PAID Identify arm (:263-265) and
   *      by _modeAction's ShowTradePopup ELSE (:456-466). Neither can
   *      run on this mount: `usingIdentifySpell` is true, so the cost
   *      walk takes DFU's "Identify spell remains free" line
   *      (:479-481) and _modeAction returns at :458 before it reads a
   *      price context. There is no merchant underground to sell the
   *      paid service anyway - that is DFU's shape too, not a gap.
   *    AUDIT 63 F48's steal hooks (pickpocketSkill, tallyPickpocket,
   *      tallyCrimeGuild, crimeTheft, spawnCityGuards, say) - DFU only
   *      ADDS the steal button in Buy mode (DaggerfallTradeWindow.cs
   *      :316-322) and DoSteal re-checks it (:909), so this mount can
   *      never reach them. There is no shop to rob underground. */
  function openIdentifySpellWindow({ chance, cost }) {
    return createTradeWindow({
      mode: 'Identify',
      usingIdentifySpell: true,
      // D7: the LIVE collection (:389 `localItems = PlayerEntity.Items`),
      // spliceable, because a click TRANSFERS out of it.
      packItems: () => (playerEntity.items ??= []),
      isEquipped: (it) => isEquipped(it),
      // AUDIT 58: goldLabel is GetGoldAmount
      // (DaggerfallTradeWindow.cs:488) on EVERY mount of this window,
      // the dungeon's Identify included - coins plus letters of credit
      // (PlayerEntity.cs:1313-1316). Label-only here, since the spell
      // arm returns before ShowTradePopup's gold gate (:1116), but the
      // strip is the same strip and reads the same quantity.
      gold: () => totalGoldAmount(playerEntity),
      rows: (id, pick) => textRsc?.variantLinesById(id, pick ?? Math.random) ?? [],
      cityName: () => '',        // a dungeon has no city name to quote back
      shopName: '',              // ...and no shop; Identify.cs pushes no building
      icons: { getTexture, uploadRecord, textures: renderer.textures },
      entity: playerEntity,
      // The same bridge read openInventory takes: QuestMachine.GetQuest
      // for TransferItem's quest gate (DaggerfallInventoryWindow.cs:1489)
      // and ResolveItemLongName's letter arm. The standalone page mounts
      // no bridge and answers null - DFU's own fall-through.
      getQuest: (uid) => opts.questBridge?.machine?.getQuest?.(uid) ?? null,
      // DoModeAction's SPELL arm (DaggerfallTradeWindow.cs:954-995),
      // the same body worldModes.commitTrade runs (:1527-1556). The
      // magicka refusal turns back the WHOLE pass and answers FALSE,
      // which leaves the lot staged for a caster who steps away and
      // comes back with the points (F144); the pass spends the points
      // ONCE for the whole list whatever the rolls say; and there is
      // no Mercantile tally, because the spell never reaches
      // ConfirmTrade.
      commit: (_mode, staged) => {
        if (cost > (playerEntity.magicka ?? 0)) {
          hudText.add(NOT_ENOUGH_SPELL_POINTS_TEXT);
          surfacePlayer();
          return false;
        }
        const pass = identifySpellPass(staged, chance, Math.random);
        for (const it of pass.identified) it.isIdentified = true;
        if (pass.spendMagicka) {
          playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - cost);
        }
        hudText.add(identifiedTallyText(pass.successCount, pass.total));
        surfacePlayer();
        return true;
      },
    });
  }

  /** DR1: DISPEL MAGIC'S BUNDLE PICKER, the same window
   *  worldModes.openDispelPicker (:6129-6152) builds - DFU pushes a
   *  DaggerfallListPickerWindow over the player's live bundles by
   *  name, picking one removes it and cancelling wastes the cast (no
   *  refund, unlike Identify). The one asymmetry is DFU's: the
   *  player's OWN casts always come off, and only something cast AT
   *  them gets the roll. */
  function openDispelPicker({ chance }) {
    if (!listPickerArtLoaded()) return false;
    const bundles = dispellableBundles(liveBundles(playerEntity));
    if (!bundles.length) { hudText.add('You have no magic to dispel.'); return true; }
    return mountSpellWindow(new ListPickerWindow({
      items: bundles.map((b) => b.name || '(unnamed)'),
      onPick: (i) => {
        const b = bundles[i];
        if (!b) return;
        const r = dispelBundle(playerEntity, b.bundleId, {
          selfCast: b.bundleType === 'Spell' && (b.selfCast !== false || b.ally === true),   // AUDIT ALLY-CAST C4: a mate's gift comes off at will
          roll01: Math.random(), chance,
        });
        if (r.alert) hudText.add(DISPEL_MAGIC_TEXT[r.alert]);
      },
      onCancel: () => {},   // the cast is spent; the drain closes the slot
    }));
  }

  const magic = createPlayerMagic({
    // AID1 onto ALLY-CAST: the party mates in this dungeon as bodies a beneficial touch, missile or blast may meet (the
    // outer host's list, in this dungeon's frame) - they leave through castAtAlly below; the standalone ?dungeon probe
    // passes none
    allyMarks: opts.allyMarks ? (sp) => opts.allyMarks(sp) : null,   // SPELL-GIFT: the spell rides, for the strangers its list may reach
    peerBodies: opts.peers ? () => opts.peers() : null,   // SPELLFX1: every player's body, where a peer's drawn missile stops
    companionBodies: opts.companionBodies ? () => opts.companionBodies() : null,   // COMPANION-KIT: my companions here (the dungeon's own records)
    // QG1: the ready-spell doors - this host's own cast engine raises
    // into the same machine the world lane's does (opts.questBridge is
    // handed down by world.js/worldModes; the standalone ?dungeon
    // probe has none and the chain no-ops).
    onNewReadySpell: (sp) => opts.questBridge?.machine?.notifyNewReadySpell?.(sp),
    onCastReadySpell: (sp) => opts.questBridge?.machine?.notifyCastReadySpell?.(sp),
    // MW-D39: THE SPELL GOES, AND SO DOES THE ARM.
    // ROAD-E6: and it goes FIRST. This is CastReadySpell's PlayOneShot
    // (:430-435) - the hands start as the magicka is spent, and the
    // engine parks the spell's resolution on the animation's release
    // frame five steps (0.2s) later. An animation, never a gate: a rig
    // that refuses (no CIF for the element) answers false and the
    // engine releases on the spot.
    startCastAnim: (sp, onRelease) => weaponRig.castSpellAnim(sp?.rangeType, sp?.element, onRelease),
    // AUDIT ALLY-CAST A3: the party mate under the crosshair and the door the cast leaves through - the OUTER host's
    // (world.js through worldModes' opts, the peerHoverPick's own road); the standalone ?dungeon probe passes none
    allyTarget: (eye, dir, reach, sp) => opts.allyTarget?.(eye, dir, reach, sp) ?? null,   // SPELL-GIFT: with the spell
    castAtAlly: (id, frame) => !!opts.castAtAlly?.(id, frame),
    fallenTarget: (eye, dir, reach) => opts.fallenTarget?.(eye, dir, reach) ?? null,   // RESURRECT1: the fallen bodies and the call's door, beside the ally pair
    raiseFallen: (f) => !!opts.raiseFallen?.(f),
    // WB4b: the Burning Court's boss as a body my harmful spells meet (his own radius), and the door a spell that met him
    // leaves through - computed here against his stand-in and sent (spellOnBoss); outside the court, nobody
    bossMark: opts.gateBoss ? () => { const b = gateBossBody(); return b ? { feet: b.ai.feet, height: b.ai.height, radius: b.ai.radius } : null; } : null,
    castAtBoss: opts.gateBoss ? (sp) => spellOnBoss(sp) : null,
    // WB9c: the Reckoning's crystals as marks a harmful spell meets (a touch, a missile, a blast) - each by its number
    crystalMarks: opts.gateCrystals ? () => gateCrystalBodies().map((q) => ({ c: q.crystal, feet: q.ai.feet, height: q.ai.height, radius: q.ai.radius })) : null,
    castAtCrystal: opts.gateCrystals ? (sp, c) => spellOnCrystal(sp, c) : null,
    // WB11c: the Legion-Lord's host as marks a harmful spell meets - each by its number and name
    hostMarks: opts.gateHost ? () => gateHostBodies().map((q) => ({ i: q.host, name: q.entity?.name ?? '', feet: q.ai.feet, height: q.ai.height, radius: q.ai.radius })) : null,
    castAtHost: opts.gateHost ? (sp, i) => spellOnHost(sp, i) : null,
    // ARENA4b: MY OPPONENT ON A RELAY'S SAND as the one body my harmful spells reach (the duel's own seam, hostMagic.js
    // duelMarksFor - a touch, a missile or a blast that meets them), and the door such a spell leaves through
    // (spellOnRival: the number to the referee as a spell, as a swing's goes); none outside a bout between players
    duelMark: opts.arenaRival ? () => { const rb = arenaRivalBody(); return rb ? { id: rb.rival, name: rb.entity?.name ?? '', feet: rb.ai.feet, height: rb.ai.height } : null; } : null,
    castAtDuel: opts.arenaRival ? (_id, sp) => spellOnRival(sp) : null,
    // A10: THE RECALL ARRIVAL, ROUTED. This used to be a stand-in line
    // saying the anchor machinery lived in the streaming host - true of
    // the machinery, false as a refusal: this context is the one the
    // STREAMING host mounts for dungeon mode too, so the line meant a
    // Recall cast underground did nothing at all, anchor or teleport.
    // The prompt is the outer host's (it owns the pixel teleport, the
    // mode teardown and the dungeon mount the plan needs); the
    // standalone ?dungeon probe passes none and keeps the honest
    // refusal, which is the AUDIT 24 seam shape done deliberately.
    //
    // hudText.add, not `say?.()`. There is no `say` in this scope — the
    // optional-call syntax made an undefined identifier look like a
    // guarded one, so it read as safe and was a ReferenceError waiting
    // for the first Recall cast in a standalone dungeon. Every other
    // line in this file speaks through hudText, including the one four
    // below it.
    onTeleport: () => {
      if (opts.onTeleport) { opts.onTeleport(); return; }
      hudText.add('(Recall pends in the standalone dungeon - the anchor machinery lives in the streaming ?world host)');
    },
    // X9: the creature dispel. This host is where undead and daedra
    // actually live, so it is the one that matters. removeFoe IS
    // GameObject.Destroy - no corpse, no loot, no death - and
    // dispelNearby carries the roll and DFU's warning that this can
    // break quests, which is why the quest resource is uncoupled by
    // the same call.
    // X11b: THE CREATE ITEM PICKER, in the host whose overlay stack the
    // effect probes drive. DFU's picker cannot be cancelled and reopens
    // on the row taken last time; both live in the window.
    onCreateItem: ({ rounds }) => {
      if (!listPickerArtLoaded() || activeOverlay) { hudText.add('You cannot concentrate on that right now.'); return; }
      activeOverlay = new ListPickerWindow({
        items: createItemLabels(),
        allowCancel: false,                    // CreateItem.cs:70
        selectedIndex: lastCreateItemIndex(),   // the static (:29)
        onPick: (i) => {
          setLastCreateItemIndex(i);
          const made = grantCreatedItem(playerEntity, i, {
            gender: playerEntity.gender ?? 'male',
            nowMinutes: Math.floor(classicMinutesRef.value),
            rounds: rounds ?? 0,
          });
          if (made) hudText.add(`${made.name}${made.stackCount > 1 ? ` (${made.stackCount})` : ''} conjured.`);
          activeOverlay = null;
        },
        onCancel: () => { activeOverlay = null; },
      });
    },
    onDispel: ({ group, chance }) => {
      const list = getNearbyObjects(detectFeed.scanNow(), group) ?? [];
      const gone = dispelNearby(list.map((no) => no.ref), () => Math.floor(Math.random() * 100) < chance);
      for (const f of gone) questPoolOps.removeFoe(f);
      if (gone.length) hudText.add(`${gone.length} dispelled.`);
    },
    // DR1: THE TWO WINDOW SEAMS, MOUNTED. PR1 made them refuse out
    // loud in what it called "the onTeleport INTERIM shape", which was
    // the right answer to the SILENCE it found (absent, both
    // optional-chained past the engine's dispatch: Identify refunded
    // its cost and said NOTHING, Dispel Magic spent the cast on
    // nothing and said NOTHING). But the refusal's REASON - "the
    // window lives on the worldModes host" - was true of where the
    // window was BUILT, not of what this host can mount. Both windows
    // are `isChoiceWindow` natives over host-agnostic art, and this
    // context already owns every seam one
    // needs: pushDungeonWindow to raise it, tickOverlay to tick and
    // drain it, overlayClick / overlayPointer / overlayHover /
    // overlayWheel / overlayKeyUp to drive it, and drawOverlay's
    // native arm to paint it. The art is warmed at boot beside
    // PICK00I0. So they open here, and complete here.
    //
    // Both go through mountSpellWindow, which is worldModes'
    // mountSpellWindow dungeon arm - the same door, one host down.
    // The refusal that remains is the ART one, the X11b idiom: no
    // INVE00I0/SHOP00I0 (or no PICK00I0) means no window, and a seam
    // that cannot mount says so rather than swallowing the cast.
    onIdentify: ({ chance, refund } = {}) => {
      const w = tradeDoorReady() ? openIdentifySpellWindow({ chance: chance ?? 0, cost: refund ?? 0 }) : undefined;
      // DISC10-E L3: a transformed lycanthrope's counter is refused AT the
      // trade door, which says so and answers null - nothing to mount and
      // nothing more to say
      if (w === null) return;
      if (!tradeDoorReady() || !mountSpellWindow(w)) {
        hudText.add('You cannot concentrate on that right now.');
      }
    },
    onDispelMagic: ({ chance } = {}) => {
      if (!openDispelPicker({ chance })) hudText.add('You cannot concentrate on that right now.');
    },
    renderer, audio, getTexture, uploadRecord, uploadRecordFrame,
    now: () => classicMinutesRef.value,   // V2a: MorphSelf's once-a-day clock
    collider,
    playerEntity, playerSinks,
    say: (l) => hudText.add(l),
    surfacePlayer,
    foes: () => foes,
    foeSinks,
    absorbCtx: () => ({ inside: true, day: false }),
  });
  /** V3: the Wabbajack's transform over this host's own pool. The
   *  old foe leaves through questPoolOps.removeFoe (which is
   *  GameObject.Destroy - no corpse, no loot, no death, and it
   *  notifies the quest resource) and the new type stands at its
   *  feet with the damage taken carried over. A quest foe still in
   *  use is left alone - QuestResourceBehaviour's own check.
   *
   *  AUDIT 58 (review): lifted out of the ctx literal below and put
   *  on the api, because that literal is mounted ONLY on the
   *  standalone route (`opts.enchantCtx !== false`) while the hosted
   *  route leaves world.js's mount as the session singleton - so a
   *  dungeon record reaching that mount's replaceFoe had nowhere but
   *  the street pool to go. One body, both routes. */
  function replaceFoeInPool(targetEntity, mobileType) {
    const f = foes.find((x) => !x.dead && x.entity === targetEntity);
    if (!f) return;
    if ((!_authority && isRoomFoe(f)) || f._ownFrom != null) return;   // SUMMON-SYNC: a puppet is its runner's, not mine to re-stand (AUDIT WORLD6b B9, the cell's law) - its change would ride the room beside the runner's foe
    if (f.questBehaviour && !f.questBehaviour.isFoeDead) return;
    const at = f.ai?.feet ? centreFromFeet(f.ai.feet, f.idleH ?? f.ai.height) : (lastPlayerFeet ?? [0, 0, 0]);   // REVIEW 2026-09-05: WabbajackEffect.cs:90 hands CreateEnemy the struck foe's TRANSFORM (its sprite centre), which the spawn chain reads as a marker
    const missing = (targetEntity.maxHealth ?? 0) - (targetEntity.health ?? 0);
    questPoolOps.removeFoe(f);
    // AUDIT OH-F C7: GameObjectHelper.CreateEnemy (WabbajackEffect.cs:90) sets no LoadID - it stays 0 (the spawn counter
    // is SetupDemoEnemy's NextUID arm, which this door never takes)
    Promise.resolve(spawnLooseFoe(mobileType, at, { loadID: 0 })).then((nf) => {
      if (!nf?.entity) return;
      nf.entity.wabbajackActive = true;   // once per creature (WabbajackEffect:68)
      nf.entity.health -= missing;        // carry over damage (:94)
      renownFoeCarry(f, nf);              // AUDIT RENOWN1 GAME-10: the Wabbajack's change is the same fight - my blows on it count
    }).catch(() => {});
  }
  // FS1 (wave D): the mount itself. `enchantCtx: false` is the
  // `chargen: false` shape exactly - AN OUTER HOST ALREADY OWNS IT.
  // setDefaultEnchantCtx is a session singleton, and EC1 already made
  // world.js's mount read THIS context's foes and sinks through
  // modes.dungeonCtx whenever the live mode is dungeon; a second
  // unconditional mount here would simply overwrite that one at the
  // moment worldModes builds the dungeon, and the last writer would
  // win silently. So the standalone ?dungeon route mounts and the
  // hosted route does not.
  if (opts.enchantCtx !== false) {
    setDefaultEnchantCtx(createEnchantCtx({
      playerEntity,
      spellsByIndex: () => spellsByIndex,
      now: () => Math.floor(classicMinutesRef.value),
      sinks: {
        hurt: (n) => { if (n > 0) hurtPlayer(n); },
        heal: (n) => { if (n > 0) healPlayer(n); },
      },
      playerSpellSinks: playerSinks,
      say: (l) => hudText.add(l),
      magic,
      foes: () => foes,
      foeSinks,
      feet: () => lastPlayerFeet ?? [0, 0, 0],
      bossSpell: opts.gateBoss ? (record, target) => { spellOnStandIn(record, target); } : null,   // AUDIT WBX F2: a Cast When Strikes spell on the court's boss, by his own spell door (AUDIT WB11 W1: or the host body or crystal its stand-in names)
      spellToOwner: (f, record, level) => spellToOwner(f, record, level),   // STRIKE-SHARED: a strike on a foe another player runs, to that player
      // SD1's placement, over THIS host's collider and pool - the same
      // body world.js stands its loose foes through.
      standLooseFoe: (mobileType, o = {}) => standLooseFoe({
        collider,
        feet: lastPlayerFeet,
        yawRad: _motorYaw,
        fovDegrees: fieldOfView() * 180 / Math.PI,   // fieldOfView() answers RADIANS
        foes,
        spawn: (mt, pos, so) => spawnLooseFoe(mt, pos, { yawRad: so.yawRad, allied: so.allied }),
      }, mobileType, o),
      // V3: Azura's TEXT.RSC popup goes through this host's WINDOW
      // STACK (PushWindow), not its one overlay slot - the same door
      // the action plaques take, so a box raised under an open window
      // is not swallowed.
      // ENH-NOTICE3: named as a KIND now. No routing change while this
      // context stands (its presenter is priority 20 and its mount is
      // pushDungeonWindow, the door this line called by hand), and the
      // push is the seam's default because DaggerfallUI.MessageBox is
      // PushWindow (DaggerfallUI.cs:1346-1353, UserInterfaceManager
      // .cs:79-91). The rows are this host's own rscLines, untouched.
      messageBox: (id) => {
        const lines = rscLines(id);
        if (lines?.length) messageBox(lines);
      },
      // AUDIT 44 (a11)/U43: `api.toggleCharSheet` is this host's ONE
      // sheet construction, free-slot guard included - the Oghma opens
      // that, never a second bag built here.
      openCharacterSheet: () => api.toggleCharSheet(),
      replaceFoe: replaceFoeInPool,
    }));
  }
  // AUDIT 24: `chargen: false` says an OUTER host already owns the
  // wizard - worldModes passes it, the standalone dungeon scene does
  // not. Without it the classic start ran two wizards at once.
  if (!playerEntity.chargenDone && opts.chargen !== false) {
    if (Number.isInteger(opts.playerClass)) {
      // AUDIT 17f: the shared headless skip. This copy minted a
      // character with an EMPTY bag - no clothes, no weapon, no gold -
      // because S3d landed the kit on the flow and the font-less
      // fallback and missed this third path.
      await applyHeadlessChargen(playerEntity, opts.playerClass, { fetchBytes, spellsByIndex });
    } else {
      // U2b: the real flow - all 18 careers load; the host routes
      // input and draws the overlay until done, then applies the
      // HAND-distributed result. The Warrior-16 default is GONE.
      // S3c/U9 / ONE DFU MEMBER, ONE EXPORT: the career load lived
      // here AND (once the exterior hosts gained chargen) would have
      // been copied there. Both use systems/chargenSession.js.
      // U10 / THE FOUR HOSTS RULE: the classic screens warm here too -
      // the dungeon host runs the same flow, and an unwarmed art set
      // would silently leave it on the interim text panels.
      await preloadChargenArt({ renderer, fetchBytes, palette });
      // AUDIT 17i: this host no longer CONSTRUCTS a flow. It built its
      // own by hand while the exterior hosts went through the shared
      // session, and so structurally missed every dependency the flow
      // grew - the starting spellbook (17f), the starting kit (17f)
      // and the biography (17h). One seam mints it for everyone.
      chargenFlow = (await createChargenFlow(fetchBytes)).flow;
      // systems/chargenSession.js FS-slice - SHIPPED (wave D). This
      // host held the RAW flow as its own overlay and drew it
      // directly, so it could not reach the skin fork that lives in
      // createChargenWindow (chargenSession.js:368) - THE ONE
      // CONSTRUCTION SEAM AUDIT 17i split out precisely so no host
      // would wire chargen by hand a fourth time. It is through that
      // door now, which is also where the fire-once law, the shared
      // overlayAction key table and the native click seam live.
      chargenWindow = createChargenWindow(chargenFlow, {
        // ui-chargen-4: backing out of the race screen cancels the
        // wizard - DFU unwinds the UI stack to the start screen
        // (RaceSelectWindow_OnClose :299-302). The port's front door
        // is the boot flow, so the unwind is a reload: the bare URL
        // lands back on title -> main menu; a dev-scene URL re-offers
        // the wizard fresh (SetRaceSelectWindow Resets on re-entry).
        // The window fires this from its own input/click arms, which
        // is why tickOverlay no longer polls `flow.cancelled`.
        // AUDIT-MACL F3: ...and the guard stands down first, because
        // this is a door the GAME opened - the same law `exitToTitleMenu`
        // follows. A player who presses Cancel has asked to leave.
        onCancel: () => { releaseUnloadGuard(); location.reload(); },
        onDone: (r) => finishChargenHere(r),
      });
      activeOverlay = chargenWindow;
    }
  }


  // U1: the classic HUD (vitals bottom-left, compass bottom-right) -
  // surfaces the Systems stats every frame; art-gated like all data.
  /** AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: the completion the KEY
   *  seam and the U14 POINTER seam share. It was already the second
   *  copy of finishChargen once; it is not going to become a third. */
  function finishChargenHere(result = chargenFlow?.result()) {
    finishChargen(playerEntity, result, spellsByIndex);
    chargenFlow = null;
    chargenWindow = null;
  }

  function chargenInputFallback() {
    // no font art: the flow cannot render - fall back to the headless
    // roll (loud) so the game remains playable without ARENA2 UI art.
    console.warn('[chargen] FONT art unavailable; falling back to the headless roll');
    // U20a follow-up / THE ONE SEAM: this path had hand-rolled its
    // own apply code, so every field the flow grew had to be
    // remembered here too - 17f caught it for the spellbook, and it
    // had ALREADY regrown for U20a's isCustom and custom
    // reputations. The career and the class index are the fallback's
    // own (the roll is headless), everything else rides the shared
    // applyCreationExtras that finishChargen uses.
    const r = {
      career: chargenFlow.career, careerIndex: chargenFlow.classIndex,
      isCustom: chargenFlow.isCustom, customReps: chargenFlow.customReps,
    };
    createCharacter(playerEntity, r.career, r.careerIndex);
    applyCreationExtras(playerEntity, r, spellsByIndex);
    // ORL1: THE THIRD APPLY PATH, and the one the one-seam note above
    // is a warning about - it does not reach finishChargen, so it does
    // not reach the leveling anchor's twin either. A character made
    // here was never ASKED the question (there is no font to draw it
    // with), so the answer is the port's own law, set explicitly rather
    // than left undefined: `usesVirtueLeveling` would read an absent
    // field the same way, but a creation path that mints a complete
    // entity everywhere else should not leave two fields blank here.
    initVirtueLeveling(playerEntity, LEVELING_CLASSIC);
    surfacePlayer();
    chargenFlow = null;
    chargenWindow = null;
  }
  const hudArt = await loadHud({ fetchBytes, ImgFile, palette, renderer });
  let hudFont = null;
  try {
    hudFont = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003');
  } catch { console.warn('[hud] FONT0003.FNT unavailable; HUD text disabled'); }
  function fireCast(index, origin) {
    const spell = spellsByIndex?.get(index);
    if (!spell || !origin) { if (!spellsByIndex) console.warn('[spellcast] SPELLS.STD unavailable; CastSpell no-op'); return; }
    // L2-slice (AUDIT 23 magic-8) - DaggerfallAction.CastSpell
    // (:497-518): a CasterOnly trap spell is READIED ON THE PLAYER
    // FOR FREE (SetReadySpell(index, true)) - no missile at all.
    if (spell.rangeType === 0) { magic.readySpell(spell, { free: true }); return; }
    // L2-slice (magic-9): a trap AreaAroundCaster payload rides a
    // missile with NO caster, and the missile's AoC arm requires one
    // (DaggerfallMissile.cs:279-282) - the classic no-op, loudly.
    if (spell.rangeType === 3) { console.warn('[spellcast] trap AreaAroundCaster has no caster; verbatim no-op'); return; }
    const from = [origin[0], origin[1] + 40 * GLOBAL_SCALE, origin[2]];
    // Audit 2026-08-16e F2: trap bundles are CASTERLESS - DFU's
    // CalculateCasterLevel(null) = 1 for magnitude, duration AND
    // chance (the pre-audit shape fell back to the player's level).
    // L2-slice (magic-8): a ByTouch trap payload RETARGETS to
    // SingleTargetAtRange (:512-517) - the touch flies to its mark.
    const payload = spell.rangeType === 1 ? { ...spell, rangeType: 2 } : spell;
    missiles.push({ spell: payload, casterLevel: 1, pos: from, dir: null, age: 0, batch: null });
  }

  // S5: player casting - ?spell=N readies a SPELLS.STD entry for the
  // probes (castProbe passes it explicitly); otherwise NOTHING is
  // readied until the spellbook does it (toggleSpellbook's ready()).
  // The old fallthrough that readied the first ranged damage spell in
  // the file - Wizard's Fire, index 7 - for EVERY character was an S5
  // debug leftover: DFU's SetReadySpell fires only from explicit
  // selection, never automatically. The cost comes from
  // calculateCastCost's per-effect tables, and rangeTypes 0/1/3 are
  // handled beside 2/4 below.
  if (spellsByIndex && Number.isInteger(opts.playerSpell)) {
    magic.setReadiedByIndex(opts.playerSpell, spellsByIndex);
  }
  // Combat bows (via S5 missiles): arrows are missiles carrying a
  // WEAPON instead of a spell - element None, model 99800 oriented
  // along flight (DFU ShootBow / WeaponManager verbatim shape). On a
  // landed enemy arrow, ONE recoverable Arrow joins the TARGET'S
  // items (BowDamage's classic charm). Crouch pass-over pends.
  function fireArrow(from, dir, weapon, fromPlayer, shooterFoe = null, aimFoe = null, muzzle = null) {   // FIELD-GUN17: muzzle - a camera-space barrel offset from the host, or null for the bow-hand arm   // ROAD-H tail: aimFoe - BowDamage's non-player arm (EnemyAttack.cs:141-143), the foe this shaft was loosed AT
    // FIELD-GUN14 (Mac: "The projectile that shoots out should be an
    // orb, not an arrow"). The FOURTH HOST's own copy of the fork
    // combat/arrowFlight.js takes - and here it is one field, because
    // this missile system already draws BOTH kinds: a shaft is the
    // 99800 mesh, a spell is a billboard riding its batch's origin.
    // `flatArchive` says "this arrow is drawn the second way", and
    // everything else about it - the physics, the contact, the
    // player-arrow impact arm, the recovery - stays the arrow's.
    // FIELD-GUN17 (Mac: "the orb doesnt allign with the barrel when
    // firing. Its above the barrel"). The FOURTH HOST's own copy of
    // the origin fork combat/arrowFlight.js takes: a supplied muzzle
    // wins, nothing supplied keeps GetAimPosition's verbatim arm.
    const pos = fromPlayer
      ? playerShotOrigin(from, dir, muzzle)   // AUDIT FIELD-GUN-MW F2: the one fork, so a world muzzle lands here too
      : [...from];
    missiles.push({ arrow: true, flatArchive: orbArchiveFor(weapon), weapon, fromPlayer, shooterFoe, aimFoe, pos, dir: [...dir], age: 0, batch: null, draw: null });   // ROAD-H H1c: a PLAYER shaft leaves the BOW HAND - GetAimPosition (DaggerfallMissile.cs:540-550) offsets the camera position 0.11 DOWN the camera's own up and 0.15 to the hand (the other way under FPSWeapon.FlipHorizontal), and it runs INSIDE the missile in DFU (:471), so it runs here rather than at each host's loose; an ENEMY shaft arrives with its own origin already applied (enemyTargets.enemyArrowOrigin)
  }
  // S16: the enemy cast - "enemies always cast ready spell instantly
  // once queued" (EntityEffectManager.Update): spend the S10 cost
  // (DecreaseMagicka floors at 0 - DFU casts even when the cost
  // exceeds the pool; selection only gates magicka > 0), play the
  // element cast sound from the caster (EnemyCastReadySpell), then
  // CasterOnly assigns to SELF and everything else looses a missile
  // that aims at the player mid-capsule at fire time (the shared
  // trap-missile shape). RESIDUAL (honest): enemy missiles resolve
  // against the player only - foe-vs-foe friendly fire pends the
  // missile seam's target sweep.
  // X3-slice: the cast EXECUTOR is the shared castEnemySpellShared
  // (characters/enemyCasting.js) - one release for both foe pools;
  // this host binds its deps once. The magic-15 silence gate, the
  // player-priced cost, the magic-9 AoC arm and the missile shape
  // all live in the shared member now.
  function castEnemySpell(f, spell, noSpellPointCost = false) {
    if (!foeDeps?.castEnemySpell) return;   // the foe subsystem degraded (its loud boot warning already fired)
    // AUDIT WORLD6b-iii(a) C2: MY capsule in the blast's sphere whoever the target is - `playerFeet` is the sphere's probe
    // for the LOCAL player, and WORLD3 handed it a PEER's feet, so a blast beside the peer landed on ME wherever I stood;
    // the missile at a peer aims itself in flight (the aimFoe arm below), no aim point is handed here
    foeDeps.castEnemySpell(f, spell, {
      noSpellPointCost, playerEntity, playerFeet: lastPlayerFeet, playerHeight: lastPlayerHeight,   // ROAD-H H2: the AreaAroundCaster blast is an OverlapSphere against the player's CAPSULE
      applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
      // AUDIT 58: play3dId - SPELL_CAST_SOUND is ID space (EntityEffectManager.cs:44-48)
      playCastSound: (element, from) => audio.play3dId(SPELL_CAST_SOUND[element] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }),
      explodeAt: magic.explodeAt,
      hitEffects,   // AUDIT 24 (wave 44): ShowMagicSparkles on the caster
      fireMissile: (from, spell2, casterLevel, foe) =>
        missiles.push({ spell: spell2, casterLevel, casterFoe: foe, pos: from, dir: null, age: 0, batch: null, fromPlayer: false }),
    });
  }
  async function ensureArrowModel(m) {
    if (m.draw !== null) return;
    m.draw = false;
    const gpu = await getGpuMesh(99800);
    // THE CRASH FROM THE FIELD (2026-08-21). This used to push
    // `{ gpu, object: { matrix: null } }` and leave the matrix for the
    // NEXT updateMissiles pass to fill. But the push lands in a
    // MICROTASK - this is async and its one caller does not await it -
    // and both hosts draw dynamicDraws BEFORE they call drawFoes
    // (dungeon.js:1126 against :1156; worldModes.js:8366 against :8386).   // QS6: both pairs' SECOND half was stale before this slice - they named neither `drawFoes` call, and a positional bump would have moved a wrong number by the right offset; re-resolved by content
    // So the very next frame drew the arrow with a NULL matrix, and
    // `uniformMatrix4fv(uModel, false, null)` throws - Float32List is
    // a non-nullable WebIDL union. Firing a bow killed the frame loop,
    // one frame later, with a stack of drawMesh and its caller and
    // nothing else. The matrix is built HERE, so an entry in the list
    // is always drawable.
    //
    // The dead check is the other half: a point-blank hit retires the
    // arrow while this await is still pending, and retireMissile's
    // splice has already run and found nothing - so the microtask
    // would push an ORPHAN that updateMissiles skips for ever
    // (`if (m.dead) continue`), leaving a null-matrix entry that threw
    // on EVERY frame rather than one. Its sibling in arrowFlight.js
    // has had this check all along.
    if (!gpu || m.dead) return;
    m.draw = { gpu, object: { matrix: arrowMatrix(m) } };
    dynamicDraws.push(m.draw);
  }
  function arrowMatrix(m) {
    const yaw = Math.atan2(m.dir[0], m.dir[2]) * 180 / Math.PI;
    const pitch = Math.asin(-Math.max(-1, Math.min(1, m.dir[1]))) * 180 / Math.PI;
    return trs(m.pos[0], m.pos[1], m.pos[2], pitch, yaw, 0);
  }
  // M3: applySpellToPlayer / explodeAt / tallyCastSkills / the four
  // cast arms live in the ONE engine (scenes/hostMagic.js); the enemy
  // half below calls magic.explodeAt / magic.applySpellToPlayer.
  // S2: treasure piles - random markers (199.19) roll an icon +
  // generate by the dungeon-type key; fixed 216 flats keep their
  // record. Per-pile single batches so pickup can remove one pile.
  const lootPiles = [];
  const lootKey = DUNGEON_LOOT_KEYS[dfLocation.mapTableData.dungeonType] ?? '-';
  /** WORLD8: ONE HOME for a treasure pile's roll - the build's and the hour's respawn's (LootTables.cs:229/:237 on the
   *  PLAYER's level and gender, the pile trio, the rarity roll at the dungeon's tier). */
  function rollPileItems() {
    const elite = !!dfLocation?.elite;   // ELITE: the piles get the same +20% drops and +20% quality as the foes
    const items = generateLootItems(lootKey, { level: effectiveLevel(playerEntity), gender: playerEntity.gender }, undefined, elite ? { itemChanceScale: ELITE_LOOT_DROP_MULT } : {});
    addPileLootExtras(items, lootKey, Math.random, { locationIndex: dfLocation.mapTableData.dungeonType, luck: liveStat(playerEntity, 'luck'), level: effectiveLevel(playerEntity), where: 'dungeon' });   // FORAGE3: OnLootSpawned at the dungeon type's index; REALM P0.4: online, the level's gold divided back; AUDIT OH-F B3: the dungeon's own
    rollLootRarity(items, { ...pileSource(dungeonRarityTier(dfLocation.mapTableData.dungeonType)), qualityMult: elite ? ELITE_LOOT_QUALITY_MULT : 1, family: dungeonFamily(dfLocation.mapTableData.dungeonType) }, { luck: liveStat(playerEntity, 'luck') });
    stampWonWeapons(items, 1);   // SIGIL1: a pile found online, its weapons' sigils rolled at the mint
    return items;
  }
  {
    for (const b of dungeon.blocks) {   // the PLACED blocks (layout + origins) - NOT the BlocksFile reader parameter (the S2 black-screen bug: 't is not iterable' at boot with real data)
      for (const m of b.layout.markers) {
        const isRandom = !m.archive && m.record === RANDOM_TREASURE_MARKER_RECORD;
        const isFixed = m.archive === RANDOM_TREASURE_ARCHIVE;
        if (!isRandom && !isFixed) continue;
        const record = isFixed ? m.record : RANDOM_TREASURE_ICONS[Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length)];
        // AUDIT 23 (items-1): LootTables.cs:229/:237 pass the PLAYER's gender; AUDIT 24 (wave 43): the PILE trio
        // (LootTables.GenerateLoot:147-159); LR1: a pile rolls at its DUNGEON's tier - one home since WORLD8
        // (rollPileItems), which the hour's respawn rolls again
        const items = rollPileItems();
        lootPiles.push({ pos: [m.x + b.originX, m.y, m.z + b.originZ], record, items, isFixed, batch: null });
      }
    }
  }

  const flatAnims = new FlatAnimator();   // FA1
  const billboardBatches = [];
  // AUDIT 24 (wave 39): the blood pool registers into the SAME
  // persistent draw list the missile impact uses (:1395/:1404), so a
  // splash appears and disappears the way an impact flash does.
  // BLOOD1a: THE MARK POOL IS ITS OWN BINDING, and HARD1 is why. The
  // splash pool below is a HAND-OFF - every batch it mints joins
  // `billboardBatches`, which destroy() frees - so it must not also be
  // ended by hand, and a ring of decal quads is a thing it would OWN.
  // The gate's three answers are exclusive by design; a splash plays
  // and goes, a mark stays and costs a vertex buffer for the session.
  // Two lifetimes, two bindings, and destroy() ends this one by name.
  const bloodMarks = createBloodMarks({ renderer, collider: () => collider, settings: bloodDecalDeps });
  /** BLOOD2c: how the bleeding ledger reads one of this dungeon's bodies. */
  const foeBleedView = (f) => ({ feet: f.ai?.feet, health: f.entity?.health, maxHealth: f.entity?.maxHealth, bloodIndex: ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0, dead: !!f.dead, corpse: !!f.corpse });
  const hitEffects = createHitEffects({
    renderer, getTexture, uploadRecordFrame, marks: bloodMarks,
    onSpawn: (b) => billboardBatches.push(b),
    onRetire: (b) => { const i = billboardBatches.indexOf(b); if (i >= 0) billboardBatches.splice(i, 1); },
  });
  const coverItems = [];   // TACT1: the solid flats' proxies, stood once the batches are
  for (const [key, centers] of flatGroups) {
    const [bornArchive, bornRecord] = key.split('_').map(Number);
    // Flats keep their original archives (the table remaps walls);
    // RDB AddFlat pivots at the raw position - shift to base-centered.
    const bornT = await getTexture(bornArchive);
    if (!bornT || bornRecord >= bornT.recordCount) continue;
    let size = billboardSize(bornT, bornRecord);
    const based = centers.map(([x, y, z]) => [x, y - size.h / 2, z]);
    // NUDE-FLATS: a nude figure draws its clothed stand-in while Show Nudity is off, on the figure's own feet: the
    // pivot is the BORN sprite's centre, so the base above is the born size's, and the picture's size the drawn's.
    const [archive, record] = drawnFlat(bornArchive, bornRecord);
    const t = archive === bornArchive ? bornT : await getTexture(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    size = billboardSize(t, record);
    const batch = renderer.createBillboardBatch(archive, record, size, based);
    armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
    billboardBatches.push(batch);
    if (isCoverFlat(archive, record, size)) for (const c of based) coverItems.push(coverProxy(c, size));
  }
  collider.cover.add('tact1:flats', coverItems);
  // AUDIT 64 F13: the people's ACTIVATION EXTENT, off the same archive
  // the batch above read - `personAabb` wants a base and a swept
  // square, and an RDB flat's stored y is its CENTRE (the batch's own
  // `- size.h / 2`). A person whose archive gave no size is not a
  // target at all, exactly as the two other people rays already say.
  for (const pn of people) {
    if (!pn.active) continue;
    const t = await getTexture(pn.textureArchive);
    if (!t || pn.textureRecord >= t.recordCount) continue;
    const size = billboardSize(t, pn.textureRecord);
    // NUDE-FLATS: the box is the picture the batch above drew, on the same born feet
    const [da, dr] = drawnFlat(pn.textureArchive, pn.textureRecord);
    const dt = da === pn.textureArchive ? t : await getTexture(da);
    const drawn = dt && dr < dt.recordCount ? billboardSize(dt, dr) : size;
    pn.width = drawn.w;
    pn.height = drawn.h;
    pn.y -= size.h / 2;
  }

  // WAVE D: and one batch per MOVE-flag flat, minted at the flat's
  // placed origin so the tween's offset is exactly the origin uniform.
  // Same base-centering and same AnimateBillboard arming as the grouped
  // art above - a moving flat that stopped animating would be a second
  // bug traded for the first.
  for (const mf of moveFlats) {
    if (!mf.drawn) continue;
    const t = await getTexture(mf.archive);
    if (!t || mf.record >= t.recordCount) continue;
    uploadRecord(mf.archive, mf.record);
    const size = billboardSize(t, mf.record);
    const o = mf.o;
    const batch = renderer.createBillboardBatch(mf.archive, mf.record, size,
      [[o.origin[0], o.origin[1] - size.h / 2, o.origin[2]]]);
    armFlatAnim(batch, t, mf.archive, mf.record, flatAnims, uploadRecordFrame);
    billboardBatches.push(batch);
    moveFlatBatches.set(o.key, batch);
  }

  const flicker = new CityLightAnimator(lights.length, lights.map((l) => l.range));

  // C8 E1: per-frame foes pass - advance each rig on the canonical
  // runtime and composite through the SHARED pixelize pass. Owned by
  // the context so both hosts (modal dungeon frame, standalone scene)
  // call one implementation.
  // ON ICE (C17): the voxel foe-rig sprite pass - every foe renders
  // as a classic mobile now; the loader stays for a reversible thaw.
  let _drawSprite = null;
  async function _loadSprite() {
    if (!_drawSprite) _drawSprite = (await import('../render/characterSprite.js')).drawCharacterSprite;
  }
  if (foes.some((f) => f.rig)) await _loadSprite();
  // S2: one billboard batch per treasure pile (removable on pickup);
  // grounded like corpses (AlignBillboardToGround semantics).
  for (const pile of lootPiles) {
    const t = await getTexture(RANDOM_TREASURE_ARCHIVE);
    if (!t || pile.record >= t.recordCount) continue;
    uploadRecord(RANDOM_TREASURE_ARCHIVE, pile.record);
    const size = billboardSize(t, pile.record);
    pile.half = [size.w / 2, size.h / 2];
    // AUDIT 64 F16: a FIXED (archive 216) pile is not grounded.
    // AssignFixedTreasure (RDBLayout.cs:417-427) passes
    // adjustPosition:false - "Add fixed treasure flat with same archive
    // & record and use exact position" - so RDBLayout.cs:1583-1584's
    // -randomTreasureMarkerDim/2 drop, :1619-1620's
    // AlignBillboardToGround AND GameObjectHelper.cs:686-687's
    // +Summary.Size.y/2 are ALL skipped: the container transform IS the
    // marker point (GameObjectHelper.cs:706) and the centre-pivoted
    // billboard is CENTRED on it. This batch is base-anchored, so the
    // centre converts by -h/2 - the same conversion the ordinary RDB
    // flat batch above already applies. The port had raycast every pile
    // to the floor, dropping a 216 marker on a table, ledge or alcove
    // by up to floorLanding's whole 10-unit reach. `pile.pos` is the
    // pile's identity for the pickup AABB, nearbyLootRecords and the
    // save-rewind re-mint, so both arms write it.
    const g = pile.isFixed
      ? [pile.pos[0], pile.pos[1] - size.h / 2, pile.pos[2]]
      : floorLanding(collider, [pile.pos[0], pile.pos[1] + 0.2, pile.pos[2]]);
    pile.pos = g;
    // Bottom-anchored shader: the base IS the ground point (the +h/2
    // center-anchor holdover floated piles - C11 audit 08-17).
    pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, pile.record, size, [[g[0], g[1], g[2]]]);
    // FA1 slice 2: the SAME rule decides, and the data answers. DFU
    // gives every billboard the one AnimateBillboard loop and lets
    // frameCount settle it - a single-frame treasure pile arms nothing
    // and costs nothing, and a record that does carry frames moves.
    armFlatAnim(pile.batch, t, RANDOM_TREASURE_ARCHIVE, pile.record, flatAnims, uploadRecordFrame);
    billboardBatches.push(pile.batch);
  }

  // C8 E3c: the player's weapon rides the SHARED machine; the host
  // feeds gesture deltas (attackInput) and the hit frame resolves
  // here against the foes - reach/view/LOS verbatim, damage through
  // the full chain, reactions on the shipped clips, death -> the
  // extracted corpse flat replaces the rig.
  // The TRUE classic FP weapon (design pivot 2026-08-17), now the
  // SHARED host rig (C10 fold - combat/weaponRig.js owns the art
  // cache, the ShowWeapons legs, ToggleSheath + DrawWeapon 78, the
  // zero-arrow bow guard, the gesture buffer, and the swing-sound
  // edge; the audited laws moved verbatim). The weapon exists even
  // with NO foes now - host parity with the other rig mounts, and it
  // un-gates the listener/ambient pass below, which the old
  // foes-only playerWeapon had silently disabled in foe-less
  // dungeons. spellArmed = the HasReadySpell / IsPlayingAnim leg.
  let _weaponCanvas = null;   // the context sees a canvas only per drawFoes call
  // MW-D8: this host has no standing `cam` - drawFoes RECEIVES the eye
  // and the view each frame - so the rig's camera dep reads the latch
  // below, set at the same place the HUD derives its heading from. Null
  // until the first frame, which makes the arm inactive rather than
  // placed at the origin.
  let _fpEye = null;
  let _fpFeet = null;   // HT1: the player's feet this frame, for the torch's drop and throw
  let _fpYaw = 0;
  let _fpPitch = 0;
  let _fpBobY = 0;   // IG1: the head bob's vertical, latched with the rest
  let _fpSneaking = false;
  let _fpMove = null;   // MW-D26: the frame's movement report
  let _fpClimb = null;  // CLIMB6: the frame's climb snapshot (player/climbPose.js climbRigInput) - the host's, as the move is
  // HT1: the dungeon's dropped-torch pool - doused under the block water, aged by the world clock, saved with the room
  const droppedTorches = createDroppedTorches({
    renderer, audio, getTexture, uploadRecordFrame, collider: () => collider, foes: () => foes.filter((f) => !sparedByPlayer(f)), foeSinks: (f) => foeSinks(f), makeEnemiesHostile: () => makeAreaHostile(),   // AUDIT CC-B6: a thrown torch passes a companion by
    entity: playerEntity, camera: () => (_fpEye ? { pos: _fpEye, feet: _fpFeet, yaw: _fpYaw, pitch: _fpPitch,
      forward: [Math.sin(_fpYaw) * Math.cos(_fpPitch), Math.sin(_fpPitch), Math.cos(_fpYaw) * Math.cos(_fpPitch)], right: [Math.cos(_fpYaw), 0, -Math.sin(_fpYaw)], up: [0, 1, 0] } : null),
    inside: () => true, waterLevel: () => (_fpFeet ? blockWaterLevelAt(_fpFeet[0], _fpFeet[2]) : null), say: (l) => hudText.add(l),   // PlayerEnterExit.blockWaterLevel: the player's block
  });
  // SURV3: THE CAMPS on the dungeon floor - a fire off a Campfire Kit (the camp law refuses a tent below). Online a
  // dungeon is a WORLD ROOM: a placed fire goes out as an act (`c` beside the doors and the loot) and the room's
  // memory carries every camp standing, so a fire one player lit is lit for the next - a door's own law. No owner
  // sweep here: in a world room a camp is the room's, as an opened chest is.
  // SURV7 - THE SURVIVAL ENV, underground: the outer host's reading
  // (the climate, the month, the resistances) with the flags this host
  // owns - the floor, no sun or water, the fire on the floor; the
  // standalone scene has no outer host and reads the clock itself.
  const survivalEnvNow = () => {
    const outer = opts.survivalEnv?.() ?? null;
    const wm = skyMinutes();   // LIVED1: the month and the hour the air is felt at are the sky's; TIME1: its own clock
    return {
      climateIndex: 232, month: dateFromClassicMinutes(wm).month, hour: (((wm % 1440) + 1440) % 1440) / 60,
      ...(outer ?? {}),
      insideBuilding: false, insideDungeon: true, inSunlight: false, swimming: false, transport: false,
      byFire: !!(_fpFeet && camps.byFire(_fpFeet)),
      resting: !!playerEntity.isResting, sleeping: playerEntity.isResting && !playerEntity.isLoitering ? (playerEntity.restKind ?? 'rough') : null,
    };
  };
  const _survivalGate = installSurvivalGate(registerPreventRestCondition, () => playerEntity, survivalEnvNow);   // SURV7: the rest gate, this host's readers; AUDIT SURV B/C: the pair leaves the seam with this context
  const camps = createCamps({
    renderer, getTexture, uploadRecordFrame, meshes: { getGpuMesh, cpuModels }, entity: playerEntity,
    hearths: () => dungeonHearths,   // HEARTH1: built with the blocks and standing still, like everything else down here
    camera: () => (_fpFeet ? { feet: _fpFeet, yaw: _fpYaw } : null), collider: () => collider,
    place: () => ({ insideBuilding: false, insideDungeon: true, inTown: false, enemiesNearby: areEnemiesNearby(foes, { resting: true }), inWater: !!(_fpFeet && Number.isFinite(blockWaterLevelAt(_fpFeet[0], _fpFeet[2])) && blockWaterLevelAt(_fpFeet[0], _fpFeet[2]) !== 10000 && _fpFeet[1] < -blockWaterLevelAt(_fpFeet[0], _fpFeet[2]) * GLOBAL_SCALE) }),
    say: (l) => hudText.add(l), showOverlay: (w) => pushDungeonWindow(w), openRest: () => { activeOverlay = null; api.toggleRest?.(); },   // the picker leaves the slot first
    advanceMinutes: (n) => _restAdvance(n),
    selfId: () => opts.selfId?.() ?? null, onChanged: () => { const c = camps.wireRecords(); opts.onActions?.({ k: _locationKey, c: c.length ? c : [] }); },   // an empty list says "none stand" - the room drops mine
    fieldCook: () => opts.fieldCook?.() === true,   // PROF9: a Field Cook's kit keeps its charge (Professions-Arc 3.3)
  });
  /** SURV3: the room's memory of its camps - every camp standing, each with its owner (`o`). */
  const campMemory = () => camps.camps.map((c) => ({ ...campWire(c.rec), o: c.owner ?? (opts.selfId?.() ?? 'host') }));
  function applyCampMemory(list) {
    if (!Array.isArray(list)) return 0;
    const byOwner = new Map();
    for (const raw of list) { if (raw && typeof raw === 'object' && typeof raw.o === 'string' && validCampRecord(raw)) { if (!byOwner.has(raw.o)) byOwner.set(raw.o, []); byOwner.get(raw.o).push(raw); } }
    let n = 0;
    for (const [owner, recs] of byOwner) if (camps.applyOwner(owner, recs)) n += recs.length;
    return n;
  }
  const weaponRig = createWeaponRig({
    // EM-BUG1: HANDS HOLDING A MAP ARE NOT ALSO HOLDING A SWORD.
    // MAP-WEAPON gave the world host this gate when only the world
    // host could open the sheet; EM3/EM4 gave the same window a door
    // here too and this bag never grew the term, so the map came up
    // with the weapon still drawn over it. The window's own tag, read
    // off this host's slot, as world.js reads off its own.
    sheetWindowUp: () => activeOverlay?.holdsScreen === true,
    renderer, canvas: () => _weaponCanvas, fetchBytes, palette, audio, entity: playerEntity,
    collider: () => collider, missEffect: (k, p, o) => hitEffects.showMissEffect(k, p, o),   // WW1: the weapon widget's recoil doors
    actionDown: (action) => !!opts.actionDown?.(action), torches: () => droppedTorches,   // HT1; KB1: registry actions
    activateHeld: () => !!opts.activateHeld?.(),   // AUDIT 28 W12: the host's ActivateCenterObject, for the drawn bow's un-draw
    // MW-D10: rule 54's neck pitch; MW-D15: rule 32(a)'s sneak sink.
    camera: () => (_fpEye ? { pos: _fpEye, yaw: _fpYaw, pitch: _fpPitch, feet: _fpFeet, climbing: !!_fpMove?.climbing, sneaking: _fpSneaking, move: _fpMove, bob: [0, _fpBobY], climb: _fpClimb } : null),   // HT1: feet and the climb   // MW-D26; IG1: the bob rides too   // CLIMB6: the climb's snapshot, the host's
    bindWorn: opts.playerWeapon !== 'bow',   // AUDIT 17e F17: the ?weapon=bow debug flag keeps its scripted weapon
    say: (l) => hudText.add(l),
    spellArmed: () => magic.spellArmed(), abortSpell: () => magic.abortReadySpell(),   // MAC-O1: WeaponManager.Update:251 - the ReadyWeapon key puts a readied spell away and draws
    actTool: () => opts.actTool?.() ?? null,   // PROF2: the Pick-Axe in the hand at a dungeon vein (the outer host's act)
  });
  const playerWeapon = weaponRig.playerWeapon;   // the dungeon-side combat consumers read it
  if (opts.playerWeapon === 'bow') {
    // Combat bows: ?weapon=bow readies a plain Short Bow (template
    // 129) for scripted demos - the native inventory/equip UI shipped
    // at U8e/U8g (AUDIT 23 retired the stale 'pends' note).
    playerWeapon.weapon = { name: 'Short Bow', ...createWeapon(129, 0) };   // scripted demo: the rig's worn bind is off for this context (see createWeaponRig bindWorn)
  }
  async function spawnCorpse(f) {
    if (f._diedAt == null) f._diedAt = _wallNow();   // WORLD8: the death's stamp, the relay's clock (null offline) - the memory carries it and the hour's respawn reads it
    // AUDIT 68 review (R-scenes-corpse-flap-unlootable): the death raises the body's flag, not the mint - a
    // dead/alive/dead flap while the first mint is in flight returns below, and S19's lootableBody reads the flag
    f.corpse = true;
    // AUDIT WORLD2 B14: one mint in flight per foe - a dead/alive/dead flap while the texture warmed minted two
    // batches and freed one
    if (f._corpseMinting) return;
    f._corpseMinting = true;
    try { await spawnCorpseNow(f); } finally { f._corpseMinting = false; }
  }
  async function spawnCorpseNow(f) {
    f.corpse = true;   // BLOOD2c: a body to bleed out from - set at the mint, whichever door asked for it (the kill's, the stream's), and cleared with the corpse by freeCorpse
    // A5 - EnemyDeath.cs:86-92 reads `mobile.Enemy.CorpseTexture`, the
    // per-mobile STRUCT COPY, not the static row. That only matters for
    // one enemy in the game: SetSpecialTransformationCompleted swaps
    // the seducer's unwinged corpse (400/6) for the winged one (400/5),
    // and the static table cannot carry both. A rig foe has no mobile
    // and falls back to the row, which is where it always read.
    const ct = f.mobile?.basics?.corpseTexture ?? ENEMY_BASICS[f.mobileType]?.corpseTexture;
    // C12: a flyer dies mid-air - the corpse lands on the floor
    // below (AlignBillboardToGround semantics for every corpse).
    const p = floorLanding(collider, [f.ai.feet[0], f.ai.feet[1] + 0.1, f.ai.feet[2]]);
    f.corpsePos = p;   // AUDIT 32 H3: where the body lies - its loot's box and Hunting's body read it (corpseAt), never the air it died in
    if (!ct) return;
    const t = await getTexture(ct.archive);
    if (!t || ct.record >= t.recordCount) return;
    // SL2 (save-load-2): a backward load can RESURRECT this foe while
    // the texture warms - a corpse must never mint for a live foe.
    // NT1 (F213): ...and a context torn down while the texture warms
    // must not receive a corpse either - the foe IS dead on exit, so
    // only the context's own latch can stop the orphan mint.
    if (!f.dead || _ctxDead) return;
    // AUDIT 68 S19-retype-orphans-corpse: ...nor a record the pool no longer holds (a rebuild stood a new one at its
    // index, or the load's cut spliced it) - stand() marks it dead, and nothing could ever free a flat minted onto it.
    if (!foes.includes(f)) return;
    uploadRecord(ct.archive, ct.record);
    const size = eliteCorpseSize(billboardSize(t, ct.record), f.entity);   // ELITE FOES: an elite's body lies a quarter larger
    // The billboard shader BOTTOM-anchors (position = base): the old
    // +h/2 was a center-anchor holdover and floated every corpse by
    // half its height (C11 audit 08-17; the static-flat path shifts
    // DOWN for the same reason).
    const batch = renderer.createBillboardBatch(ct.archive, ct.record, size, [[p[0], p[1], p[2]]]);
    // Same rule, same seam: a corpse record is single-frame in classic
    // so this arms nothing today, but DFU gives corpses the same
    // billboard and lets the data decide, and so does this.
    armFlatAnim(batch, t, ct.archive, ct.record, flatAnims, uploadRecordFrame);
    if (isEliteCorpse(f.entity)) markEliteCorpseBatch(batch);   // ELITE FOES: the blue outline stays, the embers stop
    f.corpseBatch = batch;   // SL2: the rewind frees a corpse BY ITS FOE
    billboardBatches.push(batch);   // hosts draw + destroy() frees
  }
  function playerAttackInput(dx, dy, held) {   // host mouse events buffer here
    if (held && opts.profActing?.()) return;   // PROF2: an act's strike is the act's - never a swing (the outer host reads it); AUDIT 29 D2: the PRESS alone - a release is never gated, or a button held into an act swung on after it
    // I2 (cast probe): the CAST intercept runs BEFORE the sheath gate.
    // DFU's cast is EntityEffectManager's own Update - a separate
    // component from WeaponManager - so a sheathed player still fires
    // a readied spell on the click; only the SWING needs the weapon
    // out (WeaponManager verbatim, audit 2026-08-17).
    if (magic.interceptAttack(held)) return;   // the armed click casts, no swing
    weaponRig.attackInput(dx, dy, held);   // AUDIT 68 S09-sheathed-swing: the rig refuses the swing itself; a host-side sheath gate here ate the RELEASE
  }
  // ═══ WB4b: THE BURNING COURT'S BOSS, MET ═══════════════════════════════════════════════════════════════════════
  // (2026-09-25, Mac: "a large boss arena with an oversized enemy"). The outer host's word of him (`opts.gateBoss` -
  // scenes/gateCourt.js target(): where he stands, his height and radius, his ward, his stand-in entity for the
  // formulas) as a foe-shaped record, made each time it is asked; null outside the court. He is NEVER in `foes`: nothing
  // here moves, ticks, kills or loots him - the relay runs him (net/gateBrain.js) - so every blow of mine that meets him
  // is computed here by the game's own law and its number goes out (`opts.onBossHit`), the relay's caps deciding what
  // lands. Co-op's law turned about: the striker's machine says the number, the room holds the health.
  function gateBossBody() {
    const b = opts.gateBoss?.() ?? null;
    if (!b || !b.entity || !Array.isArray(b.feet) || !(b.height > 0) || !(b.radius > 0)) return null;
    b.entity.warded = !!b.warded;   // AUDIT SETS L4: his ward on his stand-in too - a blow it turns spends no set power (sigilSetPowers.js setBlow)
    return {
      boss: true, dead: false, entity: b.entity, mobileType: b.mobile ?? null, warded: !!b.warded,
      ai: { feet: b.feet, yaw: b.yaw ?? 0, height: b.height, radius: b.radius, centreOffset: b.height / 2, isHostile: true },
    };
  }
  // ═══ WB9c: THE CRYSTALS OF OBLIVION, MET ════════════════════════════════════════════════════════════════════════
  // (2026-09-30, Mac: "a detailed wipe mechanic on the final phase that should require players to destroy oblivion
  // crystaline formations"). The outer host's word of them (`opts.gateCrystals` - scenes/gateCourt.js crystalTargets():
  // each standing crystal's number, where it stands, its body and its stand-in) as foe-shaped records, made each time
  // asked; none outside a Reckoning. As he is, they are NEVER in `foes`: a blow of mine that meets one is computed here by
  // the game's own law against its stand-in (world/gateBoss.js crystalStandIn - unarmoured: a crystal does not dodge)
  // and its number goes out (`opts.onCrystalHit`), the relay's caps deciding what lands (net/gateBrain.js applyCrystalHit).
  function gateCrystalBodies() {
    const list = opts.gateCrystals?.() ?? null;
    if (!Array.isArray(list) || !list.length) return [];
    const out = [];
    for (const q of list) {
      if (!q?.entity || !Array.isArray(q.feet) || !(q.height > 0) || !(q.radius > 0) || !Number.isInteger(q.c)) continue;
      out.push({ crystal: q.c, dead: false, entity: q.entity, mobileType: null, ai: { feet: q.feet, yaw: 0, height: q.height, radius: q.radius, centreOffset: q.height / 2, isHostile: true } });
    }
    return out;
  }
  /** A blow's number on a crystal, out to the relay through the court's door; answers whether it went. */
  const landOnCrystal = (cr, damage, r) => !!opts.onCrystalHit?.({ c: cr.crystal, d: damage, r });
  /** A swing of mine that met a crystal: the glass rings (the court voices it - scenes/gateCourt.js), the number out. */
  function swingOnCrystal(cr, damage) {
    if (damage > 0) landOnCrystal(cr, damage, HIT_KINDS.Melee);
    playerWeaponHitEntity(playerEntity, cr.entity, { mobileType: null });
  }
  /** A harmful spell of mine that met a crystal (hostMagic's crystal seam): its harmful families on the crystal's
   *  stand-in by the one door every spell lands through, the damage summed and sent. */
  function spellOnCrystal(sp, c) {
    const cr = gateCrystalBodies().find((q) => q.crystal === c), harm = duelSpellOf(sp);
    if (!cr || !harm) return false;
    let dealt = 0;
    const sinks = { hurt: (n) => { dealt += Math.max(0, n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} };
    try { applySpell(harm, playerEntity.level, cr.entity, sinks, Math.random, { entity: playerEntity }); } finally { cr.entity.activeEffects = []; }
    if (!(dealt >= 1)) return false;
    reportPlayerAttack({ hit: true, damage: Math.round(dealt) });   // HN1: the number pops as a blow's does
    return landOnCrystal(cr, dealt, HIT_KINDS.Spell);
  }
  // ═══ WB11c: HIS HOST, MET ═════════════════════════════════════════════════════════════════════════════════════════
  // (2026-10-01, Mac: "1. All three ... 4. Trial rotation" - the Legion-Lord's Harriers, Sappers and Ward-Bearers). The
  // outer host's word of them (`opts.gateHost` - scenes/gateCourt.js hostTargets(): each one standing, its number, where
  // it stands, its body, its stand-in and its mobile) as foe-shaped records, made each time asked; none but under the
  // trial. As he and his crystals are, they are NEVER in `foes`: a blow of mine that meets one is computed here by the
  // game's own law against its stand-in (world/gateBoss.js hostStandIn) and its number goes out (`opts.onHostHit`), the
  // relay's caps deciding what lands (net/gateBrain.js applyHostHit). They bleed and sound as their own mobile does - their
  // blood laddered against their own whole (`bloodOf`: AUDIT WB11 W5 - the stand-in's health nothing can empty threw the
  // lowest rung at every blow).
  function gateHostBodies() {
    const list = opts.gateHost?.() ?? null;
    if (!Array.isArray(list) || !list.length) return [];
    const out = [];
    for (const q of list) {
      if (!q?.entity || !Array.isArray(q.feet) || !(q.height > 0) || !(q.radius > 0) || !Number.isInteger(q.i)) continue;
      out.push({ host: q.i, m: q.m ?? 0, bloodOf: { maxHealth: q.m > 0 ? q.m : 0 }, dead: false, entity: q.entity, mobileType: q.mobile ?? null, ai: { feet: q.feet, yaw: 0, height: q.height, radius: q.radius, centreOffset: q.height / 2, isHostile: true } });
    }
    return out;
  }
  /** A blow's number on one of his host, out to the relay through the court's door; answers whether it went. */
  const landOnHost = (hb, damage, r) => !!opts.onHostHit?.({ i: hb.host, d: damage, r });
  /** Its middle, where a blow on it sounds and splashes. */
  const hostChest = (hb) => [hb.ai.feet[0], hb.ai.feet[1] + hb.ai.centreOffset, hb.ai.feet[2]];
  /** A swing of mine that met one of his host (resolveHit's own verdict and number): a zero blow's parry as its mobile
   *  parries, else the hit's sound and its own blood at it and the number out; OnWeaponHitEntity either way. */
  function swingOnHost(hb, damage, lookDir) {
    if (damage <= 0) {
      const snd = zeroDamageHitSound({ weapon: playerWeapon.strikingWeapon, arrowHit: false, parrySounds: !!ENEMY_BASICS[hb.mobileType]?.parrySounds, roll: Math.random() });
      if (snd?.at === 'enemy') audio.play3d(snd.sound, hostChest(hb), 1.1, { maxDistance: 24 });
      else if (snd) audio.playOneShot(snd.sound, 1.1);
    } else {
      audio.play3d(hitSoundFor(playerWeapon.strikingWeapon), hostChest(hb), ENEMY_HIT_VOLUME, { maxDistance: 24 });
      hitEffects?.showBloodSplash(ENEMY_BASICS[hb.mobileType]?.bloodIndex ?? 0, hostChest(hb), null, bloodHit(damage, hb.bloodOf, { fromPlayer: true, weapon: playerWeapon.strikingWeapon, swing: playerWeapon.machine?.state, forward: lookDir }));
      landOnHost(hb, damage, HIT_KINDS.Melee);
    }
    playerWeaponHitEntity(playerEntity, hb.entity, { mobileType: hb.mobileType });
  }
  /** A harmful spell of mine that met one of his host (hostMagic's host seam): its harmful families on the body's
   *  stand-in by the one door every spell lands through, the damage summed and sent. */
  function spellOnHost(sp, i) {
    const hb = gateHostBodies().find((q) => q.host === i), harm = duelSpellOf(sp);
    if (!hb || !harm) return false;
    let dealt = 0;
    const sinks = { hurt: (n) => { dealt += Math.max(0, n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} };
    try { applySpell(harm, playerEntity.level, hb.entity, sinks, Math.random, { entity: playerEntity }); } finally { hb.entity.activeEffects = []; }
    if (!(dealt >= 1)) return false;
    reportPlayerAttack({ hit: true, damage: Math.round(dealt) });   // HN1: the number pops as a blow's does
    return landOnHost(hb, dealt, HIT_KINDS.Spell);
  }
  // ═══ ARENA4: MY OPPONENT ON A RELAY'S SAND, MET ═══════════════════════════════════════════════════════════════
  // (2026-10-02, Mac: "choose to matchmake for a real opponent to take on in real time"). The outer host's word of the
  // other player in a refereed bout (`opts.arenaRival` - scenes/world.js: their fighter id, where their body stands, its
  // height and radius, a stand-in for the formulas) as a foe-shaped record, made each time asked; none outside such a
  // bout. Never in `foes` - their body is the room's (net/remotePlayers.js) - so a blow of mine that meets it is computed
  // here by the game's own law and its number goes to the relay's referee (`opts.onArenaHit`, PVP-REF), which holds both
  // fighters' health and decides what lands.
  function arenaRivalBody() {
    const r = opts.arenaRival?.() ?? null;
    if (!r || !r.entity || !Array.isArray(r.feet) || !(r.height > 0) || !(r.radius > 0) || typeof r.i !== 'string') return null;
    return { rival: r.i, dead: false, entity: r.entity, mobileType: null, ai: { feet: r.feet, yaw: r.yaw ?? 0, height: r.height, radius: r.radius, centreOffset: r.height / 2, isHostile: true } };
  }
  /** ARENA4b: THE BLOW'S SEQUENCE the referee reads (net/arenaBrain.js refBlow - one blow however many bodies it met): a
   *  swing's every body one number (resolvePlayerHit), each shaft its own, each spell its own. */
  let _arenaQ = 0;
  const nextArenaQ = () => (_arenaQ = (_arenaQ + 1) & 0x7fffffff);
  /** ARENA4b: A CAST'S SEQUENCE on the relay's fighters - every body one blast (or one round of its effects) meets in the
   *  cast engine's one synchronous run shares one number, the next run a new one: the referee counts the cast once
   *  (PVP-REF's three in five seconds), never once a body as ARENA4's unnumbered claims were. */
  let _arenaSpellQ = null;
  const arenaSpellQ = () => {
    if (_arenaSpellQ == null) { _arenaSpellQ = nextArenaQ(); void Promise.resolve().then(() => { _arenaSpellQ = null; }); }
    return _arenaSpellQ;
  };
  /** A blow's number on my opponent, out to the referee (ARENA4b: with its sequence); answers whether it went. */
  const landOnRival = (rb, damage, kind) => !!opts.onArenaHit?.({ i: rb.rival, d: damage, kind, w: playerWeapon.strikingWeapon?.templateIndex ?? -1, m: playerWeapon.strikingWeapon?.material ?? 0, q: _arenaQ });
  /** A swing of mine that met my opponent: the parry's ring for none, else the hit's sound and blood at them and the
   *  number out (their own screen bleeds as the relay's health falls). */
  function swingOnRival(rb, damage, lookDir) {
    const chest = [rb.ai.feet[0], rb.ai.feet[1] + rb.ai.centreOffset, rb.ai.feet[2]];
    if (damage <= 0) { audio.play3d(SOUND.Parry6, chest, 1.1, { maxDistance: 24 }); landOnRival(rb, 0, 'melee'); return; }
    audio.play3d(hitSoundFor(playerWeapon.strikingWeapon), chest, ENEMY_HIT_VOLUME, { maxDistance: 24 });
    hitEffects?.showBloodSplash(0, chest, null, bloodHit(damage, rb.entity, { fromPlayer: true, weapon: playerWeapon.strikingWeapon, swing: playerWeapon.machine?.state, forward: lookDir }));
    landOnRival(rb, damage, 'melee');
  }
  /** ARENA4b: A HARMFUL SPELL OF MINE THAT MET MY OPPONENT (hostMagic's duel seam): its harmful families on their
   *  stand-in by the one door every spell lands through, the damage summed and out to the referee as a spell - its own
   *  sequence, PVP-REF's three casts in five seconds and sixty a cast deciding what lands (swingOnRival's road). */
  function spellOnRival(sp) {
    const rb = arenaRivalBody(), harm = duelSpellOf(sp);
    if (!rb || !harm) return false;
    let dealt = 0;
    const sinks = { hurt: (n) => { dealt += Math.max(0, n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} };
    try { applySpell(harm, playerEntity.level, rb.entity, sinks, Math.random, { entity: playerEntity }); } finally { rb.entity.activeEffects = []; }
    if (!(dealt >= 1)) return false;
    reportPlayerAttack({ hit: true, damage: Math.round(dealt) });   // HN1: the number pops as a blow's does
    nextArenaQ();
    return landOnRival(rb, dealt, 'spell');
  }
  /** How the swing sees him: the distance to his body's SURFACE (his axis is `radius` in and his middle `height/2` up - a
   *  point-centre law would ask a swing to reach 3 m into him), in view at the nearest point of him, the way to it
   *  clear. */
  function bossSight(eye, inViewFn, boss) {
    const { point: p, dist } = bossReach(eye, boss.ai);   // world/gateBoss.js: the nearest point of his surface, and the reach to it
    const vx = p[0] - eye[0], vy = p[1] - eye[1], vz = p[2] - eye[2], ray = Math.hypot(vx, vy, vz), l = ray || 1;
    const hit = collider.raycast(eye, [vx / l, vy / l, vz / l], ray);
    return { dist, inView: inViewFn(p), losClear: !Number.isFinite(hit) || hit >= ray - 1e-3 };
  }
  /** His chest, where a blow on him sounds and splashes. */
  const bossChest = (boss) => [boss.ai.feet[0], boss.ai.feet[1] + boss.ai.centreOffset, boss.ai.feet[2]];
  /** The ward turns a blow: the parry's ring at him, nothing sent (the relay refuses a warded blow). */
  function wardTurns(boss) { audio.play3d(SOUND.Parry6, bossChest(boss), ENEMY_HIT_VOLUME, { maxDistance: 24 }); }
  /** A blow's number on him, out to the relay through the court's door; answers whether it went. */
  function landOnBoss(boss, damage, r) {
    if (boss.warded) { wardTurns(boss); return false; }
    return !!opts.onBossHit?.({ d: damage, r });
  }
  /** A swing of mine that met him (resolveHit's own verdict and number): the ward's ring, a zero blow's parry - he parries
   *  as his mobile does - or the hit's sound and splash at him and the number out; OnWeaponHitEntity either way. */
  function swingOnBoss(boss, damage, lookDir) {
    if (boss.warded) wardTurns(boss);
    else if (damage <= 0) {
      const snd = zeroDamageHitSound({ weapon: playerWeapon.strikingWeapon, arrowHit: false, parrySounds: !!ENEMY_BASICS[boss.mobileType]?.parrySounds, roll: Math.random() });
      if (snd?.at === 'enemy') audio.play3d(snd.sound, bossChest(boss), 1.1, { maxDistance: 24 });
      else if (snd) audio.playOneShot(snd.sound, 1.1);
    } else {
      audio.play3d(hitSoundFor(playerWeapon.strikingWeapon), bossChest(boss), ENEMY_HIT_VOLUME, { maxDistance: 24 });
      hitEffects?.showBloodSplash(ENEMY_BASICS[boss.mobileType]?.bloodIndex ?? 0, bossChest(boss), null, bloodHit(damage, boss.entity, { fromPlayer: true, weapon: playerWeapon.strikingWeapon, swing: playerWeapon.machine?.state, forward: lookDir }));
      landOnBoss(boss, damage, HIT_KINDS.Melee);
    }
    playerWeaponHitEntity(playerEntity, boss.entity, { mobileType: boss.mobileType });
  }
  /** A harmful spell of mine that met him (hostMagic's boss seam): its harmful families landed on his stand-in by the
   *  one door every spell lands through (effects.js applySpell - the magnitude, his saving throw), the damage summed and
   *  sent. Continuous families are not his to carry - the stand-in forgets them. */
  let swayToldAt = -Infinity;   // WB8a: when his refusal was last said
  function spellOnBoss(sp) {
    const boss = gateBossBody(), harm = duelSpellOf(sp);
    if (!boss) return false;
    // WB8a: A SWAY ON HIM. A Pacify or a Charm in the spell is refused by his own word (world/gateBoss.js bossStandIn's
    // pacifyImmune) and said so - the rest of the spell lands as it would; alone, the refusal is what met him
    const sways = spellSways(sp) && !!boss.entity.pacifyImmune;
    if (sways && Date.now() - swayToldAt >= BOSS_SWAY_TELL_MS) { swayToldAt = Date.now(); hudText.add(BOSS_SWAY_TEXT(boss.entity.name)); }
    // WBX7 (2026-09-26, Swololo on Discord: "soul trap didnt seem to work"): A SOUL TRAP ON HIM. The trap is laid on his
    // stand-in by the one door every spell lands through (applySpell - its rounds, its chance frozen at the cast by my
    // level, his save against a new trap, "Trap active."), and handed to the court, which keeps it on the fight's clock:
    // he is the relay's to kill, so the kill's roll is the court's, at his fall (scenes/gateCourt.js). The stand-in
    // forgets it at once, as it forgets every lasting family.
    const trapFx = (sp.effects ?? []).filter((e) => e && isSoulTrapEffect(e));
    let laid = false;
    if (trapFx.length) {
      const noSink = () => {};
      // AUDIT WBX F6: a trap of mine already running on him (the court keeps it) is his incumbent for this cast - a recast
      // stacks its rounds onto it with no new save (effects.js AddState), where the stand-in's forgotten trap made every
      // recast a new one against his save
      const running = opts.bossTrapNow?.() ?? null;
      if (running) boss.entity.activeEffects = [{ kind: 'soulTrap', chance: running.chance, roundsRemaining: 0 }];
      try {
        const res = applySpell({ ...sp, effects: trapFx }, playerEntity.level, boss.entity, { hurt: noSink, heal: noSink, drainFatigue: noSink, restoreFatigue: noSink, drainMagicka: noSink, restoreMagicka: noSink }, Math.random, { entity: playerEntity });
        const trap = (boss.entity.activeEffects ?? []).find((a) => a.kind === 'soulTrap' && !a.ended);
        if (trap) laid = !!opts.onBossTrap?.({ chance: trap.chance, rounds: (trap.roundsRemaining ?? 0) + 1 });
        if (res?.trapAlert && SOUL_TRAP_TEXT[res.trapAlert]) hudText.add(SOUL_TRAP_TEXT[res.trapAlert]);
      } catch (e) { console.warn('[gate] the trap on him', e?.message ?? e); } finally { boss.entity.activeEffects = []; }
    }
    if (!harm) return laid || sways;
    let dealt = 0;
    const sinks = { hurt: (n) => { dealt += Math.max(0, n); }, heal() {}, drainFatigue() {}, restoreFatigue() {}, drainMagicka() {}, restoreMagicka() {} };
    try { applySpell(harm, playerEntity.level, boss.entity, sinks, Math.random, { entity: playerEntity }); } finally { boss.entity.activeEffects = []; }
    if (!(dealt >= 1)) return false;
    reportPlayerAttack({ hit: true, damage: Math.round(dealt) });   // HN1: the number pops as a blow's does
    return landOnBoss(boss, dealt, HIT_KINDS.Spell);
  }
  /** AUDIT WB11 W1: A CAST WHEN STRIKES SPELL ON A STAND-IN OF THE COURT - the one it names: one of his host (`hostI`),
   *  a crystal (`crystalC`), else him. Every one went to his door, wherever he stood: a blade that cut an Imp cast on him. */
  function spellOnStandIn(record, target = null) {
    if (target?.hostI != null) return spellOnHost(record, target.hostI);
    if (target?.crystalC != null) return spellOnCrystal(record, target.crystalC);
    return spellOnBoss(record);
  }
  function resolvePlayerHit(eye, inViewFn, playerFeet, lookDir) {
    nextArenaQ();   // ARENA4b: this swing is one blow to the referee, every body it meets
    // AUDIT 23 (combat-14): entity colliders resolve FIRST
    // (WeaponManager.cs:1048-1056 foreach over hitColliders);
    // WeaponEnvDamage runs only in the no-entity fallback (:1057-1064
    // "if no hits were detected from bounds check") - env-first let a
    // door in reach eat the swing over the foe standing at it. The
    // C10-fold rules stand: a bashed door consumes the swing,
    // Receive(Attack) lets it continue, geometry occludes - and the
    // foe-less contexts (mobile, foe deps still loading - the
    // 2026-08-17 live crash) fall straight to the fallback below.
    if (!foeDeps) return lookDir ? (envAttack(actions, collider, eye, lookDir, Math.random), false) : false;
    // E3d: backstab facing per foe, verbatim IsBackFacing (records
    // 3/4 of the 8-orientation wheel); the chance = the player's
    // Backstabbing skill, tallied inside CalculateBackstabChance
    // (FormulaHelper.cs:975-990 - the tally was ported nowhere).
    for (const f of foes) if (!f.dead) f._backFacing = foeDeps.isBackFacing(f.ai.yaw, f.ai.feet, playerFeet);
    const live = dropFateHeld(foes.filter((f) => !f.dead && f.companion == null));   // REVENANT-FATE (the 2026-10-02 audit): one held by its fate is no swing's. CREW-COMPANIONS: my companion is never the swing's (exteriorFoes' SHIPMATES filter)
    // WB4b: THE COURT'S BOSS, a body the swing meets as it meets a foe - the same resolveHit and formula, against his
    // stand-in, by his body's SURFACE (bossSight); never in `foes`: what lands goes to the relay (landOnBoss)
    const boss = gateBossBody();
    if (boss) { boss._backFacing = foeDeps.isBackFacing(boss.ai.yaw, boss.ai.feet, playerFeet); live.push(boss); }
    const canSee = (f) => {
      if (f === boss) return bossSight(eye, inViewFn, boss);
      if (f.crystal != null) return bossSight(eye, inViewFn, f);   // WB9c: a crystal of Oblivion by its surface, as he is
      if (f.host != null) return bossSight(eye, inViewFn, f);   // WB11c: one of his host by its surface
      if (f.rival != null) return bossSight(eye, inViewFn, f);   // ARENA4: my opponent by their surface
      const c = [f.ai.feet[0], f.ai.feet[1] + (f.ai.height ?? CAPSULE_HEIGHT) / 2, f.ai.feet[2]];   // foe center (mid-capsule) - ITS capsule (REVIEW 2026-09-05), the 0.9 was the player's
      const dx = c[0] - eye[0], dy = c[1] - eye[1], dz = c[2] - eye[2];
      const dist = Math.hypot(dx, dy, dz);
      const l = dist || 1;
      const hit = collider.raycast(eye, [dx / l, dy / l, dz / l], dist);
      return { dist, inView: inViewFn(c), losClear: !Number.isFinite(hit) || hit >= dist - 1e-3 };
    };
    for (const cr of gateCrystalBodies()) { cr._backFacing = false; live.push(cr); }   // WB9c: the Reckoning's crystals, bodies the swing meets as it meets him
    for (const hb of gateHostBodies()) { hb._backFacing = false; live.push(hb); }   // WB11c: his host, bodies the swing meets (its facing is the relay's walk, not a body's - no backstab)
    const rival = arenaRivalBody();   // ARENA4: my opponent on a relay's sand - a body the swing meets, by its surface
    if (rival) { rival._backFacing = foeDeps.isBackFacing(rival.ai.yaw, rival.ai.feet, playerFeet); live.push(rival); }
    // (the module-level playerEntity import IS foeDeps.playerEntity -
    // the old shadowing destructure was the null read that crashed)
    let hitEnemy = false;
    // C2-slice (combat-17): the player's 20% attack grunt fires once
    // per hit frame, never for a bow (this path is melee-only).
    const grunt = playerAttackGrunt(playerEntity, false, Math.random);   // explicit: this path's resolveHit rides Math.random too (no injected seam here)
    if (grunt && grunt.clip >= 0) audio.playOneShot(grunt.clip, 1, 1 + grunt.pitchLift);   // AUDIT 58: FPSWeapon.cs:316-319's lift
    { const v = lycanthropeAttackVoice(playerEntity, Math.random); if (v != null) audio.playOneShot(v, 1); }   // V4: OnWeaponHitEntity's transformed voice (10% attack / 20% bark)
    for (const { foe, damage } of playerWeapon.resolveHit(live, playerEntity, canSee, Math.random, (f) => backstabChanceOf(playerEntity, !!f._backFacing), (l) => hudText.add(l),
      (f, pt) => poisonFoe(f, pt))) {   // C2-slice (combat-11): the player's poisoned blade infects its victim; WORLD6b-iii(e): through the one poison door (a puppet's rides the hit)
      if (foe === boss) { hitEnemy = true; swingOnBoss(boss, damage, lookDir); continue; }   // WB4b: his own arm - nothing of a foe's door is his
      if (foe.crystal != null) { hitEnemy = true; swingOnCrystal(foe, damage); continue; }   // WB9c: a crystal's own - no blood, no foe's door
      if (foe.host != null) { hitEnemy = true; swingOnHost(foe, damage, lookDir); continue; }   // WB11c: one of his host's own - its blood, no foe's door
      if (foe.rival != null) { hitEnemy = true; swingOnRival(foe, damage, lookDir); continue; }   // ARENA4: my opponent's - the number to the referee
      // WeaponDamage returns true for a CONNECTING swing even at zero
      // damage (WeaponManager.cs:617-637 falls through to
      // DecreaseHealth/HandleAttackFromSource and returns true), so
      // hitEnemy - and with it the skill tallies at :423-435 - is set
      // before the damage branch.
      hitEnemy = true;
      if (damage <= 0) {
        // WeaponManager.cs:609-615, the zero-damage arm. The old code
        // played :483's WALL pair (Hit2/Parry6), a branch DFU's own
        // comment marks "not in classic".
        const snd = zeroDamageHitSound({
          weapon: playerWeapon.strikingWeapon, arrowHit: false,   // DISC10-E: :611's strikingWeapon - the hand's item, null for the beast's claws
          parrySounds: !!ENEMY_BASICS[foe.mobileType]?.parrySounds, roll: Math.random(),
        });
        if (snd?.at === 'enemy') audio.play3d(snd.sound, foe.ai.feet, 1.1, { maxDistance: 16 });
        else if (snd) audio.playOneShot(snd.sound, 1.1);
        // AUDIT 58: ...and the swing still ENRAGES what it touched.
        // WeaponManager.cs:630's HandleAttackFromSource sits after the
        // damage fork closes (:615), so a connecting swing that lost
        // the roll wakes a pacified foe and the whole room with it.
        // Only the aggro half runs here: :627's DecreaseHealth(0)
        // changes nothing, and the knockback/hurt the damage door also
        // carries lives INSIDE WeaponManager's `damage > 0` arm.
        attackFromPlayer(foe, playerFeet);   // AUDIT WORLD6b-iii(e) C2: through the one door - a puppet's zero blow goes to the host (WORLD2 B13), and no layout of mine wakes for it
        playerWeaponHitEntity(playerEntity, foe.entity, { mobileType: foe.mobileType });   // DISC10-D H1: OnWeaponHitEntity, after DecreaseHealth and HandleAttackFromSource (WeaponManager.cs:627-635) - every connect, the zero-damage one too
        continue;
      }
      // EnemySounds.PlayHitSound at the struck foe, weapon-aware
      audio.play3d(hitSoundFor(playerWeapon.strikingWeapon), foe.ai.feet, ENEMY_HIT_VOLUME, { maxDistance: 16 });   // rides the foe's source shape; DISC10-E: PlayHitSound(currentRightHandWeapon) (WeaponManager.cs:563-566) - the HAND's item, so the beast's claws strike with the bare hand's sound
      // WeaponManager.cs:569-573 - the splash sits right beside the hit
      // sound and takes the struck foe's OWN BloodIndex. DFU has a
      // raycast impactPosition here; the port resolves melee by yaw
      // cone and distance, so the body centre (DFU's own no-raycast
      // formula, EnemyAttack.cs:326-328) stands in.
      hitEffects?.showBloodSplash(ENEMY_BASICS[foe.mobileType]?.bloodIndex ?? 0,
        bloodCentre(foe.ai.feet, foe.ai.height), null, bloodHit(damage, foe.entity, { fromPlayer: true, weapon: playerWeapon.strikingWeapon, swing: playerWeapon.machine?.state, forward: lookDir }));   // BLOOD1b: the blow drives the ladder, and only a PLAYER'S warhammer takes the heavy branch
      // C2-slice (combat-17): a damaged CLASS foe cries out 40% of
      // the time (heavyDamage = a quarter of max health in one hit).
      const pain = enemyPainVoice(foe, damage);
      if (pain && pain.clip >= 0) audio.play3d(pain.clip, [foe.ai.feet[0], foe.ai.feet[1] + 0.9, foe.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + pain.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
      damageFoe(foe, damage, playerFeet, lookDir);   // C15: the attack ray knocks back; rigs also stagger (HurtFront/Back)
      playerWeaponHitEntity(playerEntity, foe.entity, { mobileType: foe.mobileType });   // DISC10-D H1: OnWeaponHitEntity, after DecreaseHealth and HandleAttackFromSource (WeaponManager.cs:627-635) - every connect, the zero-damage one too
    }
    // combat-14: the no-entity fallback - only a swing that connected
    // with NO foe may bash the environment.
    if (!hitEnemy && lookDir) envAttack(actions, collider, eye, lookDir, Math.random);
    return hitEnemy;
  }
  // S3b: the classic clock for skill-raise checks - dt * TimeScale
  // (DFU default 12) in minutes; RaiseSkills gates itself at 360.
  // AUDIT 21 F2: a READ-THROUGH on the one world clock. This used to be a
  // private accumulator per built context, so every dungeon entry started
  // the day count over - which made a disease caught underground get
  // LONGER each time you walked out, and re-fired SongManager's "a new day
  // re-picks" on every crawl.
  // LIVED1: and the one clock the dungeon's laws read is the CHARACTER's own -
  // the world's offline (one variable), theirs online, where a rested night,
  // the collapse's hour and a load move it and the world's sky does not. The
  // sky's readers below (the passive specials' sunlight, the needs' hour and
  // month, the music's day) read the world's clock by name.
  const classicMinutesRef = {
    get value() { return ownMinutes(); },
    set value(v) { setOwnMinutes(v); },
  };
  // V2c: THE SUNLIGHT SEAM, the dungeon's answers - always inside,
  // always a dungeon, never holy (PlayerEnterExit's holy pair is a
  // BUILDING check), swimming from the live activity report. Built by
  // worldModes' dungeon branch OR the standalone dungeon scene; the
  // previous registration (worldModes') is restored in destroy(), the
  // death-presenter shape.
  const _prevPassiveHost = setPassiveSpecialsHost({
    now: () => Math.floor(skyMinutes()),   // LIVED1: the sunlight seam reads the sky; TIME1: its own clock
    isInside: () => true,
    inDungeon: () => true,
    isHolyPlace: () => false,
    isSwimming: () => !!_activity.swimming,
  });
  async function ensureMissileBatch(m) {
    if (m.batch !== null) return;
    m.batch = false;   // in-flight guard
    // FIELD-GUN14: a shot with its own flat names it; a spell asks its
    // element, as it always has. ORB_RECORD is 0, which is also the
    // record every spell missile flies on, so the two agree by
    // construction rather than by coincidence.
    const archive = m.flatArchive ?? missileArchive(m.spell.element);
    const record = m.flatArchive ? ORB_RECORD : 0;
    const t = await getTexture(archive);
    if (!t) return;
    // The arrow's bug, twice more: this is async and `m.batch = false`
    // is the in-flight guard, so a missile that retires while its
    // texture warms leaves retireMissile's splice nothing to find -
    // and then the microtask pushes a batch for a DEAD missile that
    // nothing ever removes, drawn at its fire position for the rest of
    // the scene. Check before publishing.
    if (m.dead) { m.batch = null; return; }
    uploadRecord(archive, record);
    // FIELD-GUN17: the FOURTH HOST samples the orb too - its missiles
    // never go through hitEffects' pool, so without this the dungeon's
    // flash would stay white while the other three took the orb's own
    // colour. `noteOrbColour` is once-only, so whichever host fires
    // first answers for all of them.
    if (m.flatArchive) noteOrbColour(t.getColor32(t.getDFBitmap(record, 0), 0));
    // FIELD-GUN18 (Mac: "shrink the projectile orb slighty"). The
    // FOURTH HOST again: its missiles build their own batch and never
    // touch hitEffects' pool, so the pool's `scale` cannot reach them
    // and the same multiply has to be written here. The SPELLS are
    // untouched - this is the orb's arm, gated on the same
    // `flatArchive` the picture and the colour fork on.
    const raw = billboardSize(t, record);
    const size = m.flatArchive ? { w: raw.w * ORB_SCALE, h: raw.h * ORB_SCALE } : raw;
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, record, size, [centredBase(m.firePos, size)]);   // FIELD-GUN20: a missile is CENTRED on its position (DaggerfallMissile.cs:601-602, no AlignToBase) - the base is half a height under it, for the orb and every spell
    // FA1 slice 2: the missile flat ANIMATES while it flies -
    // DaggerfallMissile.cs:605 sets BillboardFramesPerSecond (5) on the
    // billboard it makes at :601. Frozen on frame 0, a fireball was a
    // photograph of a fireball.
    armFlatAnim(m.batch, t, archive, record, flatAnims, uploadRecordFrame, { fps: MISSILE_FPS });
    billboardBatches.push(m.batch);
  }
  /** AUDIT 26 F033 - DaggerfallMissile.DoCollision's impact flash
   *  (:364-370). Element None (an arrow) and ByTouch both skip it, so
   *  the gate lives here rather than at the three call sites. */
  function showImpactFlash(m, pos) {
    if (!m.spell || m.spell.element == null || m.spell.rangeType === 1) return;   // rangeType 1 = TargetTypes.ByTouch
    hitEffects?.showImpactFlash(missileArchive(m.spell.element), pos);
  }
  function retireMissile(m) {
    if (m.draw && m.draw.object) {
      const di = dynamicDraws.indexOf(m.draw);
      if (di >= 0) dynamicDraws.splice(di, 1);
    }
    if (m.batch) {
      flatAnims.remove(m.batch);   // FA1: a destroyed batch must not keep a clock
      const bi = billboardBatches.indexOf(m.batch);
      if (bi >= 0) billboardBatches.splice(bi, 1);
      renderer.destroyBillboardBatch(m.batch);
    }
    m.dead = true;
  }
  /** AUDIT 68 S19-restore-missiles-survive: every flight THIS context owns - enemy spells, both sides' arrows, trap
   *  bolts, peers' shafts - and the trap casts still queued. A same-dungeon load and the teardown end them; hostMagic's
   *  clearMissiles reaches the player's spells alone. Dead before freed, so a missile whose archive is still warming
   *  mints nothing afterwards (ensureMissileBatch's m.dead check). */
  function clearLocalMissiles() {
    for (const m of missiles) retireMissile(m);
    missiles.length = 0;
    _pendingCasts.length = 0;
  }
  function updateMissiles(dt, playerFeet, playerHeight = CAPSULE_HEIGHT) {
    while (_pendingCasts.length) { const c = _pendingCasts.shift(); fireCast(c.index, c.origin); }
    if (!missiles.length || !playerFeet) return;
    const target = [playerFeet[0], playerFeet[1] + playerHeight / 2, playerFeet[2]];   // AUDIT 62 F21 (review): the PLAYER arm of the aim is the foe arm's law - LastKnownTargetPos is target.transform.position (DaggerfallMissile.cs:571-581 -> EnemySenses.cs:453), and the player's is feet + the LIVE height/2 (no controller centre offset; PlayerHeightChanger.cs:477-478 plants the capsule bottom and moves the transform by heightChange/2). The hardcoded 0.9 made a crouched player a standing target.
    for (const m of missiles) {
      if (m.dead) continue;
      if (!m.arrow || m.flatArchive) ensureMissileBatch(m);   // arrows render as the 99800 model, not an element billboard - unless the weapon brought its own flat (FIELD-GUN14)
      if (!m.dir) {   // verbatim: normalized (target - object), locked at fire time
        // MT-iv: DaggerfallMissile aims at its CASTER'S TARGET, which
        // was the player and only the player until targeting armed.
        // An enemy caster duelling another foe now throws at that
        // foe. (The player's own missiles keep the player's aim: they
        // are fired down the crosshair, not at a target.)
        const ct = (m.casterFoe ?? m.shooterFoe)?.ai?.target;
        // ...and the missile REMEMBERS whom it was loosed at, so the
        // impact fork below picks its arm without re-reading a target
        // that may have moved on mid-flight (DFU locks direction at
        // fire time; the port locks the victim with it).
        m.aimFoe = (foeDeps && ct && (!foeDeps.isPlayerTarget(ct) || ct.isPeer)) ? ct : null;   // WORLD3: a peer target is aimed at too (targetAimPoint's peer arm)
        // AUDIT 62 F21: LastKnownTargetPos is the target's TRANSFORM
        // (DaggerfallMissile.cs:571-581 -> EnemySenses.cs:453/:465) -
        // feet + centreOffset for a foe, feet + the LIVE height/2 for
        // the player. enemyTargets.targetAimPoint is the ONE body of that law; this host carried its own copy and converted only the foe arm of it.
        const aim = m.aimFoe ? foeDeps.targetAimPoint(m.aimFoe, playerFeet, playerHeight) : target;
        const d = [aim[0] - m.pos[0], aim[1] - m.pos[1], aim[2] - m.pos[2]];
        const l = Math.hypot(...d) || 1;
        m.dir = [d[0] / l, d[1] / l, d[2] / l];
      }
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { retireMissile(m); continue; }
      const step = MISSILE_SPEED * dt;
      const { unit: _unit, reach } = missileReach(m.dir, step);   // ROAD-H tail: DaggerfallMissile.cs:333/:337-339's reach along the normalised direction
      // TACT1: cover stops a bolt, and an area spell bursts on it; AUDIT TACT B5: by touch, the bodies before it tested first
      const _len = Math.hypot(m.dir[0], m.dir[1], m.dir[2]) || 1;
      const _cs = coverStep(coverDistance(collider, m.pos, _unit, reach), collider.raycast(m.pos, _unit, reach), reach, reach - step * _len, step * _len);
      const hitWall = _cs.stop;
      if (Number.isFinite(hitWall) && hitWall <= reach) {
        // AUDIT 23 (magic-2) - DaggerfallMissile.cs:399-402 DoCollision:
        // an AreaAtRange payload explodes AT THE IMPACT POINT whatever
        // was struck; the port retired wall hits with no payload.
        const impact = [m.pos[0] + _unit[0] * hitWall, m.pos[1] + _unit[1] * hitWall, m.pos[2] + _unit[2] * hitWall];   // ROAD-H tail (review): the collider answers in the RAY's own units, and the ray is `_unit` - `m.dir` would scale the impact point by |dir| (`colliderPosition += direction.normalized * hitInfo.distance`, DaggerfallMissile.cs:347)
        if (m.spell?.rangeType === 4) {
          const wCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
          magic.explodeAt(impact, m.spell, m.casterLevel ?? effectiveLevel(playerEntity), playerFeet, wCaster, { playerHeight });   // ROAD-H H2: the blast's OverlapSphere meets the player's LIVE capsule
        }
        // AUDIT 26 F033: DoCollision swaps the billboard to record 1 of
        // the missile's own element archive, one-shot at 15fps
        // (:364-370) - gated on `elementType != None && targetType !=
        // ByTouch`, so arrows never flash and neither does a touch cast.
        // DFU flashes on ANY wall hit, so `impact` is hoisted out of
        // the AoE branch above rather than computed inside it.
        showImpactFlash(m, impact);
        retireMissile(m);
        continue;
      }
      const _adv = step * _cs.advance;   // AUDIT TACT B5: no further than cover's touch
      m.pos[0] += m.dir[0] * _adv; m.pos[1] += m.dir[1] * _adv; m.pos[2] += m.dir[2] * _adv;
      // The batch was built ONCE at the fire position; flight rides
      // the batch's origin uniform (zero GL churn - the same thrash
      // class the engine audit killed stays killed).
      if ((!m.arrow || m.flatArchive) && m.batch) m.batch.origin = [m.pos[0] - m.firePos[0], m.pos[1] - m.firePos[1], m.pos[2] - m.firePos[2]];   // FIELD-GUN14: an orb flies the way a spell does
      if (m.arrow) {
        // FIELD-GUN14: ...and it is NOT also a mesh. The flat is the
        // whole picture; fetching 99800 beside it would draw a shaft
        // through the middle of the orb.
        if (!m.flatArchive) ensureArrowModel(m);
        if (m.draw && m.draw.object) m.draw.object.matrix = arrowMatrix(m);
        // SPELLFX1: A PEER'S SHAFT, DRAWN - it stops on me or a foe and applies nothing (their game dealt it)
        if (m.visual) {
          if ((playerFeet && missileHitsCapsule(m.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS)) || foes.some((f) => !f.dead && missileHitsFoe(m.pos, f))) retireMissile(m);
          continue;
        }
        if (m.fromPlayer) {
          // WB4b: the court's boss meets a shaft with the whole of his body (his own radius) - the one player-arrow law
          // against his stand-in, the number to the relay; the ward turns it
          const boss = gateBossBody();
          if (boss && missileHitsCapsule(m.pos, boss.ai.feet, boss.ai.height, boss.ai.radius)) {
            if (boss.warded) wardTurns(boss);
            else playerArrowHitFoe(m, boss, { playerEntity, playerWeapon, playerFeet, audio, hitEffects, say: (l) => hudText.add(l), dealDamage: (t, d) => landOnBoss(boss, d, HIT_KINDS.Shaft) });
            retireMissile(m);
            continue;
          }
          // ARENA4: a shaft meets my opponent on a relay's sand by their whole body - the number to the referee
          const rv = arenaRivalBody();
          if (rv && missileHitsCapsule(m.pos, rv.ai.feet, rv.ai.height, rv.ai.radius)) {
            nextArenaQ();   // ARENA4b: each shaft its own blow
            playerArrowHitFoe(m, rv, { playerEntity, playerWeapon, playerFeet, audio, hitEffects, say: (l) => hudText.add(l), dealDamage: (t, d) => landOnRival(rv, d, 'arrow') });
            retireMissile(m);
            continue;
          }
          // WB9c: a shaft meets a crystal by its whole body - the one player-arrow law against its stand-in (no blood)
          const cr = gateCrystalBodies().find((q) => missileHitsCapsule(m.pos, q.ai.feet, q.ai.height, q.ai.radius));
          if (cr) {
            // AUDIT WB11 W2: no backstab - a crystal faces nowhere (its `yaw` 0 made every shaft from its -z side one)
            playerArrowHitFoe(m, cr, { playerEntity, playerWeapon, playerFeet: null, audio, hitEffects: null, say: (l) => hudText.add(l), dealDamage: (t, d) => landOnCrystal(cr, d, HIT_KINDS.Shaft) });
            retireMissile(m);
            continue;
          }
          // WB11c: a shaft meets one of his host by its whole body - the one player-arrow law against its stand-in
          const hb = gateHostBodies().find((q) => missileHitsCapsule(m.pos, q.ai.feet, q.ai.height, q.ai.radius));
          if (hb) {
            // AUDIT WB11 W2: no backstab, as no swing on one has (its `yaw` 0 is no facing - every shaft from its -z side was
            // a backstab, x3 and a Backstabbing use); W5: its blood laddered against its own whole (`bloodOf`)
            playerArrowHitFoe(m, hb, { playerEntity, playerWeapon, playerFeet: null, audio, hitEffects, say: (l) => hudText.add(l), dealDamage: (t, d) => landOnHost(hb, d, HIT_KINDS.Shaft) });
            retireMissile(m);
            continue;
          }
          for (const f of foes) {
            if (f.dead || f.companion != null) continue;   // AUDIT CC-B1: the player's shaft flies past a companion (the street's and a building's spare him already)
            if (missileHitsFoe(m.pos, f)) {   // ROAD-H tail: DaggerfallMissile.cs:339's SphereCast meets the foe's CAPSULE (REVIEW 2026-09-05 had its centre as a point)
              nextArenaQ();   // ARENA4b: each shaft its own blow to the referee (a relay's fighter's puppet - damageFoe's lane)
              // AUDIT 39 (#64) / THE FOUR HOSTS RULE - SHIPPED (wave D):
              // this host was the FOURTH BODY of the player-arrow law
              // and is now the fourth CALLER. combat/arrowFlight.js's
              // playerArrowHitFoe is the one copy world.js:26427,
              // exterior.js:5589 and worldModes.js:9090 already ran;
              // the flag said the divergence would bite and it already
              // had. This copy splashed at the ARROW TIP
              // (`[m.pos[0], m.pos[1], m.pos[2]]`) on the claim that
              // "the missile's own position IS DFU's impactPosition".
              // It is not: AssignBowDamageToTarget's player arm hands
              // WeaponDamage `hitTransform.position`
              // (DaggerfallMissile.cs:679-687) - the struck entity's
              // own transform origin, which is `foe.ai.feet` - and
              // WeaponManager.cs:568-571 passes whatever it got
              // straight to ShowBloodSplash. Only the MELEE callers
              // pass a contact point (WeaponManager.cs:1054
              // ClosestPoint, :1068 hit.point). AUDIT 39r/R16 fixed
              // the shared copy; this one kept the bug for want of a
              // call. Everything else the block carried - the swing
              // mods, the backstab arc, the poisoned shaft, the
              // equipment-break line, the hit sound before the pain
              // voice, the recoverable Arrow - is that function's own
              // body now, verbatim.
              playerArrowHitFoe(m, f, {
                playerEntity, playerWeapon, playerFeet,
                dealDamage: (t, d) => damageFoe(t, d, lastPlayerFeet, m.dir, { kind: 'arrow' }),   // WORLD2: the kind rides the hit; C15: arrows knock along their flight; MT-iv: the player arm keys on the feet, so an arrow kill reverts a struck ally too
                audio,
                hitEffects,
                say: (l) => hudText.add(l),   // C-slice: equipment breaks speak
                onInflictPoison: (att, tgt, pt) => poisonFoe(f, pt),   // C2-slice (combat-11): a poisoned arrow doses ITS mark; WORLD6b-iii(e): through the one poison door (a puppet's rides the hit)
                // AUDIT 58: WeaponManager.cs:630 runs for every shaft that
                // CONNECTED, damage or none.
                onAttackFromPlayer: (t, landed) => attackFromPlayer(t, lastPlayerFeet, 'arrow', landed),   // AUDIT WORLD6b-iii(e) C2: the one door, the shaft's kind on the zero blow (its Arrow lands in the host's copy)
              });
              retireMissile(m);
              break;
            }
          }
        } else {
          // MT-iv: BowDamage's OWN two-arm split (EnemyAttack.cs:
          // 134-148) - `if (Target == player) ApplyDamageToPlayer else
          // ApplyDamageToNonPlayer(weapon, direction, bowAttack: true)`.
          // Without this arm an arrow AIMED at another foe would fly
          // through it and land nothing, which is worse than the
          // pre-MT behaviour of never aiming there at all.
          //
          // ROAD-H tail (review): that split is the DAMAGE gate, not
          // the CONTACT gate, and the two were one `else if` chain -
          // so a shaft loosed at another foe was TRANSPARENT to the
          // player and to every bystander. An enemy missile casts with
          // the DEFAULT layer mask (:250-253, which keeps the Player
          // layer a player's own missile drops at :263), so :337 meets
          // whatever collider is first IN SPACE and DoCollision
          // destroys the shaft there (:388-396); only then does
          // AssignBowDamageToTarget ask whether the struck entity is
          // `caster.GetComponent<EnemySenses>().Target` (:669) before
          // it calls BowDamage. A shaft that meets the wrong body
          // STOPS on it, pays nothing and recovers no Arrow. The
          // player is tested first, as the shared flight's own arm
          // does (combat/arrowFlight.js's player test precedes its foe
          // sweep); the shooter cannot feather itself on the release
          // frame.
          const struckPlayer = !!playerFeet && missileHitsCapsule(m.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS);   // the player's CAPSULE, the same SphereCast (DaggerfallMissile.cs:339) the foe arm gets - at the player's OWN radius (AUDIT 65 CV-2)
          let struckFoe = null;
          if (!struckPlayer) {
            for (const f of foes) {
              if (f.dead || f === m.shooterFoe) continue;
              if (missileHitsFoe(m.pos, f)) { struckFoe = f; break; }
            }
          }
          if (struckFoe && struckFoe === m.aimFoe) {
            const af = m.aimFoe;
            if (m.shooterFoe && foeDeps) {
              applyDamageToNonPlayer(m.shooterFoe, af, {
                weapon: m.weapon, direction: m.dir, bowAttack: true, rolls: Math.random,
                calculateAttackDamage: foeDeps.calculateAttackDamage,
                dealDamage: (tt, d) => tt.hurtFromFoe?.(d, m.dir, m.shooterFoe ?? null),
                audio, hitEffects,
                // AUDIT 58: FormulaHelper.cs:691-696 has NO player gate -
                // a poisoned foe blade doses the foe it strikes, on DFU's
                // own target (the struck entity). Without the hook the
                // formula still cleared the dose, so the blade was spent
                // and nothing was poisoned.
                onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),
                say: (l) => hudText.add(l),   // C-slice: equipment breaks speak (ItemBreaks pops for any owner)
              });
            }
            // :145-147 - the recovered Arrow goes into the TARGET's
            // items, not the player's. That line credited the player
            // unconditionally, which only stayed right while the
            // player was the only thing an arrow could reach.
            addItem(af.entity.items ??= [], bowDamageArrow());   // MAC-N1: minted, not a bare literal
            retireMissile(m);
          } else if (struckPlayer && !m.aimFoe) {
            const shooter = m.shooterFoe;
            // C2-slice (AUDIT 23 combat-10): an arrow reaching the
            // player rides the same ApplyDamageToPlayer the melee
            // swing does (BowDamage :141) - so the Dodging tally
            // fires here too, hit roll or no.
            tallySkill(playerEntity, SKILLS.Dodging, 1);
            const dmg = foeDeps && shooter ? _weighHit(shooter, foeDeps.calculateAttackDamage(shooter.entity, playerEntity, {
              weapon: m.weapon,   // AUDIT 18: target group derived from the entity (isPlayer -> Humanoid)
              onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),   // S19b: poisoned arrows
              say: (l) => hudText.add(l),   // C-slice
            })) : 0;   // PSCALE1: an arrow as a blow is - weighed once, so the flash and the cry below read what I took (AUDIT PSCALE1 DOORS-3)
            hurtPlayer(dmg);
            // AUDIT 24 (wave 46): an enemy ARROW reaches the player
            // through BowDamage -> ApplyDamageToPlayer ->
            // SendDamageToPlayer, exactly as a melee blow does - so it
            // owes the same three things. This site did NONE of them:
            // no hit sound (world.js's equivalent has always played
            // one), no flash, no cry. The weapon is a bow, so it is
            // PlayWeaponHitSound's family, NOT PlayArrowSound - which
            // has no sender anywhere in the DFU tree and is dead.
            if (dmg > 0) {
              audio.playOneShot(hitSoundFor(m.weapon), PLAYER_HIT_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:330-344 - the blow that lands ON the player is volumeScale 1, not EnemySounds' 1.1
              flashPlayerDamage(dmg);   // BA1: RemoveHealth carries the amount
              playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
            } else if (m.shooterFoe) {
              // AUDIT 26 F053: ApplyDamageToPlayer's else arm rings
              // PlayMissSound on the ENEMY's own source
              // (EnemyAttack.cs:297-298) - the port's melee arm has
              // this else and the arrow arm did not, so a dodged
              // arrow was silent.
              const sf = m.shooterFoe;
              audio.play3d(enemyMissSound(m.weapon), [sf.ai.feet[0], sf.ai.feet[1] + 0.9, sf.ai.feet[2]], 1, { maxDistance: 16 });
            }
            addItem(playerEntity.items, bowDamageArrow());   // MAC-N1: minted, not a bare literal
            surfacePlayer();
            retireMissile(m);
          } else if (struckPlayer || struckFoe) {
            retireMissile(m);   // :669 refused the damage - the shaft is spent on the body it met, and no Arrow is recovered (:145-147 rides BowDamage, which never ran)
          }
        }
        continue;
      }
      // M3: player SPELL missiles fly in the engine now; this loop
      // carries enemy spells (and, upstream, both sides' arrows).
      // MT-iv: an enemy SPELL missile aimed at another foe resolves
      // on THAT foe - the same fork the arrow arm takes.
      if (m.aimFoe && !m.aimFoe.dead) {
        const af = m.aimFoe;
        if (missileHitsFoe(m.pos, af)) {
          const fCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
          if (m.spell.rangeType === 4) magic.explodeAt(m.pos, m.spell, m.casterLevel ?? effectiveLevel(playerEntity), playerFeet, fCaster, { playerHeight });   // ROAD-H H2
          else applySpell(m.spell, m.casterLevel ?? effectiveLevel(playerEntity), af.entity, foeSinks(af, false), Math.random, fCaster);   // AUDIT WORLD2 B7: a foe's missile
          showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]);   // F033
          retireMissile(m);
        }
        continue;
      }
      if (!m.aimFoe?.isPeer && missileHitsCapsule(m.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS)) {   // the player's capsule at the player's own radius, DaggerfallMissile.cs:339 (AUDIT 65 CV-2); WORLD3: a cast at a peer pays nothing here
        // S16: enemy missiles carry their caster (level + the
        // transfer heal-back pair); trap casts stay casterless (DFU
        // action casters are null) on the S4b player-level shape.
        const mCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
        if (m.spell.rangeType === 4) magic.explodeAt(m.pos, m.spell, m.casterLevel ?? effectiveLevel(playerEntity), playerFeet, mCaster, { playerHeight });   // ROAD-H H2
        else magic.applySpellToPlayer(m.spell, m.casterLevel ?? effectiveLevel(playerEntity), mCaster);
        showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]);   // F033
        retireMissile(m);
      }
    }
    // AUDIT 24 (the seven-slice sweep): EVERY ALLOCATION HAS AN OWNER,
    // and so does every LIST ENTRY. retireMissile frees the batch and
    // sets m.dead, but nothing removed the entry - so `missiles` grew
    // for the whole dungeon session and this loop walked every corpse
    // of every arrow and trap bolt, every frame, for ever. hostMagic
    // has had exactly this line all along (:318-320); the dungeon's
    // sibling loop never got it. Safe against the in-flight batch
    // microtask, which publishes only `if (!gpu || m.dead) return`
    // against the object it closed over, not against this list.
    for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  }

  /** WORLD2: a foe's death and un-death - ONE door for the save's restore and the host's stream: dead spawns the
   *  corpse (the record's own items are the corpse's), un-dead frees the corpse flat by its foe. */
  function setFoeDead(f, dead) {
    if (dead) { if (!f.dead) { f.dead = true; spawnCorpse(f); } return; }
    if (!f.dead) return;
    f.dead = false;
    f._diedAt = null;   // WORLD8
    freeCorpse(f);
    const pi = foes.indexOf(f);   // AUDIT WORLD7/8 C12: the body's loot record goes with the body - the next death's corpse is a new container, its claim not refused as already spoken
    if (pi >= 0) { _lootSeen.delete(`corpse:${pi}`); _lootAt.delete(`corpse:${pi}`); }
    if (f._encId != null) { _lootSeen.delete(`enc:${f._encId}`); _lootAt.delete(`enc:${f._encId}`); }   // REST-SYNC: a shared body's, by the room's number
    renownFoeRevived(f);   // AUDIT RENOWN1 GAME-10: a foe that stands up again is a new fight - it can pay again
    f._killedBy = null;   // AUDIT SET P-M3: and its next death names its own striker
    f._trapBy = null; f._trapSent = false;   // STRIKE-SHARED: and its next death names its own trapper
  }

  /** WORLD2: one PUPPET frame - the pose from the stream (the feet eased toward the streamed feet over the stream's
   *  interval, a far jump snapped; the yaw set), the walk while the streamed feet move, the hurt one-shot after a
   *  health drop, the attack edge once per streamed count with its ranged bit; the mobile's damage latches cleared
   *  unconsumed (a puppet lands no blow of its own). Returns the strike edge for the mobile arm. */
  function puppetStep(f, dt) {
    const p = f._pup;
    let edge = false;
    f._castPending = false;
    f._pupTarget = null; f._pupMine = false;
    if (p) {
      const feet = f.ai.feet, t = p.feet;
      const dx = t[0] - feet[0], dy = t[1] - feet[1], dz = t[2] - feet[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > PUPPET_SNAP * PUPPET_SNAP) { feet[0] = t[0]; feet[1] = t[1]; feet[2] = t[2]; }
      else { const k = Math.min(1, dt / PUPPET_EASE_S); feet[0] += dx * k; feet[1] += dy * k; feet[2] += dz * k; }
      f.ai.yaw = p.yaw;
      f.ai.moving = p.moving || d2 > PUPPET_STILL * PUPPET_STILL;
      f.ai.hurtKnock = puppetHurtStep(p, f.mobile, performance.now() / 1000);   // HITFLASH1: held until the sprite can take it (a swing ate the one frame)
      if (p.strike != null) { edge = true; if (f.attack) f.attack.firedRanged = p.strike === 'ranged'; p.strike = null; }
      // WORLD3: whose blow this puppet's is - the streamed target ('.' the host, an id a peer, '' none), and whether
      // it is ME: then the mobile's damage frame and its shoot marker are mine to resolve (the mobile arm), a cast
      // is the spell itself at me; at another the shaft is a cosmetic one and the cast its one-shot alone
      f._pupTarget = p.target === '.' ? (f._ownFrom ?? _foesFrom) : (p.target || null);   // QUEST-PARTY phase 3c: '.' is the stream's owner - a quest foe's own
      const me = opts.selfId?.() ?? null;
      f._pupMine = f._pupTarget != null && me != null && f._pupTarget === me;
      // AUDIT WORLD3 D2: a streamed target IS the host's word that this foe is fighting somebody. My own copy's
      // hostility is not on the wire and my blows never raise it (damageFoe diverts before handleAttackFromPlayer),
      // so a passive-marker foe - a castle guard - stayed pacified-BLIND here: _senses refuses sight for a
      // non-hostile record, meleeHitConnects then read inSight false, and every blow the host landed on me became a
      // miss. The host's word wins.
      if (f._pupTarget != null && f.ai.isHostile === false) f.ai.isHostile = true;
      if (p.cast != null) {
        const sp = f._pupMine ? (spellsByIndex?.get(p.cast) ?? null) : null;
        if (sp) castEnemySpell(f, sp, true); else f._castPending = true;
        p.cast = null;
      }
    } else { f.ai.moving = false; f.ai.hurtKnock = false; }
    return edge;
  }

  /** WORLD2: the host's foes frame out - every layout foe whose streamed state changed since its last frame (every
   *  one when full, so a dropped frame heals), or null when none did. Feet to the centimetre, yaw to the milliradian,
   *  so a foe standing still streams nothing. The record: i the index, f the feet, y the yaw, h the health, d dead,
   *  a the attack count with the ranged bit low, m moving. */
  function foesFrame(full = false) {
    if (!_authority) return null;
    _maxLeft = full ? 0 : FOE_MAX_PER_FRAME;   // AUDIT SETS M1: a full frame's maxima are paid once it is built (fitMaxima); a delta pays a few owed
    const out = [];
    for (let i = 0; i < _layoutFoes; i++) {
      const f = foes[i];
      if (!f) continue;
      const r = roomRecord(f, i, full);
      if (r) out.push(r);
    }
    // REST-SYNC: the room's encounters ride the same frame, numbered by the room (`i` their id); a full frame lists them
    // all (`xf`), so a joiner takes down the ones the host no longer has
    const shared = [];
    for (const [id, f] of _sharedById) if ((f.dead && !f.corpse) || !foes.includes(f)) _sharedById.delete(id);   // Destroy()ed or gone: the room forgets it, and a full frame takes every puppet of it down
    for (const f of [..._sharedById.values()].sort((a, b) => (a.dead ? 1 : 0) - (b.dead ? 1 : 0))) {   // the standing before the bodies
      if (shared.length >= SHARED_FOES_MAX) break;
      const r = roomRecord(f, f._encId, full);
      if (r) shared.push(r);
    }
    // AUDIT WORLD34 B3: a FULL frame goes even when it carries nothing - it is the seat's heartbeat (FOES_STALE_MS
    // reads it), and a layout with no foes to say left every joiner flipping to its own authority six seconds in
    if (!out.length && !shared.length && !full) return null;
    const frame = { n: ++_foesSeq, k: _locationKey, f: out };   // k: the dungeon (AUDIT WORLD2 C8: never another dungeon's foes by index)
    // REST-SYNC: the encounters ride the room the layout's run leaves under the wire's one cap - a frame over
    // FOES_FRAME_MAX is refused WHOLE (net/online.js sendFoes), and the largest elite layout's worst case all but fills
    // it (test/elitepscale.test.js). What does not fit waits for a later frame (its key forgotten, so it goes again),
    // and a frame that could not carry them all does not say it lists them whole.
    let n = 0;
    if (shared.length) {
      let room = FOES_FRAME_MAX - FOES_FRAME_SLACK - JSON.stringify(frame).length;
      for (const r of shared) { const len = JSON.stringify(r).length + 1; if (len > room) break; room -= len; n++; }
      for (const r of shared.slice(n)) { const f = _sharedById.get(r.i); if (f) { f._sentKey = null; f._maxSent = undefined; } }   // AUDIT SETS M1: and its maximum, if it carried one, is owed
      if (n) frame.x = shared.slice(0, n);
    }
    if (full && n === shared.length) frame.xf = 1;
    if (full) fitMaxima(frame, [...out.map((r) => [r, foes[r.i]]), ...(frame.x ?? []).map((r) => [r, _sharedById.get(r.i)])]);
    return frame;
  }
  /** AUDIT SETS M1: a foe's MAXIMUM health (`k`) rides its record while it is owed - a guest's copy is rolled at the
   *  guest's own level, so "under half its health" read the host's health against the guest's roll (Run Them Down).
   *  Every record carrying it does not fit the largest elite layout's worst case under the wire's one cap
   *  (test/restsync.test.js), so a full frame owes every foe's again and pays what the room its records leave holds (a
   *  joiner it greets learns them at once), and a delta pays at most FOE_MAX_PER_FRAME owed ones - a foe that changed
   *  nothing going for its maximum alone. */
  const FOE_MAX_PER_FRAME = 12;
  let _maxLeft = 0;
  /** AUDIT SETS M1: the foe's maximum health as the wire says it, or null - a body's is nobody's business. */
  const foeMaxOf = (f) => (!f.dead && Number.isFinite(f.entity.maxHealth) && f.entity.maxHealth >= 1 ? Math.min(FOE_HEALTH_MAX, f.entity.maxHealth) : null);
  /** AUDIT SETS M1: a full frame's maxima, each [record, foe]'s while the frame's room holds its `,"k":N` - what it
   *  cannot hold stays owed. */
  function fitMaxima(frame, pairs) {
    let room = FOES_FRAME_MAX - FOES_FRAME_SLACK - JSON.stringify(frame).length;
    for (const [r, f] of pairs) {
      const max = f ? foeMaxOf(f) : null;
      if (max == null || 5 + String(max).length > room) continue;
      r.k = max; f._maxSent = max; room -= 5 + String(max).length;
    }
  }
  /** WORLD2: one foe's streamed record, or null when nothing it streams changed since its last (every one when full).
   *  `i` the layout's index - REST-SYNC: or a shared encounter's id. */
  function roomRecord(f, i, full) {
    // WORLD3: g the target ('.' the host, an id a peer, '' none), c the cast count with s its spell, x the gender
    // AUDIT SET P-M3: `v` the joiner whose blow killed it, on its death's record - the host applies a joiner's blow
    // (applyHit), so the kill happened HERE and the striker's own door never saw its foe die: a set's "each kill of
    // mine" (the Rampage, Eventide) never fired for a joiner underground. The exterior pool's owner says `slain` to its
    // striker for the same reason (exteriorFoes.js); the host's stream is the room's (OWN1's routed own-hit aside, a
    // blow's lane, not a death's), so the word rides the record every joiner reads, and only the one it names takes it
    // (applyFoeRecord) - for KILLED_BY_MS after the death, never for as long as the body lies (AUDIT FINAL F7)
    const _t = f.ai.target, g = _t?.isPeer ? _t.id : (_t == null ? (f.ai._armedTargeting ? '' : '.') : (_t.isPlayer ? '.' : ''));
    // AUDIT WORLD6b-iii(c) C8: a killing overshoot streamed a NEGATIVE health (WORLD2's bound) onto every joiner's puppet
    // AUDIT ONCRASH1 B4a: and the SENDER obeys the door the reader now applies - `h` is clamped to FOE_HEALTH_MAX as
    // the exterior twin has clamped it since WORLD6b, because an unclamped one would have its whole record refused.
    const r = { i, t: f.mobileType, f: [q2(f.ai.feet[0]), q2(f.ai.feet[1]), q2(f.ai.feet[2])], y: q3(f.ai.yaw), h: Number.isFinite(f.entity.health) ? Math.max(0, Math.min(FOE_HEALTH_MAX, f.entity.health)) : 0, d: f.dead ? 1 : 0, a: f._atkA | 0, m: f.ai.moving ? 1 : 0, g, c: f._castN | 0, s: f._castIdx | 0, ...(f.gender === 'female' ? { x: 1 } : {}) }; if (f.dead && typeof f._killedBy === 'string' && performance.now() - (f._killedAt ?? -Infinity) <= KILLED_BY_MS) r.v = f._killedBy;   // t: the species (AUDIT WORLD2 B5); v: AUDIT SET P-M3 (for KILLED_BY_MS - AUDIT FINAL F7), below; k: AUDIT SETS M1, the host's maximum health
    // AUDIT RENOWN1 GAME-3: a CLASS foe's level, the exterior stream's `l` (AUDIT WORLD6b-ii B2) - every client builds
    // the layout's class foes at ITS OWN level, so a joiner's copy of my level-3 knight was a level-30 knight on a
    // level-30 joiner's screen, and paid it 300 Renown XP for the kill that paid me 30. A monster's level is its
    // species', the same everywhere, and rides nothing.
    if (f.mobileType >= 128 && Number.isInteger(f.entity?.level) && f.entity.level >= 0 && f.entity.level <= FOE_LEVEL_MAX) r.l = f.entity.level;
    if (!f.dead && _sharedFoe(f)) { const n = fightN(f); if (n > 1) r.n = n; }   // AUDIT PSCALE1: how many fight it - every joiner weighs its hits by the host's count
    if (f.dead && typeof f._trapBy === 'string' && performance.now() - (f._killedAt ?? -Infinity) <= KILLED_BY_MS) { r.j = f._trapBy; r.q = f._trapQ | 0; }   // STRIKE-SHARED: whose soul trap was on it as it fell, and its chance - for KILLED_BY_MS, as `v`
    const key = `${r.f[0]},${r.f[1]},${r.f[2]},${r.y},${r.h},${r.d},${r.a},${r.m},${r.g},${r.c},${r.s},${r.n},${r.j},${r.v}`;
    // AUDIT SETS M1: the maximum - every full frame owes it again (and pays it, fitMaxima), a delta pays a few owed
    if (full) f._maxSent = undefined;
    const max = foeMaxOf(f);
    const owesMax = max != null && f._maxSent !== max && _maxLeft > 0;
    if (!full && f._sentKey === key && !owesMax) return null;
    if (owesMax) { r.k = max; f._maxSent = max; _maxLeft--; }
    f._sentKey = key;
    return r;
  }

  /** WORLD2: the host's foes frame in, each record onto its puppet - the target pose for the eased step, the health
   *  (a drop is the hurt one-shot), death and un-death through the one kill door, the attack once per count (a joiner
   *  latches the count it arrives with and replays nothing). A frame older than the last is stale. */
  /** SEAT-HEAL (2026-09-22, a player's report: "I kill a rat, my party member comes in and still sees it alive, and hits
   *  the air for me"). THE SEAT WAS A ONE-WAY LATCH. world.js hands a joiner the foes when the host's stream has been
   *  silent FOES_STALE_MS (a backgrounded host tab stops the frame loop, so it streams nothing), and the heartbeat that
   *  would hand them back (`_foesInAt`) is stamped only when a frame is APPLIED - while `applyFoesFrame` refuses every
   *  frame for as long as this context is the authority. So one silence of six seconds left the joiner in a private
   *  dungeon for good: the rat alive on its screen, its blows applied to its own copy and never sent to the host.
   *  A frame that reaches here is the live seat-holder's word (online.js delivers a world room's foes frame only when
   *  `m.id === host && m.id !== me`), so it is proof the seat is ALIVE: the authority yields and the frame lands as a
   *  puppet's. Only for a NAMED sender and this dungeon's own key; and a frame that does not land (or throws) gives the
   *  seat back, so a stream broken on this client still cannot pose as a heartbeat (AUDIT ONCRASH1 A4). */
  function applyFoes(data, from = null) {
    if (!data || !Array.isArray(data.f)) return false;
    if (!_authority) return applyFoesFrame(data, from);
    if (typeof from !== 'string' || !from || (data.k != null && data.k !== _locationKey)) return false;
    setAuthority(false);
    let landed = false;
    try { landed = applyFoesFrame(data, from); } finally { if (!landed) setAuthority(true); }
    return landed;
  }
  function applyFoesFrame(data, from = null) {
    if (_authority || !data || !Array.isArray(data.f)) return false;
    // AUDIT WORLD2 A1/B2: a new host's counter starts over, and its attack counts are its own - every puppet
    // re-latches (no phantom strike, no frame judged stale by the old host's high-water mark)
    if (from !== _foesFrom) { _foesFrom = from; _foesSeqIn = -1; for (let i = 0; i < _layoutFoes; i++) { const f = foes[i]; if (f) { f._pup = null; f._pupMismatch = false; } } for (const f of _sharedById.values()) f._pup = null; }   // REST-SYNC: the room's encounters re-latch too
    if (Number.isFinite(data.n)) { if (data.n <= _foesSeqIn) return false; _foesSeqIn = data.n; }
    if (data.k != null && data.k !== _locationKey) { if (!_keyMismatchSaid) { _keyMismatchSaid = true; console.warn(`[online] the host streams ${data.k}, this dungeon is ${_locationKey} - the stream is refused`); } return false; }   // C8: another dungeon's stream; AUDIT WORLD34 B2: said once
    for (const r of data.f) {
      if (!r || typeof r !== 'object') continue;
      const i = r.i | 0;
      const f = foes[i];
      if (!f || i >= _layoutFoes) continue;
      if (r.t != null && r.t !== f.mobileType) {   // another species at this index - REBUILT as the room's (WORLD3); the blow goes meanwhile (AUDIT FOES FOE4)
        f._pupMismatch = true;
        // AUDIT WORLD3 E2: the record that triggered the rebuild lands ON the rebuilt foe. The build stands a FRESH
        // record - alive, at full health, at its marker - and the host re-sends this index only on its next full
        // frame (and, once I take the seat, never), so a foe the room knows is dead stood up, and after a handover
        // became my simulation's live foe and went back out to the whole room that way.
        // AUDIT FOES FOE4: and the rebuild is BOUNDED. A refusal (a texture or a career
        // read that fails on this machine alone, a species no art can stand) left the
        // flag set and the host kept re-offering the index - the full frame carries
        // every layout foe every FOES_FULL_MS - so a failing index asked for a fresh
        // build for ever, several times a second, for the life of the dungeon. Past
        // RETYPE_TRIES it stands as it is, said once: the body is wrong and the blows
        // still land, which is the right way round.
        const tries = (_retypeFails.get(i) ?? 0);
        if (tries < RETYPE_TRIES) {
          retypeFoe(i, r.t, GENDER_BIT[r.x === 1 ? 1 : 0]).then((ok) => {
            if (ok) { _retypeFails.delete(i); if (!_authority && foes[i]) applyFoeRecord(foes[i], r); return; }
            const n = (_retypeFails.get(i) ?? 0) + 1;
            _retypeFails.set(i, n);
            if (n === RETYPE_TRIES) console.warn(`[online] the foe at ${i} cannot be rebuilt as species ${r.t} on this client - it keeps the body it has; blows still go to the host`);
          }).catch((e) => console.error('[online] the rebuilt foe could not take the record - the foe stands as it is:', e));   // AUDIT ONCRASH1 A1
        }
        continue;
      }
      f._pupMismatch = false;
      applyFoeRecord(f, r);
    }
    applySharedRecords(Array.isArray(data.x) ? data.x : [], data.xf === 1);   // REST-SYNC
    return true;
  }

  /** REST-SYNC: the host's word on the room's encounters - each record onto its puppet (the layout's door), a new id
   *  stood as a puppet from its first record (the newest record landing on it when the build does), and on a FULL
   *  frame every puppet the host no longer lists taken down. The room's count carries on past every id seen, so a
   *  joiner who takes the seat numbers its own encounters after the host's. */
  function applySharedRecords(list, full) {
    if (_authority) return;
    const seen = new Set();
    for (const raw of list.slice(0, SHARED_FOES_MAX)) {
      const r = validFoeRecord(raw);
      if (!r || r.i < 1) continue;
      seen.add(r.i);
      if (r.i > _sharedSeq) _sharedSeq = r.i;
      const f = _sharedById.get(r.i);
      if (f) {
        if (r.t == null || r.t === f.mobileType) { applyFoeRecord(f, r); continue; }
        dropSharedFoe(r.i, f);   // AUDIT PRE-MERGE 0928 M1: another species by that number (the host's abyss replaced it) stands anew, as the own lane's does
      }
      if (_sharedPending.has(r.i)) { _sharedPending.set(r.i, r); continue; }
      if (r.d === 1 || r.t == null || !r.f || !canStandFoe(r.t)) continue;   // a body never seen standing, or a record that cannot stand one
      _sharedPending.set(r.i, r);
      standSharedPuppet(r).catch((e) => { _sharedPending.delete(r.i); console.error('[online] the room\'s encounter could not stand here:', e); });
    }
    if (full) for (const [id, f] of [..._sharedById]) if (!seen.has(id) && !_sharedPending.has(id)) dropSharedFoe(id, f);
  }
  /** REST-SYNC: one of the room's encounters stood here as a puppet - the build chain's own, where the host's record
   *  says, and posed by the newest record the stream has carried since. */
  async function standSharedPuppet(r) {
    const f = await buildFoeAt({ mobileType: r.t, gender: GENDER_BIT[r.x === 1 ? 1 : 0], x: r.f[0], y: r.f[1], z: r.f[2], spawnDistanceType: 0 }, false, { puppet: true, feetGiven: true });   // DISC28-H: `r.f` is the owner's feet; AUDIT PRE-MERGE 0928 M1: the host's encounter - no spawn of mine (its abyss had it)
    const newest = _sharedPending.get(r.i) ?? r;
    _sharedPending.delete(r.i);
    if (!f) return null;
    if (_ctxDead || _sharedById.has(r.i)) { dropSharedFoe(null, f); return null; }
    f._encId = r.i;
    _sharedById.set(r.i, f);
    if (!_authority) applyFoeRecord(f, newest);
    return f;
  }
  /** REST-SYNC: a puppet the host no longer lists goes - its batch, its body, its place in the pool and the target
   *  machine's memory of it (the restore's own teardown). */
  function dropSharedFoe(id, f) {
    if (id != null) _sharedById.delete(id);
    if (!f) return;
    if (f.batch) { renderer.destroyBillboardBatch(f.batch); f.batch = null; }
    freeCorpse(f);
    f.dead = true;
    dropCandidate(f);
    const at = foes.indexOf(f);
    if (at >= _layoutFoes) foes.splice(at, 1);
  }

  // QUEST-PARTY phase 3c (2026-09-26, Mac: "Dungeons and buildings"): A SHARED QUEST'S FOES RIDE THE ROOM'S OWN LANE.
  // A quest foe past the layout was every client's private object - in no frame, and blind to every peer (the flag at
  // `_layoutFoes`). A quest the party shares now streams its foes on the room's own lane (OWN1) to the party alone,
  // whoever hosts the room: the foe is its SPAWNER'S (the cell's law, WORLD6b) - stepped by it, hunting the party (the
  // party's law, `opts.questShare`); a party member stands it as a puppet through the layout's own record door, strikes
  // it through its owner (`own`, `to`), and counts on its own copy of the quest the injury and the kill it sees. A dying
  // or departing owner names a party heir (AUDIT CONTRIB P1's frame), an owner gone without a word leaves it to the one
  // member the law names (phase 2's), and a MARKER's foe - every copy of the quest stands it at the same spot - stands
  // once for the party (questMarkerYields). A private quest's foe stays its player's own.
  // SUMMON-SYNC (2026-09-27, Mac: "Finish the 2 gaps"): AND A LOOSE STAND RIDES THE SAME LANE, TO THE WHOLE ROOM - a
  // summon's foe (a SoulBound's release, the Sanguine Rose's Daedroth) or a Wabbajack's change, the last foe past the
  // run that was its player's alone. It is its spawner's, as a cell's loose stand is (WORLD6b): named in the frame's
  // `lf`, stood as a puppet by EVERY player in the room (CELL_LOOSE_PUPPETS an owner, the cell's allowance), struck
  // through its owner, hunting every player there, handed at a door out or a death to the player nearest it, and gone
  // with an owner that left without a word (only a shared quest's orphan is adopted, the cell's law).
  let _ownSeq = 0, _ownFrameSeq = 0, _ownGen = 0;
  const _ownPups = new Map();   // `${owner}:${i}` -> a party member's quest foe (or SUMMON-SYNC: anyone's loose stand) stood here as a puppet
  const _ownPending = new Map();   // `${owner}:${i}` -> the newest record while its puppet builds
  const _ownPendLoose = new Set();   // SUMMON-SYNC: the pending keys that are loose stands, for the loose allowance
  const _ownOwners = new Map();   // owner -> { n, at, gen }: its frame counter, its last word, the builds it may land
  const _ownAdopted = new Map();   // AUDIT (pre-merge) D2: `${owner}:${i}` -> the foe of theirs I took (an orphan, or handed me) - theirs again if they stream it alive
  // AUDIT DISC28 QS-J: `${owner}:${i}` -> { from, r, qt } - the last word on a party member's quest foe my unlinked copy
  // refuses to stand (DISC28-J), KEPT for the orphan law alone (keepOwnRecord, pruneOwnOwners): no puppet, nothing drawn,
  // struck, counted or credited; it goes as a stood record goes (a full frame that no longer names it, a death, a heir
  // named elsewhere, its owner's leave, a quiet owner, a room change)
  const _ownKept = new Map();
  const ownPupKey = (from, i) => `${from}:${i}`;
  const ownShare = () => opts.questShare?.() ?? null;
  /** QUEST-PARTY phase 3c: the party's word on MY quest foe past the layout - { q, s } while its quest is shared. */
  const ownQuestTag = (f) => (!f || f._ownFrom != null || isRoomFoe(f) ? null : f.questBehaviour ? (ownShare()?.tagOf?.(f) ?? null) : (f._keptTag ?? null));   // AUDIT (pre-merge) Q3: a taken foe my copy has no quest for keeps its partner's word
  /** SUMMON-SYNC: MY loose stand past the run (spawnLooseFoe's mark) - no quest's, no room's, nobody else's. */
  const ownLoose = (f) => !!f?._loose && f._ownFrom == null && !f.questBehaviour && !isRoomFoe(f);
  /** SUMMON-SYNC: my foe on the room's own lane - a shared quest's (to the party) or a loose stand (to the room). */
  const ownRides = (f) => !!ownQuestTag(f) || ownLoose(f);
  /** QUEST-PARTY phase 3c: whether a blow has landed on my quest foe - the stream's flag 2. */
  const questTouched = (f) => !!f && (!!f._qTouched || (Number.isFinite(f.entity?.maxHealth) && Number.isFinite(f.entity?.health) && f.entity.health < f.entity.maxHealth));   // AUDIT (pre-merge): or a taken foe its owner's word said was touched
  const ownHeirIsMe = (r) => typeof r.e === 'string' && r.e !== '' && r.e === (opts.selfId?.() ?? null);
  /** AUDIT (the pre-merge audit, D2): the owner's last word named ANOTHER heir - that one takes it; the orphan law never. */
  const ownHeirElse = (r) => typeof r.e === 'string' && r.e !== '' && !ownHeirIsMe(r);
  /** QUEST-PARTY phase 3c: MY shared quest's foes out on the room's own lane - every one whose record changed (every one
   *  when full; a handover frame names each live one's heir), with their quest words (`qf`, a marker's flagged 1 and a
   *  touched one 2); null when nothing changed. The records are the layout's own (roomRecord), numbered by me.
   *  SUMMON-SYNC: and my loose stands, on the same numbers, named in `lf`. */
  function ownFrame(full = false, heirOf = null) {
    _maxLeft = full || heirOf ? 0 : FOE_MAX_PER_FRAME;   // AUDIT SETS M1: the layout's law - a whole frame pays once built, a delta a few
    const out = [], src = [];
    for (const f of foes) {
      if (f._ownFrom != null || (f.dead && !f.corpse)) continue;
      const qt = ownQuestTag(f);
      if (!qt && !ownLoose(f)) continue;   // SUMMON-SYNC: a shared quest's foe, or a loose stand - nothing else past the run
      if (f._ownSeq == null) f._ownSeq = ++_ownSeq;
      const r = roomRecord(f, f._ownSeq, full || !!heirOf);
      if (!r) continue;
      if (heirOf && !f.dead) { const h = heirOf(f) ?? null; f._heir = h; if (h) r.e = h; }
      out.push(r); src.push([f, qt]);
    }
    let whole = full || !!heirOf;
    if (out.length > CELL_FRAME_RECORDS_MAX) { for (const [f] of src.slice(CELL_FRAME_RECORDS_MAX)) { f._sentKey = null; f._heir = null; f._maxSent = undefined; } out.length = src.length = CELL_FRAME_RECORDS_MAX; whole = false; }   // the relay's bound: the rest go next frame (AUDIT SETS M1: a maximum with them), and this one lists no whole
    if (!out.length && !whole) return null;
    const qf = [], lf = [], cp = [], cn = [];
    src.forEach(([f, qt], k) => {
      const i = out[k].i;
      if (!qt && f.companion != null && !f.dead) { cp.push(i); cn.push(f.entity?.name ?? ''); }   // AUDIT CC-E1: my companions - the room stands them as my allies; WK-U3: and their names
      if (!qt) { lf.push(i); return; }   // SUMMON-SYNC: a loose stand's number
      const fl = (f._questMarker ? 1 : 0) | (!f.dead && questTouched(f) ? 2 : 0);
      qf.push(fl ? [i, qt.q, qt.s, fl] : [i, qt.q, qt.s]);
    });
    const frame = { n: ++_ownFrameSeq, k: _locationKey, full: whole ? 1 : 0, f: out, ...(qf.length ? { qf } : {}), ...(lf.length ? { lf } : {}), ...(cp.length ? { cp, cn } : {}) };
    if (full || heirOf) fitMaxima(frame, src.map(([f], k) => [out[k], f]));
    return frame;
  }
  /** QUEST-PARTY phase 3c: a party member's own frame in - each record of a quest it shares with me onto its puppet (a
   *  new one stood through the build chain, QUEST_PUPPETS_MAX an owner), a full frame taking down every puppet of that
   *  owner it no longer lists; a record of no shared quest, or from anyone outside the party, stands nothing (and takes
   *  down what it named); a frame of another dungeon or older than the owner's last is not the world. SUMMON-SYNC: a
   *  record its `lf` names is a loose stand - anyone's in the room, stood by everyone in it, CELL_LOOSE_PUPPETS an owner. */
  function applyOwnFrame(from, data) {
    if (typeof from !== 'string' || !from || !data || !Array.isArray(data.f) || data.k !== _locationKey) return false;
    const share = ownShare();
    let o = _ownOwners.get(from);
    if (!o) { o = { n: -1, at: 0, gen: ++_ownGen }; _ownOwners.set(from, o); }
    if (Number.isFinite(data.n)) { if (data.n <= o.n) return false; o.n = data.n; }
    o.at = performance.now();
    const tags = validQuestTags(data.qf), loose = validLooseSeqs(data.lf), comp = validLooseSeqs(data.cp);   // AUDIT CC-E1: `cp` the owner's companions (the loose numbers' own law)
    const compNames = companionNames(data.cp, data.cn);   // AUDIT WK-U3: and their names
    const seen = new Set(), marks = [], named = new Set();
    for (const raw of data.f.slice(0, CELL_FRAME_RECORDS_MAX)) {
      const r = validFoeRecord(raw);
      if (!r) continue;
      named.add(r.i);
      const key = ownPupKey(from, r.i);
      let f = _ownPups.get(key) ?? null;
      const qt = tags.get(r.i) ?? null;
      const lo = !qt && loose.has(r.i);   // SUMMON-SYNC: a loose stand - whoever in the room owns it
      // AUDIT DISC28 QS-J: a record naming ME its heir is taken on party membership (partyPeer, the pre-J law) - the owner
      // has let it go, and my copy with no link to its quest stands none of its puppets: refused, it was gone for everyone
      if (!lo && (!qt || (!share?.accepts?.(from, qt) && !(ownHeirIsMe(r) && share?.partyPeer?.(from))))) {   // the own lane carries a party's quest foes and the room's loose stands alone
        if (f) dropOwnPuppet(key, f);
        if (qt) {
          // AUDIT DISC28 QS-J: an orphan my unlinked copy took from a kept record, streamed ALIVE by its owner again - theirs
          // again (AUDIT pre-merge D2's law, which this gate's `continue` skips), and a build of it in flight not mine to land
          const took = _ownAdopted.get(key);
          if (took) { _ownAdopted.delete(key); if (r.d !== 1 && !took.dead && !took._gone) letGoOwn(took); }
          const pend = _ownPending.get(key);
          if (pend?._orphanMine) pend._orphanMine = false;
          keepOwnRecord(from, key, r, qt);
        }
        continue;
      }
      _ownKept.delete(key);   // AUDIT DISC28 QS-J: stood (or taken) from here - no longer only kept
      seen.add(r.i);
      if (qt?.mk && r.d !== 1 && !r.e) marks.push(qt);   // AUDIT (pre-merge) D5: a HANDED record (it names an heir) marks nothing - the heir took that very foe, and the heir's own frame carries the mark from here
      if (f && ((r.t != null && r.t !== f.mobileType) || !!f._pupLoose !== lo)) { dropOwnPuppet(key, f); f = null; }   // another species by that number (SUMMON-SYNC: or another kind): stood anew
      // AUDIT (the pre-merge audit, D2): a foe of theirs I took, streamed ALIVE by them again (a socket back under the
      // same id, a tab that woke) - theirs again: mine goes, and their record stands it here as their puppet
      const took = f ? null : _ownAdopted.get(key);
      if (took) { _ownAdopted.delete(key); if (r.d !== 1 && !took.dead && !took._gone) letGoOwn(took); }
      if (f) { applyOwnRecord(f, r, share); if ((lo && comp.has(r.i)) || f.companion != null) companionPuppet(f, lo && comp.has(r.i), compNames.get(r.i)); f._heirElse = ownHeirElse(r); if (ownHeirIsMe(r) && f.companion == null) adoptOwn(from, f, share); continue; }
      if (_ownPending.has(key)) { _ownPending.set(key, r); continue; }
      if (r.d === 1 || r.t == null || !r.f || !canStandFoe(r.t) || ownPuppetsOf(from, lo) >= (lo ? CELL_LOOSE_PUPPETS : QUEST_PUPPETS_MAX)) continue;
      _ownPending.set(key, { ...r, _comp: lo && comp.has(r.i), _compName: compNames.get(r.i) ?? null });
      if (lo) _ownPendLoose.add(key);
      standOwnPuppet(from, r, qt, o.gen, lo).catch((e) => { _ownPending.delete(key); _ownPendLoose.delete(key); console.error('[online] another player\'s foe could not stand here:', e); });
    }
    if (data.full === 1) for (const [key, f] of [..._ownPups]) if (f._ownFrom === from && !seen.has(f._ownI)) dropOwnPuppet(key, f);
    if (data.full === 1) for (const [key, k] of [..._ownKept]) if (k.from === from && !named.has(k.r.i)) _ownKept.delete(key);   // AUDIT DISC28 QS-J: as a stood record goes
    if (marks.length) standDownMarkerCopies(from, marks);
    return true;
  }
  /** An owner's live puppets here and their builds in flight - SUMMON-SYNC: of one kind, its quest foes or its loose
   *  stands, each under its own allowance. */
  function ownPuppetsOf(from, lo = false) {
    let n = 0;
    for (const f of _ownPups.values()) if (f._ownFrom === from && !f.dead && !!f._pupLoose === lo) n++;
    for (const k of _ownPending.keys()) if (k.startsWith(from + ':') && _ownPendLoose.has(k) === lo) n++;
    return n;
  }
  /** QUEST-PARTY phase 3c: a party member's quest foe stood here - the build chain's own, where its record says, posed
   *  by the newest record since; a build its owner's sweep overtook ends on arrival. */
  async function standOwnPuppet(from, r, qt, gen, lo = false) {
    const key = ownPupKey(from, r.i);
    const f = await buildFoeAt({ mobileType: r.t, gender: GENDER_BIT[r.x === 1 ? 1 : 0], x: r.f[0], y: r.f[1], z: r.f[2], spawnDistanceType: 0 }, false, { puppet: true, feetGiven: true });   // DISC28-H: `r.f` is the owner's feet; AUDIT PRE-MERGE 0928 M1: the owner's foe - no spawn of mine (its abyss had it)
    const kept = _ownPending.has(key);   // no room change cleared it (clearOwnPuppets empties the pending)
    const newest = _ownPending.get(key) ?? r;
    _ownPending.delete(key); _ownPendLoose.delete(key);
    if (!f) return null;
    // AUDIT (the pre-merge audit, F3): the owner's leave pruned it while this build was in flight, and its last word
    // named ME its heir - the owner has already let it go, so a build that ended on arrival lost the foe for everyone
    // AUDIT DISC28 QS-J: or the orphan law gave it to me from a kept record (`_orphanMine` - its owner's return clears it)
    const heirOrphan = kept && !_ctxDead && !_ownPups.has(key) && _ownOwners.get(from)?.gen !== gen && (ownHeirIsMe(newest) || !!newest._orphanMine);
    if (!heirOrphan && (_ctxDead || _ownPups.has(key) || _ownOwners.get(from)?.gen !== gen)) { dropOwnPuppet(null, f); return null; }
    f._ownFrom = from; f._ownI = r.i; f._pupQuest = qt; f._pupLoose = !!lo;   // SUMMON-SYNC: a loose stand's puppet
    _ownPups.set(key, f);
    const share = ownShare();
    applyOwnRecord(f, newest, share);
    if (newest._comp ?? r._comp) companionPuppet(f, true, newest._compName ?? r._compName);   // AUDIT CC-E1
    f._heirElse = ownHeirElse(newest);
    if (f.companion == null && (ownHeirIsMe(newest) || !!newest._orphanMine) && !adoptOwn(from, f, share) && heirOrphan) dropOwnPuppet(key, f);   // AUDIT CC-E1: a companion is never anyone's heir's
    return f;
  }
  /** AUDIT CC-E1: another's companion stood here as the owner's word says - an ally of every player in the room (team
   *  PlayerAlly, a shipmate no blow of mine reaches, a `companion` my foes may fight), or back to what it was. */
  function companionPuppet(f, on, name = null) {
    if (on) {
      f.companion = `peer:${f._ownFrom}:${f._ownI}`; f.shipmate = true; f.companionName = name ?? null;   // AUDIT WK-U3: his own name
      if (f.entity) { f.entity.team = 'PlayerAlly'; f.entity.mobileTeam = 'PlayerAlly'; }
    } else if (f.companion != null) { f.companion = null; f.shipmate = false; }
  }
  /** AUDIT DISC28 QS-J: a party member's quest-foe record my unlinked copy refuses to stand, kept for the orphan law - a
   *  living one, from my party, naming no heir (a handover's heir takes its foe itself), merged over the last word (a
   *  record carries what changed), and no more of them per owner than the quest allowance a stood copy has
   *  (QUEST_PUPPETS_MAX). Anything else it was is let go. */
  function keepOwnRecord(from, key, r, qt) {
    const had = _ownKept.get(key) ?? null;
    if (r.d === 1 || r.e || !ownShare()?.partyPeer?.(from)) { _ownKept.delete(key); return; }
    if (!had) { let n = 0; for (const k of _ownKept.values()) if (k.from === from) n++; if (n >= QUEST_PUPPETS_MAX) return; }
    _ownKept.set(key, { from, r: { ...(had?.r ?? {}), ...r }, qt });
  }
  /** QUEST-PARTY phase 3c: one record onto a party member's quest foe - the layout's door - and my copy of the quest
   *  counts what it sees: the first blow landing is the injury, the fall the kill (phase 1's law). */
  function applyOwnRecord(f, r, share) {
    // AUDIT (the pre-merge audit, D3): the injury is a drop from the LAST STREAMED health (the cell's `p.h`), never from
    // this copy's own roll - a class foe built at my level rolled more health than the owner's, so the first sight of
    // an untouched foe read as a blow and fired the quest's `injured` before anyone had struck it
    const wasDead = f.dead, h0 = f._pupH;
    applyFoeRecord(f, r);
    if (Number.isFinite(r.h)) f._pupH = r.h;
    if (f._pupQuest && !f._qHurt && Number.isFinite(h0) && Number.isFinite(r.h) && r.h < h0) { f._qHurt = true; share?.onPuppetHurt?.(f._pupQuest); }
    if (f._pupQuest && !wasDead && f.dead) share?.onPuppetDied?.(f._pupQuest, f._ownFrom, f._ownI);   // KEPT-KILL: whose foe, by its number - the kill the owner's pose may say too counts once
  }
  /** KEPT-KILL (2026-10-01): a foe I keep on a partner's word (AUDIT DISC28 QS-J's `_keptTag` - my copy holds no such
   *  quest, so nothing here counts it) says its fall once, by the quest behaviour's own test (health at zero,
   *  QuestResourceBehaviour.update), with its number on my lane - my party pose carries it (`qk`) and every copy that
   *  holds the quest counts it, wherever its member stands. A foe let go (its owner's again, a room change) fell to
   *  nobody. */
  function keptKillTick(f) {
    if (!f._keptTag || f._keptSaid || f._ownFrom != null || !(f.entity?.health <= 0)) return false;
    f._keptSaid = true;
    ownShare()?.onKeptDied?.(f._keptTag, f._ownSeq);
    return true;
  }
  /** CREW-COMPANIONS: a loose stand of mine gone with no corpse (a companion lifted out to the next place, knocked out,
   *  sent back) - the puppet drop's own teardown (dropOwnPuppet, below: its sprites, its body, every target on it, its
   *  place in the list), for a body no puppet map holds. */
  function removeLooseFoe(f) {
    if (!f || f._gone || !foes.includes(f)) return false;
    dropOwnPuppet(null, f);
    return true;
  }
  /** QUEST-PARTY phase 3c: a party member's quest foe goes - its batch, its body, its place in the pool, the target
   *  machine's memory of it (the shared encounter's teardown). */
  function dropOwnPuppet(key, f) {
    if (key != null) _ownPups.delete(key);
    else for (const [k, x] of _ownPups) if (x === f) { _ownPups.delete(k); break; }
    if (!f) return;
    if (f.batch) { renderer.destroyBillboardBatch(f.batch); f.batch = null; }
    freeCorpse(f);
    f.dead = true; f._gone = true;
    dropCandidate(f);
    const at = foes.indexOf(f);
    if (at >= _layoutFoes) foes.splice(at, 1);
  }
  /** QUEST-PARTY phase 3c: every party member's quest foe goes (a room change, a leave, a load). */
  function clearOwnPuppets() {
    for (const [key, f] of [..._ownPups]) dropOwnPuppet(key, f);
    _ownPending.clear();
    _ownPendLoose.clear();
    _ownOwners.clear();
    _ownAdopted.clear();   // AUDIT (pre-merge) D2: another room's foes are nobody's to give back here
    _ownKept.clear();   // AUDIT DISC28 QS-J: nor a kept record anybody's to take
  }
  /** QUEST-PARTY phase 3c: the owners gone from the room (`alive` no longer holds them) or quiet past `staleMs` - each of
   *  their quest foes to the party member the law names (phase 2's orphan), else gone. */
  function pruneOwnOwners(alive, now = performance.now(), staleMs = 0) {
    const share = ownShare();
    for (const [from, o] of [..._ownOwners]) {
      const gone = !alive.has(from);
      if (!gone && !(staleMs > 0 && now - o.at > staleMs)) continue;
      for (const [key, f] of [..._ownPups]) {
        if (f._ownFrom !== from) continue;
        // AUDIT (the pre-merge audit, D2): an ORPHAN only when its owner has LEFT - one gone quiet (a hidden tab, a held
        // frame) still stands it and streams it again when it wakes, and two owners streamed one foe; and never a foe
        // whose owner's last word named another heir - that one took it, and a lower id near it took it too
        if (gone && !f.dead && f._pupQuest && !f._heirElse && share?.adoptsOrphan?.(from, f) && adoptOwn(from, f, share)) continue;   // SUMMON-SYNC: a shared quest's orphan alone - a loose stand goes with its owner, the cell's law
        dropOwnPuppet(key, f);
      }
      // AUDIT DISC28 QS-J: AND THE RECORDS MY UNLINKED COPY KEPT - the law elects among the party members near the foe by id
      // alone and cannot know which stand it; since DISC28-J an unlinked member stands none, so the orphan it was elected
      // for was lost to everyone. Elected, it stands the foe from its kept record and takes it on landing as a linked
      // member takes its puppet (adoptOwn: kept on the partner's word); else the record goes with its owner.
      for (const [key, k] of [..._ownKept]) {
        if (k.from !== from) continue;
        _ownKept.delete(key);
        const r = k.r;
        if (!gone || !r.f || r.t == null || !canStandFoe(r.t) || _ownPending.has(key) || _ownPups.has(key)) continue;
        if (!share?.adoptsOrphan?.(from, { ai: { feet: r.f } })) continue;
        _ownPending.set(key, { ...r, _orphanMine: true });
        standOwnPuppet(from, r, k.qt, o.gen).catch((e) => { _ownPending.delete(key); console.error('[online] an orphaned quest foe could not stand here:', e); });
      }
      _ownOwners.delete(from);
    }
  }
  /** QUEST-PARTY phase 3c: a party member's quest foe made MINE (its heir named me, or the law gave me the orphan) -
   *  bound to my own copy of the quest, its pose standing and its motor resuming from it (the seat's own handover), and
   *  numbered on my own lane. AUDIT (the pre-merge audit, Q3): a copy that holds no such quest takes it too, keeping
   *  its partner's word (`_keptTag`, which ownQuestTag reads) - it rides to the party as the quest's foe it is, and each
   *  member's copy counts its fall; refusing it lost the foe the owner had already let go. Answers 1 when taken. */
  function adoptOwn(from, f, share) {
    const key = ownPupKey(from, f._ownI);
    if (_ownPups.get(key) !== f || f.dead || f._gone) return 0;
    const qt = f._pupQuest;
    if (!qt && !f._pupLoose) return 0;
    // AUDIT (the pre-merge audit, D8): A BOUND ON WHAT I TAKE. A taken foe leaves the owner's puppet count, so a peer
    // naming me heir on fresh records every frame had me stand real foes without end; the owners' own allowances
    // (QUEST_PUPPETS_MAX + CELL_LOOSE_PUPPETS) are the most a room hands one player at once
    let live = 0;
    for (const x of _ownAdopted.values()) if (!x.dead && !x._gone) live++;
    if (live >= QUEST_PUPPETS_MAX + CELL_LOOSE_PUPPETS) return 0;
    const b = qt ? (share?.behaviourFor?.(qt) ?? null) : null;   // SUMMON-SYNC: a loose stand binds no quest - its heir takes it as it stands
    _ownPups.delete(key);
    const p = f._pup;
    if (p) { f.ai.feet[0] = p.feet[0]; f.ai.feet[1] = p.feet[1]; f.ai.feet[2] = p.feet[2]; f.ai.yaw = p.yaw; }
    f.ai.resumeLive?.();
    if (f.attack?.machine) { f.attack.machine.state = 'Idle'; if ('acc' in f.attack.machine) f.attack.machine.acc = 0; }
    if (f.mobile) { f.mobile.doMeleeDamage = false; f.mobile.shootArrow = false; }   // WORLD2 dropped unconsumed: no blow from a puppet's last frame on the first live one (the taken quest foe's)
    f._pup = null; f._pupTarget = null; f._pupMine = false; f._sentKey = null; f._castPending = false;
    f._ownFrom = null; f._ownI = null; f._pupQuest = null; f._ownSeq = ++_ownSeq;
    if (f._pupLoose) { f._pupLoose = false; f._loose = true; }   // SUMMON-SYNC: mine now, on my lane to the room
    if (qt?.tc) f._qTouched = true; else if (qt && Number.isFinite(f.entity?.health) && f.entity.health > 0) f.entity.maxHealth = f.entity.health;   // AUDIT (pre-merge): its touched state is its owner's word (flag 2) - its maximum was my own roll, so an untouched foe read as struck
    if (qt?.mk) f._questMarker = true;   // AUDIT (pre-merge) D5: a marker's foe stays one in my frame (flag 1), so a member's - or its returning owner's - marker copy still stands down to it
    if (qt && !b) f._keptTag = { q: qt.q, s: qt.s };   // AUDIT (pre-merge) Q3
    if (b) bindQuestFoeHost(f, b, questPoolOps);
    _ownAdopted.set(key, f);   // AUDIT (pre-merge) D2: theirs again if they stream it alive
    console.info(b || qt ? '[foes] took over a party member\'s quest foe' : '[foes] took over another player\'s loose foe');
    return 1;
  }
  /** QUEST-PARTY phase 3c: the handover frame (a door out, a death) and the foes it handed let go - the rest stay mine. */
  function ownHandOverFrame(heirOf) { for (const f of foes) f._heir = null; return ownFrame(true, heirOf); }
  function dropOwnHanded() {
    let n = 0;
    for (const f of [...foes]) {
      const heir = f._heir; f._heir = null;
      if (!heir || f._ownFrom != null || f.dead) continue;
      letGoOwn(f);
      n++;
    }
    return n;
  }
  /** One of my own foes let go - handed (dropOwnHanded) or, AUDIT (pre-merge) D2, given back to the owner I took it
   *  from: its batch, its place in the pool and the target machine's memory; no death, no corpse, and its quest's
   *  instance let go with it (the other copy's record is the one this quest counts from here, as a partner's). */
  function letGoOwn(f) {
    if (f.batch) { renderer.destroyBillboardBatch(f.batch); f.batch = null; }
    f._gone = true; f.dead = true;
    dropCandidate(f);
    const at = foes.indexOf(f);
    if (at >= _layoutFoes) foes.splice(at, 1);
  }
  /** QUEST-PARTY phase 3c: A MARKER'S FOE STANDS ONCE FOR THE PARTY (questMarkerYields) - my live marker foe of a quest
   *  a party member's frame names a live marker foe of goes as the cull takes one when the law says mine stands down. */
  function standDownMarkerCopies(from, marks) {
    const me = opts.selfId?.() ?? null;
    let n = 0;
    for (const f of [...foes]) {
      if (f._ownFrom != null || f.dead || !f._questMarker) continue;
      const mine = ownQuestTag(f);
      const theirs = mine ? marks.find((t) => t.q === mine.q && t.s === mine.s) : null;
      if (!theirs || !questMarkerYields({ mineTouched: questTouched(f), theirsTouched: !!theirs.tc, myId: me, theirId: from })) continue;
      questPoolOps.removeFoe(f);
      n++;
    }
    if (n) console.info(`[foes] a party member stands ${n} of the quest's marker foe(s) here - mine stood down`);
    return n;
  }
  /** QUEST-PARTY phase 3c: a party member's blow on MY shared quest foe (the hit marked `own`, numbered on my lane) -
   *  through the one door a peer's blow lands by (landPeerBlow), whoever hosts the room; never from outside the party.
   *  SUMMON-SYNC: and anyone's in the room on my loose stand, which the whole room sees. */
  /** AUDIT (pre-merge) Q3: a peer's blow on my shared quest foe - the party's (the quest law's peerMayHit), or on one I keep
   *  a partner's word for, that word's party (no quest of mine to ask). AUDIT DISC28 QS-J: the party's own word
   *  (partyPeer) - accepts is DISC28-J's linked-copy law, which a kept foe is kept exactly for lacking. */
  const ownPeerMayHit = (id, f) => (f._keptTag ? !!ownShare()?.partyPeer?.(id) : !!ownShare()?.peerMayHit?.(id, f));
  function applyOwnHit(id, data) {
    if (!data || typeof data !== 'object' || (data.k != null && data.k !== _locationKey)) return false;
    const i = data.i | 0, dmg = Number(data.dmg);
    const f = foes.find((x) => x._ownFrom == null && x._ownSeq === i) ?? null;
    // AUDIT CC-E1: a foe on another client mauled MY companion - the blow lands here, where he is real: the foe's, not a
    // player's (the knock-out arm his death); he turns on the striker when the striker rides the lane to me
    if (data.fb === 1) {
      if (!f || f.dead || f.companion == null || !Number.isFinite(dmg) || dmg < 0 || dmg > HIT_DMG_MAX) return false;
      const fd = Array.isArray(data.d) && data.d.length === 3 && data.d.every(Number.isFinite) ? data.d : null;
      const fl = fd ? Math.hypot(fd[0], fd[1], fd[2]) : 0;
      damageFoe(f, dmg, null, fl > 1e-6 && fl < 1e6 ? [fd[0] / fl, fd[1] / fl, fd[2] / fl] : null, { fromPlayer: false, kind: data.kind === 'arrow' ? 'arrow' : 'melee' });
      const by = data.sf != null ? _ownPups.get(ownPupKey(id, data.sf | 0)) : null;
      if (by && !by.dead && f.ai && !f.dead) f.ai.target = by;
      return true;
    }
    if (!f || f.dead || f.entity?.team === 'PlayerAlly' || !(ownLoose(f) || (!!ownQuestTag(f) && ownPeerMayHit(id, f))) || !Number.isFinite(dmg) || dmg < 0 || dmg > HIT_DMG_MAX) return false;   // AUDIT (pre-merge) D6: my summoned ally rides the loose lane with no side - the others stand it as a foe, and their blows landed on it
    const landed = landPeerBlow(f, id, data, dmg);
    if (data.al === 1) allyTurn(f, id, data);
    return landed;
  }

  /** WORLD2/WORLD3: ONE streamed record onto its puppet - the target pose, the target it hunts and the cast it made,
   *  the health (a drop is the hurt one-shot), death and un-death through the one kill door. Called from the frame's
   *  loop, and again on a foe that frame REBUILT (AUDIT WORLD3 E2), so the rebuilt body stands as the room has it. */
  /** AUDIT ONCRASH1 B4a: THE STREAM'S RECORD COMES THROUGH THE WIRE'S DOOR, like the cell's.
   *  `validFoeRecord` lives in net/wire.js and the exterior pool has always used it; this host never imported it and
   *  checked its own fields by hand instead - `Number.isFinite(r.y)` with no bound, `r.f.every(Number.isFinite)` with
   *  no POSE_BOUND, `r.h` with no FOE_HEALTH_MAX. So ONCRASH1's "the wire's door bounds a streamed foe record" was
   *  true of the exterior cell and false of the dungeon, which is the path the reports were about. One door now: a
   *  record outside the law is refused WHOLE here as it is there. */
  function applyFoeRecord(f, raw) {
    const r = validFoeRecord(raw);
    if (!r) return;
    const p = f._pup ?? (f._pup = { feet: [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], yaw: f.ai.yaw, moving: false, hurt: false, hurtUntil: 0, strike: null, a: null, target: null, c: null, cast: null });
    if (typeof r.g === 'string') p.target = r.g;   // WORLD3: whose blow this puppet's is
    if (r.d !== 1) f._fightN = r.n ?? 1;   // AUDIT PSCALE1: the host's count of who fights it (a record without one: one). SIGIL1: a LIVE record's - a body's carries none, and the fight it died in was the last live count (its Renown bonus, its sigils)
    if (r.l !== undefined && f.mobileType >= 128) f.streamedLevel = r.l;   // AUDIT RENOWN1 GAME-3: the host's class foe's level - what its kill is worth (net/renownTracker.js renownFoeLevel)
    if (r.c != null) { const c = r.c | 0; if (p.c != null && c !== p.c) p.cast = r.s | 0; p.c = c; }   // WORLD3: a cast once per count, never the count a joiner arrived with
    if (Array.isArray(r.f) && r.f.length === 3 && r.f.every(Number.isFinite)) { p.feet[0] = r.f[0]; p.feet[1] = r.f[1]; p.feet[2] = r.f[2]; }
    if (Number.isFinite(r.y)) p.yaw = r.y;
    p.moving = !!r.m;
    if (Number.isFinite(r.k)) f.entity.maxHealth = r.k;   // AUDIT SETS M1: the host's maximum - "under half" is its word (the copy was rolled at MY level)
    if (Number.isFinite(r.h)) { if (r.h < f.entity.health) p.hurt = true; f.entity.health = r.h; }
    if (r.a != null) { const a = r.a | 0; if (p.a != null && a !== p.a) p.strike = (a & 1) ? 'ranged' : 'melee'; p.a = a; }
    // AUDIT SET P-M3: THE HOST'S WORD THAT MY BLOW KILLED IT (its record's `v`, roomRecord's) - read before the death below
    // lays the body, once: the frame after finds the foe dead
    if (r.d === 1 && !f.dead && r.v != null && r.v === (opts.selfId?.() ?? null)) reportPlayerKill(f.entity, REMOTE_KILL);
    // LOOT7-CHECK DUNGEON-DIED: ...and the kill notice with it - the striker's own, said at the striker (damageFoe's death
    // arm speaks none for a peer's blow at the host); a death the host's record names nobody for is the host's to say
    if (r.d === 1 && !f.dead && r.v != null && r.v === (opts.selfId?.() ?? null)) sayEnemyDied((l) => hudText.add(l), f.mobileType, f.entity);
    // STRIKE-SHARED: MY SOUL TRAP WAS ON IT AS IT FELL - the soul is mine to roll for, into my own pack, as
    // EnemyEntity.AttemptSoulTrap rolls it at the kill (the gate court's own arm, WBX7), with no tether: the foe fell on
    // its runner's machine. Once, and only on a foe I sent a trap to - the name alone fills no gem of mine unasked.
    if (r.d === 1 && !f.dead && r.j !== undefined && f._trapSent && r.j === (opts.selfId?.() ?? null)) {
      f._trapSent = false;
      const res = attemptSoulTrap({ activeEffects: [{ kind: 'soulTrap', chance: r.q }] }, f.mobileType, playerEntity.items ?? [], Math.random());
      if (res.alert && SOUL_TRAP_TEXT[res.alert]) hudText.add(SOUL_TRAP_TEXT[res.alert]);
    }
    // CORPSE-FOOD (Mac: "It needs to be accessible with people with it on"): this copy's own roll of the body's food.
    // The host's kill fed the host's copy alone - a death is raised where it happens - and a joiner who opened the
    // body first handed the room a list with none (WORLD4: the first reader's list is the room's). Each copy rolls its
    // own, as a chest does.
    if (r.d === 1 && !f.dead) { addCorpseFood(f.entity, { luck: liveStat(playerEntity, 'luck') }); stampWonWeapons(f.entity.items, f._fightN ?? 1); }   // SIGIL1: and its own roll of the sigils, at the host's count - the room adopts the first opener's list
    if (r.d === 1) { if (!f.dead) { f.ai.feet[0] = p.feet[0]; f.ai.feet[1] = p.feet[1]; f.ai.feet[2] = p.feet[2]; renownFoeDied(f); } setFoeDead(f, true); }   // B10: the corpse where the host's foe fell, not where the ease had got to   // RENOWN1: the host's frame says it fell - it pays me if I fought it
    else if (r.d === 0 && f.dead) {   // AUDIT WORLD7/8 B3: the stream's un-death is a REBUILD - the host minted a fresh entity (the hour's respawn), and the old body stood up looted, still cursed (a frozen drain killed it again at once and sent the host the blow) and with the dead foe's counts (phantom edges); WORLD3 E2's own arm
      const idx = foes.indexOf(f);
      if (idx >= 0 && idx < _layoutFoes && !_retyping.has(idx)) retypeFoe(idx, f.mobileType, f.gender ?? null).then((ok) => { if (ok && !_authority && foes[idx]) applyFoeRecord(foes[idx], r); }).catch((e) => console.error('[online] the rebuilt foe could not take the record - the foe stands as it is:', e));   // AUDIT ONCRASH1 A1
      else setFoeDead(f, false);
    }
  }

  /** WORLD2: a peer's blow on my foe, while I host - through the one damage door with the peer's number and kind
   *  (the player arm: aggro, the shield pool, death and its corpse), the striker's feet unknown to it (the aggro turns
   *  toward me - a known drift until the pose rides the hit). */
  /** WORLD6b-iii(e): THE ONE DOOR for this player's poison at a layout foe - the blade's (the melee chain) or the
   *  shaft's (playerArrowHitFoe's hook), which FormulaHelper inflicts INSIDE the damage calc and clears from the
   *  weapon either way. The host's: dosed here. A PUPPET's (a layout foe while another hosts): the dose rides the
   *  blow's divert to the host (`pt` on the hit, spent by damageFoe's puppet arm, which the same calc's damage
   *  reaches next); the host's foe rolls its own saving throw there. */
  function poisonFoe(f, pt) {
    if (!f) return null;
    const pi = foes.indexOf(f);
    if ((!_authority && isRoomFoe(f, pi)) || f._ownFrom != null) { f._divertPt = pt; return null; }   // REST-SYNC: a shared encounter's puppet too; QUEST-PARTY phase 3c: and a party member's quest foe
    return inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) });
  }
  /** AUDIT WORLD6b-iii(e) A1: the Arrows a body holds - the bound the hit's `ar` lands under (the exterior's twin). */
  function arrowsIn(items) { let n = 0; for (const it of items) if (it && it.templateIndex === 131 && it.name === 'Arrow') n += it.stackCount ?? 1; return n; }
  /** AUDIT WORLD6b-iii(e) C2 (AUDIT WORLD6b-ii B4's door, the dungeon's): THE ONE DOOR for a connecting swing or shaft of
   *  mine that landed no damage (WeaponManager.cs:630 runs for every connect) - the host's foe wakes and its room with
   *  it (handleAttackFromPlayer); a PUPPET's host hears a zero blow with its kind (WORLD2 B13; a shaft's Arrow lands in
   *  the host's copy) unless a damaging one already went from this hit, and no layout of mine wakes for it - until now
   *  a zero blow at a puppet woke every foe on my screen, puppets included, and told the host nothing. */
  function attackFromPlayer(foe, playerFeet = null, kind = 'melee', landed = 0) {
    if (!foe) return;
    const pi = foes.indexOf(foe);
    if ((!_authority && isRoomFoe(foe, pi)) || foe._ownFrom != null) { if (!(landed > 0)) damageFoe(foe, 0, playerFeet, null, { kind }); else foe._divertPt = null; return; }   // REST-SYNC: a shared encounter's puppet too; QUEST-PARTY phase 3c: and a party member's quest foe
    handleAttackFromPlayer(foe, playerFeet);
  }
  function applyHit(id, data) {
    if (!_authority || !data || typeof data !== 'object') return false;
    const i = data.i | 0, dmg = Number(data.dmg);
    const xs = data.xs === 1;   // REST-SYNC: a shared encounter, by the room's number - not a layout index
    const f = xs ? (_sharedById.get(i) ?? null) : foes[i];
    // AUDIT FOES FOE5: BOUNDED, as the exterior twin's applyHit is (exteriorFoes.js:2685). The number is a peer's
    // word and the host trusts it without recomputing, so an unbounded one let any joiner one-shot every foe in the
    // room - and, through the kill door, empty it. 10000 is past anything a legal swing, shaft or blast can roll.
    if (!f || (!xs && i >= _layoutFoes) || f.dead || !Number.isFinite(dmg) || dmg < 0 || dmg > HIT_DMG_MAX) return false;
    const landed = landPeerBlow(f, id, data, dmg);
    if (data.al === 1) allyTurn(f, id, data);
    return landed;
  }
  /** AUDIT CC-E1: an ALLY's blow (a peer's companion struck it): the foe turns on that companion, never on its owner. */
  function allyTurn(f, id, data) {
    if (data.al !== 1 || f.dead || !f.ai || data.ac == null) return;
    const by = _ownPups.get(ownPupKey(id, data.ac | 0));
    if (by && !by.dead && by.companion != null) f.ai.target = by;
  }
  /** WORLD2's door for a peer's blow, one home - the host's on a layout foe (applyHit) and, QUEST-PARTY phase 3c, a
   *  party member's on my own shared quest foe (applyOwnHit): the striker's feet and the blow's direction, bounded; the
   *  ring, the blood and the pain; the dose; the damage door as a PEER's blow; the shaft. */
  function landPeerBlow(f, id, data, dmg) {
    const kind = data.kind === 'arrow' || data.kind === 'spell' ? data.kind : 'melee';
    // WORLD3: the striker's feet and the blow's direction (a spell knocks nothing, verbatim), the shaft.
    // AUDIT WORLD3 F2: BOUNDED. The direction is multiplied by the knockback SPEED and handed to collider.move, whose
    // substep count is linear in the magnitude - an unnormalised [1e9,0,0] from one 85-byte frame asked the host's
    // collider for 2.4e8 substeps and froze the tab for every player in the room. A direction is a UNIT vector or it
    // is nothing; a position outside the dungeon's own reach is nothing.
    const v3 = (v) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? [v[0], v[1], v[2]] : null);
    const unit = (v) => { const u = v3(v); if (!u) return null; const L = Math.hypot(u[0], u[1], u[2]); return L > 1e-6 && L < 1e6 ? [u[0] / L, u[1] / L, u[2] / L] : null; };
    const inReach = (v) => { const q = v3(v); return q && q.every((c) => Math.abs(c) <= HIT_POS_MAX) ? q : null; };
    const at = inReach(data.p), dir = kind === 'spell' ? null : unit(data.d);
    const pt = hitPoisonOf(data);   // WORLD6b-iii(e): the striker's poison (the wire's bound)
    // AUDIT WORLD2 B8/C4: the blow is seen and heard on the host too - the hit's ring, the blood, the pain (the
    // striker's callers play these before their own door; here the door is all there is)
    if (dmg > 0) {
      audio.play3d(hitSoundFor(null), f.ai.feet, ENEMY_HIT_VOLUME, { maxDistance: 16 });
      hitEffects?.showBloodSplash(ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0, bloodCentre(f.ai.feet, f.ai.height), null, bloodHit(dmg, f.entity));   // BLOOD1b: a peer's blow is still a blow
      const pain = enemyPainVoice(f, dmg);
      if (pain && pain.clip >= 0) audio.play3d(pain.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + pain.pitchLift });
    }
    if (pt != null) inflictPoison(f.entity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) });   // WORLD6b-iii(e): the dose lands on the host's foe as FormulaHelper lands it - inside the blow, before the health moves, the foe's own saving throw rolled here; AUDIT WORLD6b-iii(e) A3: on the striker's word, whatever the number
    damageFoe(f, dmg, at, dir, { fromPlayer: true, peer: true, kind, peerId: id, whole: data.z === 1 });   // AUDIT PSCALE1 DOORS-1: a joiner's kill is a kill
    if (data.ar === 1 && kind === 'arrow' && arrowsIn(f.entity.items ??= []) < HIT_ARROWS_MAX) addItem(f.entity.items, bowDamageArrow());   // WORLD3: the shaft, where BowDamage puts it (MAC-N1: minted) (:145-147) - the corpse's items are the record's; AUDIT WORLD6b-iii(e) A1: HIT_ARROWS_MAX a body from peers' shafts
    // STRIKE-SHARED (2026-09-29, Mac: "Do #1"): the striker's strike spell, landed on MY foe - the real one - through the
    // cast engine's own foe door (its saving throw, its pacify, its trap marked as the striker's), every point of its
    // damage the striker's blow (the fighters' count, `v` on a kill). The caster is a stand-in at the striker's level:
    // the gauntlet (absorb, reflect, resist) runs against the foe as it does for any caster, and a reflected bundle
    // has no body here to go back to.
    const hs = f.dead ? null : hitSpellOf(data);
    if (hs) {
      magic.applySpellToFoe(hs.spell, hs.level, f, { entity: { level: hs.level } }, { peerCaster: id }, {
        ...foeSinks(f),
        hurt: (n, o) => damageFoe(f, n, null, null, { fromPlayer: true, peer: true, peerId: id, kind: 'spell', whole: !!o?.whole }),
      });
    }
    return true;
  }
  /** STRIKE-SHARED (2026-09-29, Mac: "Do #1"): A STRIKE SPELL OF MINE ON A FOE ANOTHER PLAYER RUNS GOES TO IT, WHOLE -
   *  the room's foe when the host is not me (the layout's run, a shared encounter), a party member's quest or loose
   *  stand (`_ownFrom`). My copy is a puppet its runner's next frame overwrites, so a Cast When Strikes paralysis,
   *  sleep, drain or trap landed on it and was gone; only damage crossed. The spell rides a hit of no damage (kind
   *  'spell' - a connect turns the foe on me, DFU's rule) through the one divert this pool's blows take, and the runner
   *  lands it on its real foe (landPeerBlow). Answers whether it went; false for a foe I run, or a record the wire
   *  refuses - the caller lands those here as before. */
  function spellToOwner(f, record, level) {
    if (!f || f.dead) return false;
    const pi = foes.indexOf(f);
    if (pi < 0 || !(f._ownFrom != null || (!_authority && isRoomFoe(f, pi)))) return false;
    const spell = hitSpellFields(record, level);
    if (!spell) return false;
    damageFoe(f, 0, null, null, { kind: 'spell', spell });
    if (record.effects.some((e) => e && isSoulTrapEffect(e))) f._trapSent = true;   // the runner names me on the body if my trap was on it (applyFoeRecord's `j`)
    return true;
  }

  /** WORLD2: who steps the layout's foes. Off: they are puppets from the next frame (posed by the stream when it
   *  comes; still until then). On - the HANDOVER: each puppet's pose stands and the motor resumes live from it
   *  (resumeLive - the target, the path, the grounding and the clocks forgotten), the attack machine and the mobile's
   *  latches cleared so no phantom edge or blow fires on the first live frame, and the stream starts from every foe. */
  function setAuthority(on) {
    on = !!on;
    if (on === _authority) return;
    _authority = on;
    _foesSeqIn = -1;
    for (const f of [...foes.slice(0, _layoutFoes), ..._sharedById.values()]) {   // REST-SYNC: the room's encounters hand over too
      if (!f) continue;
      if (on) {
        const p = f._pup;
        if (p) { f.ai.feet[0] = p.feet[0]; f.ai.feet[1] = p.feet[1]; f.ai.feet[2] = p.feet[2]; f.ai.yaw = p.yaw; }
        f.ai.resumeLive?.();
        if (f.attack?.machine) { f.attack.machine.state = 'Idle'; if ('acc' in f.attack.machine) f.attack.machine.acc = 0; }
        if (f.attack) f.attack.firedRanged = false;
        f._swingSeq = f.attack?.swingSeq ?? 0;
        if (f.mobile) { f.mobile.doMeleeDamage = false; f.mobile.shootArrow = false; }   // WORLD2 dropped unconsumed: no blow from a puppet's last frame on the first live one
        f._castPending = false;
      }
      // AUDIT WORLD3 D3: the OFF direction forgot the motor's target, and nothing on a puppet ever writes it again -
      // so a stale PEER candidate sat in ai.target and updateMissiles minted a streamed cast's aimFoe from it, which
      // no capsule test can ever strike: an ex-host took no spell damage from the room's foes at all.
      if (!on) { f.ai.target = null; f.ai.secondaryTarget = null; f.ai.targetSenses = null; }
      f._pup = null;
      f._pupMismatch = false;
      f._pupTarget = null; f._pupMine = false;   // WORLD3
      f._sentKey = null;
    }
    if (!on) _foesFrom = null;   // AUDIT WORLD2 A1: the next stream, whoever's, starts its count over
  }

  // S12: the dungeon world snapshot. Foes persist by SPAWN ORDER
  // (marker order is deterministic per location rebuild); piles by
  // index; action objects by their stable keys. The action-object
  // record itself is ActionSystem's law (collectSaveData /
  // restoreSaveData) - a mover's pose IS its {state, t}, and a door
  // carries a second pair for the record's Move tween.
  const _locationKey = `dungeon:${dfLocation?.dungeon?.recordElement?.header?.locationId ?? 'probe'}`;
  const _sharedStamp = mintSharedStamp();   // AUDIT WORLD B1: this context's mark on the memory it publishes - a reconnect's welcome never hands it back; AUDIT WORLD6a B7: twelve digits always, from the wire's one mint
  let _sharedApplied = false;   // AUDIT WORLD B7: the room's memory lands on a freshly built pool ONCE; a second apply onto a live fight is slice 3's events
  // WORLD2 (Mac: "Lets continue on with the next phase"): ONE SIMULATION PER ROOM. While another hosts the room I am
  // not the authority: my layout foes (the first _layoutFoes of the pool) are PUPPETS that follow the host's stream
  // and decide nothing, and my blows on them go out as hits for the host's own damage door. The seat's handover
  // turns _authority on and the puppets live, from the pose the stream left them in.
  let _authority = true;
  let _foesSeq = 0;        // the host's frame counter out
  let _foesSeqIn = -1;     // the last frame counter in (an older frame is stale, not the world)
  let _foesFrom = null;    // AUDIT WORLD2 A1: whose stream the counter counts - a new host's starts over
  let _keyMismatchSaid = false;   // AUDIT WORLD34 B2: a stream keyed to another layout is refused and said once
  // WORLD3 (Mac: "Begin"): THE LIVE WORLD AS EVENTS.
  // - THE DOORS: every change an outermost entry makes to the action graph (a click, a bash, a pick, a walk onto a
  //   trigger, the host's foe opening a door) goes out as its changed records (actions.onChanged -> opts.onActions,
  //   keyed by this dungeon) and another's lands through applyActions -> actions.applyRemote. Anyone's, not the host's
  //   alone: a door is whoever touched it.
  // - THE HOST'S FOES SEE EVERY PLAYER: the peers ride the target machine as candidates minted off the pose stream
  //   (peerCandidates - one identity per id, so the machine's reference compares hold), and the stream's record
  //   carries the target (g: '.' the host, an id a peer, '' none) and the cast (c the count, s the spell).
  // - A PUPPET RESOLVES THE HOST'S FOE'S BLOWS AGAINST ME: when the streamed target is me, the melee frame, the arrow
  //   and the spell land here with my own reach and my own stats (the host decided the swing; I decide the hit); at
  //   another they are the swing's clip, a shaft and a cast that pay nothing.
  // - THE ROSTER IS THE ROOM'S: a species the stream or the memory disagrees with is REBUILT at that index (retypeFoe).
  const _peerCands = new Map();   // id -> { isPlayer, isPeer, id, feet, height, health }
  let _peerFrame = 0, _peerRead = -1;
  /** The peers in my room as target candidates (WORLD3) - read once a frame off the world host, each a stable
   *  identity; a peer gone is dead to the machine (health 0, targetHealth's read) and dropped. */
  function peerCandidates() {
    if (_peerRead === _peerFrame) return [..._peerCands.values()];
    _peerRead = _peerFrame;
    const list = opts.peers?.() ?? null;
    if (!list) { for (const c of _peerCands.values()) c.health = 0; _peerCands.clear(); return []; }
    const seen = new Set();
    for (const q of list) {
      if (!q || typeof q.id !== 'string' || !Array.isArray(q.feet) || q.feet.length !== 3 || !q.feet.every(Number.isFinite)) continue;
      seen.add(q.id);
      let c = _peerCands.get(q.id);
      if (!c) { c = { isPlayer: true, isPeer: true, id: q.id, feet: [0, 0, 0], height: CAPSULE_HEIGHT, health: 1, cv: 0, concealment: () => concealFlagsOfBits(c.cv) }; _peerCands.set(q.id, c); }   // INVIS-NET: its concealment, off its pose - EnemySenses.BlockedByIllusionEffect reads a peer as it reads any target
      c.feet[0] = q.feet[0]; c.feet[1] = q.feet[1]; c.feet[2] = q.feet[2];
      c.height = Number.isFinite(q.height) && q.height > 0 ? q.height : CAPSULE_HEIGHT;
      c.health = 1;
      c.cv = q.cv | 0;
    }
    for (const [id, c] of _peerCands) if (!seen.has(id)) { c.health = 0; _peerCands.delete(id); }
    return [..._peerCands.values()];
  }
  const peerCandidate = (id) => { peerCandidates(); return (typeof id === 'string' && _peerCands.get(id)) || null; };
  // the doors: what an entry changed goes out (the session refuses it outside a world room)
  if (opts.onActions) actions.onChanged = (recs) => opts.onActions({ k: _locationKey, a: recs });
  /** WORLD3: another's change to this dungeon's doors, levers and movers - keyed by this dungeon. */
  function applyActions(id, data) {
    if (!data || typeof data !== 'object' || data.k !== _locationKey) return false;
    // WORLD3 the doors, WORLD4 the loot - one frame, either half or both
    if (Array.isArray(data.c)) camps.applyOwner(id, data.c);   // SURV3: their camps, replacing theirs alone (their word is the whole of theirs)
    const asked = data.rs != null && roomEncounterAsked(id, data.rs);   // REST-SYNC: a joiner's rest asks the host for its encounter
    const n = (Array.isArray(data.a) ? actions.applyRemote(data.a) : 0) + (Array.isArray(data.l) ? applyLoot(data.l) : 0);
    return n > 0 || asked;
  }
  // WORLD4 (Mac: "Lets start on slice 4"): THE ROOM'S LOOT. A container nobody has opened is each client's OWN roll -
  // the room knows nothing of it and the memory carries nothing for it, which is what "the memory carries emptied,
  // not contents" asked for. The moment anyone OPENS one it becomes the ROOM's: its contents are published, everyone
  // adopts them in place, and every later take is published on the window's close - the same moment DFU's own law
  // frees an emptied pile's flat. From then on the room's memory carries that container, and only that container.
  // AUDIT WORLD4 C1: in place EXCEPT under an open window - a container you have open is yours until you close it.
  // WORLD4 said "a window already open updates under the reader's hands"; the default skin's pack binds each loot
  // row to the item OBJECT and never repaints, so that landing orphaned every row and the next click took the item
  // AND left it in the chest. That sentence is struck.
  const _lootSeen = new Set();   // the containers this client knows the room has opened
  /** AUDIT SETS M2: the containers whose room word THIS build cannot read (a newer game's item in the list). An older
   *  build refused the record and carried on as if the room had never spoken - its open CLAIMED the container with its
   *  own roll and its close said that roll, so every piece a newer player had stored there was gone for the room and
   *  its memory. Such a container is the room's, unread: never opened, claimed or closed over here. */
  const _lootUnreadable = new Set();
  const _lootAt = new Map();     // WORLD8: canon -> when the room last spoke about it (the relay's clock); the hour's respawn reads it
  let _lootOpenKey = null;       // AUDIT WORLD4 C1: the container THIS player has a window open on
  const _lootTooBig = new Set(); // AUDIT WORLD4 A1/A2/B2/D1: the containers this client cannot say (said once)
  /** AUDIT WORLD4 C4: the CANONICAL spelling of a container key, or null. The key arrives off the wire beside the
   *  list, and only the list was projected: `Number('0x0a')`, `'1e1'`, `' 10 '` and `'0000000010'` all named pile 10,
   *  so one peer could mint an unbounded family of aliases for one container - each landing in `_lootSeen`, each
   *  emitting a full record into the room's memory until the memory itself was too large to publish and the room
   *  stopped remembering anything. One spelling per container, re-spelt here, and nothing else is a key. */
  const LOOT_KEY_RE = /^(loot|corpse|enc):(0|[1-9][0-9]{0,4})$/;   // REST-SYNC: `enc:<id>` a shared encounter's body
  function lootKeyOf(key) {
    if (typeof key !== 'string') return null;
    const m = LOOT_KEY_RE.exec(key);
    return m ? `${m[1]}:${Number(m[2])}` : null;
  }
  /** CORPSE-GOLD: the records in a memory's loot list that name the layout body at `i` (by the canonical spelling, as
   *  applyLoot reads them) and no other container. The rest of the list landed with the restore, and a player may
   *  have taken from those containers since - landing them again would fill them back up. */
  function bodyRecords(list, i) {
    const key = `corpse:${i}`;
    return Array.isArray(list) ? list.filter((rec) => lootKeyOf(rec?.k) === key) : [];
  }
  /** WORLD4: the container a loot key names - the pile or the corpse whose items ARE the room's list, or null.
   *  The key vocabulary is takeLoot's own (`loot:<i>` the layout's pile order, `corpse:<i>` the layout's foe run);
   *  a dropped pile is the dropper's alone (AUDIT WORLD B3) and is not one of these. */
  /** AUDIT 68 S19-removed-foe-lootable: a LOOTABLE BODY is a dead foe that has a corpse - `f.corpse`, set at the mint
   *  (every real death: the kill, the stream, the restore) and cleared by freeCorpse. A foe Destroy()ed (dispel,
   *  Wabbajack, a quest's removal - questPoolOps.removeFoe) is dead with no corpse and is NOT a container, which the
   *  shared Detect walk (corpseNearbyRecords) already said; the doors below read `dead` alone, so an invisible body
   *  holding the whole inventory stood at the removed foe's feet. One predicate for every door. */
  function lootableBody(f) { return !!f?.dead && !!f.corpse && f._ownFrom == null; }   // QUEST-PARTY phase 3c: a party member's quest foe's body is its owner's (a quest's loot stays its host's)
  function lootHolder(key) {
    const canon = lootKeyOf(key);
    if (!canon) return null;
    const [kind, iStr] = canon.split(':');
    const i = Number(iStr);
    if (kind === 'loot') { const p = lootPiles[i]; return p && Array.isArray(p.items) ? p.items : null; }
    // a corpse past the layout's run is this player's own foe (a quest spawn, a summon) and its body is too
    if (kind === 'corpse') { const f = foes[i]; return i < _layoutFoes && lootableBody(f) && Array.isArray(f.entity?.items) ? f.entity.items : null; }
    // REST-SYNC: a rest's encounter is the room's, and so is its body - by the room's number, its pool index being
    // each client's own. Every copy rolled its own list; the first opener's is the room's, as a layout body's is.
    if (kind === 'enc') { const f = _sharedById.get(i); return lootableBody(f) && Array.isArray(f.entity?.items) ? f.entity.items : null; }
    return null;
  }
  /** REST-SYNC: the ROOM's name for the container this client names `key` (a target's, a window's) - a shared
   *  encounter's body is `enc:<id>`, every other its own canonical key; null when the room holds no such container. */
  function roomLootKey(key) {
    let canon = lootKeyOf(key);
    if (canon?.startsWith('corpse:')) { const f = foes[Number(canon.slice(7))]; if (f?._encId != null) canon = `enc:${f._encId}`; }
    return canon && lootHolder(canon) ? canon : null;
  }
  /** WORLD4: a pile's flat follows its contents - freed when the container is emptied (DFU frees it on the window's
   *  CLOSE, and the same settle runs for a container the ROOM emptied while I stood beside it) and RE-MINTED when the
   *  room's word puts items back into one this client had already emptied.
   *  AUDIT WORLD4 C3/D2: the settle had only the freeing half, where the save's own restore has always had both - so
   *  a refilled pile kept its items with no batch, and every read that lets a player see or touch a pile gates on
   *  the batch: it went invisible, un-hoverable and un-openable for ever, while staying real for everyone else. ONE
   *  HOME for both directions now, and the save's arm calls it too. */
  function settleLootFlat(i) {
    const p = lootPiles[i];
    if (!p) return;
    if (!p.items.length && p.batch) {
      const bi = billboardBatches.indexOf(p.batch);
      if (bi >= 0) billboardBatches.splice(bi, 1);
      renderer.destroyBillboardBatch(p.batch);
      p.batch = null;
    } else if (p.items.length && !p.batch && p.half) {
      p.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, p.record, { w: p.half[0] * 2, h: p.half[1] * 2 }, [[p.pos[0], p.pos[1], p.pos[2]]]);
      billboardBatches.push(p.batch);
    }
  }
  /** WORLD4: what this client would tell the room about these containers RIGHT NOW - the shape the room adopts.
   *  AUDIT WORLD4 A2/B2/D1: a container holding more than the room can SAY is skipped here, at the mint. The cap was
   *  a law the reader alone obeyed, so a container a player had stored past it was sent, refused whole and in
   *  silence by every receiver, and then WIPED on that player by the next reader's claim. What cannot be said is not
   *  said, once, out loud - and the container stays this player's own. */
  function lootRecords(keys) {
    const out = [];
    for (const key of keys ?? []) {
      const canon = lootKeyOf(key);
      const held = canon && lootHolder(canon);
      if (!held) continue;
      if (held.length > LOOT_LIST_MAX) {
        if (!_lootTooBig.has(canon)) {
          _lootTooBig.add(canon);
          console.warn(`[loot] ${canon} holds ${held.length} items, more than the room can carry (${LOOT_LIST_MAX}); it stays yours alone`);
        }
        continue;
      }
      _lootTooBig.delete(canon);
      out.push({ k: canon, r: unbound(held).map((it) => ({ ...it })), ...(Number.isFinite(_lootAt.get(canon)) ? { t: _lootAt.get(canon) } : {}) });   // WORLD8: the stamp rides the record   // AUDIT SS: and never a bound piece (itemBound.js) - an older build connected beside this one would land it
    }
    return out;
  }
  /** WORLD4: this container is the room's now - said on the OPEN (so a second reader adopts the first's list rather
   *  than their own roll) and again on the CLOSE (what is left after the taking).
   *  AUDIT WORLD4 C2/D5: a CLAIM speaks only for a container the room has NOT already spoken about. It used to
   *  assert this client's list unconditionally, so a joiner inside the memory's fifteen-second window - or anyone
   *  whose frame the relay had dropped - re-filled a chest the room had emptied, and a player who had STORED into
   *  one had their stash overwritten by the next reader's untouched roll. */
  function publishLoot(key, { claim = false } = {}) {
    const canon = lootKeyOf(key);
    if (!canon || !lootHolder(canon)) return false;
    if (_lootUnreadable.has(canon)) return false;   // AUDIT SETS M2: never over a word this build cannot read
    if (claim && _lootSeen.has(canon)) return false;   // the room has already spoken about this one
    // WORLD8: my own word about it, stamped now - BEFORE the record is minted (AUDIT WORLD7/8 C1: minted first, the
    // record carried the PREVIOUS word's stamp, and a chest closed an hour after its last use was skipped by every
    // receiver as due back - a stash lost in silence)
    const _t = _wallNow(); if (_t != null) _lootAt.set(canon, _t);
    const l = lootRecords([canon]);
    if (!l.length) { _lootAt.delete(canon); return false; }   // too large to say - it stays this player's own
    const first = !_lootSeen.has(canon);
    _lootSeen.add(canon);
    if (first) opts.onLootClaimed?.();                 // D5: the memory goes out now, not up to fifteen seconds from now
    return !!opts.onActions?.({ k: _locationKey, l });
  }
  /** WORLD4: the room's word about a container, landed IN PLACE.
   *  AUDIT WORLD4 C1: except on the container this player has OPEN. The default skin's pack renders its loot rows
   *  from a snapshot and binds each row to the item OBJECT, and nothing repaints it - so refilling the array under
   *  an open window left every row an orphan, and the next click took the item into the pack AND left it in the
   *  chest (the transfer's splice is index-guarded), making two of one. A container you have open is yours until
   *  you close it; your own close is then the room's newest word, which is the same last-writer-wins the slice
   *  already runs on. */
  function applyLoot(list) {
    let n = 0;
    for (const rec of Array.isArray(list) ? list : []) {
      const canon = lootKeyOf(rec?.k);
      if (!canon) continue;
      const items = unbound(validLootList(rec.r));   // SS3: a container is the room's - a bound piece in one never lands
      if (!items) { if (lootHolder(canon) && !respawnDue(rec.t, _wallNow())) { _lootSeen.add(canon); _lootUnreadable.add(canon); } continue; }   // AUDIT SETS M2: the room has spoken, in words this build cannot read (a word due back is the room's no longer - WORLD8)
      const held = lootHolder(canon);
      if (!held) continue;
      const _now = _wallNow();
      _lootUnreadable.delete(canon);   // AUDIT SETS M2: a word it can read again
      if (respawnDue(rec.t, _now)) continue;   // WORLD8: the room emptied it more than an hour ago - due back; my own roll stands and the record is not the room's word any more
      _lootSeen.add(canon);   // the room HAS opened it, whether or not I may land it right now
      { const _t = Number.isFinite(rec.t) ? (_now == null ? rec.t : Math.min(rec.t, _now)) : _now; if (_t != null) _lootAt.set(canon, _t); }   // WORLD8: the room's stamp, or now for a record without one; AUDIT WORLD7/8 C2: never AHEAD of now - a peer's far-future stamp switched the hour off for everyone and rode into the memory for thirty days
      if (canon === _lootOpenKey) { n++; continue; }   // C1: not under an open window
      held.length = 0;
      for (const it of items) held.push(it);
      if (canon.startsWith('loot:')) settleLootFlat(Number(canon.slice(5)));
      n++;
    }
    return n;
  }
  const _retyping = new Set();
  /** WORLD8: the relay's clock now (a wall millisecond), null offline - the stamps' and the hour's one reading. */
  // AUDIT WORLD7/8 B1: the RELAY's millisecond - the wire's inverse over the shared world minute, no offset subtracted
  // (sharedWallMs subtracts this machine's offset back out: it is THIS machine's clock, right for OL3's display and wrong
  // for a stamp two machines compare - a host forty minutes slow made every joiner see a cleared dungeon alive)
  const _wallNow = () => (sharedClockOn() ? wallMsForClassicMinutes(worldMinutes()) : null);
  /** WORLD8: the corpse flat freed by its foe - setFoeDead's un-death arm, shared with the respawn (which rebuilds the
   *  record rather than waking the old one). */
  /** AUDIT 32 H3: WHERE A BODY LIES - its corpse's landing (spawnCorpseNow), else the feet: the dungeon's one corpse lens,
   *  read by its loot's box and by Hunting's body. A flyer's (a Giant Bat's, a Harpy's) and a swimmer's box and node
   *  stood where it died, a metre over its corpse on the floor. */
  function corpseAt(f) { return f?.corpsePos ?? f?.ai?.feet ?? null; }
  function freeCorpse(f) {
    f.corpse = false;   // BLOOD2c: no body, no pool - a resurrected or respawned foe starts clean
    f.corpsePos = null;
    if (!f.corpseBatch) return;
    const bi = billboardBatches.indexOf(f.corpseBatch); if (bi >= 0) billboardBatches.splice(bi, 1);
    renderer.destroyBillboardBatch(f.corpseBatch);
    f.corpseBatch = null;
  }
  /** WORLD8: THE HOUR'S RESPAWN of the layout foe at `i` - the corpse freed, its body's loot record forgotten, and the
   *  foe REBUILT fresh at its marker through the one build chain (retypeFoe as its own species: a new entity at full
   *  health with its own loot roll, the old record dead to everything still holding it). The host's stream then says
   *  the index is alive and every puppet stands up through WORLD2's un-death door. */
  function respawnFoe(i) {
    const f = foes[i];
    // AUDIT WORLD7/8 C3/B1: every refusal the rebuild can make is asked FIRST - the corpse was freed and the stamp
    // cleared before a rebuild that could refuse (no marker, a species that cannot stand, a rebuild already in
    // flight), and the foe was then dead, bodiless and never due again
    if (!f || !f.dead || i >= _layoutFoes || !f.src || _retyping.has(i) || !canStandFoe(f.mobileType)) return false;
    if (f.abyssDestroyed) return false;   // AUDIT OH-F B5/C1: Object.Destroy's enemy (the drowned dungeon's flame foe) is gone for good
    if (_lootOpenKey === `corpse:${i}`) return false;   // B7: a body I have open is mine until I close it (AUDIT WORLD4 C1's law, the foe half)
    // B2: the corpse is freed and the body's record forgotten on SUCCESS; a rebuild that fails (a fetch, the context
    // torn down) keeps the stamp so the sweep tries again, and the body stays where it was
    const stamp = f._diedAt;
    f._diedAt = null;   // the in-flight latch: the sweep does not fire twice
    return Promise.resolve(retypeFoe(i, f.mobileType, f.gender ?? null)).then((ok) => {
      if (ok) return true;   // AUDIT 68 S19-retype-orphans-corpse: the body and its record left with the rebuild's stand()
      if (foes[i] === f && f.dead) f._diedAt = stamp;
      return false;
    });
  }
  let _respawnSweptAt = -Infinity;
  const RESPAWN_BURST = 4;   // AUDIT WORLD7/8 B9: rebuilds a sweep tick starts (each awaits its art and mints a batch)
  /** WORLD8: the sweep, once a second - the HOST rebuilds its layout's foes dead past the hour (the stream carries the
   *  rest); every client forgets the containers the room emptied past the hour and rolls its piles again. Offline the
   *  clock answers null and nothing is due (a save keeps its dead, DFU's own). */
  function respawnSweep(nowSeconds) {
    if (nowSeconds - _respawnSweptAt < 1) return;
    _respawnSweptAt = nowSeconds;
    const now = _wallNow();
    if (now == null) return;
    if (_authority) { let n = 0; for (let i = 0; i < Math.min(_layoutFoes, foes.length) && n < RESPAWN_BURST; i++) { const f = foes[i]; if (f?.dead && respawnDue(f._diedAt, now) && respawnFoe(i)) n++; } }   // B9: a room cleared in one sitting comes back over a few seconds, not in one
    for (const canon of [..._lootSeen]) {
      if (canon === _lootOpenKey) continue;   // a window I have open is mine until I close it (AUDIT WORLD4 C1); AUDIT WORLD7/8 C6: asked before the room's word is forgotten
      if (!respawnDue(_lootAt.get(canon), now)) continue;
      _lootSeen.delete(canon); _lootAt.delete(canon);
      if (canon.startsWith('loot:')) { const i = Number(canon.slice(5)); const p = lootPiles[i]; if (p && Array.isArray(p.items) && p.items.length === 0) { p.items = rollPileItems(); settleLootFlat(i); } }   // AUDIT WORLD7/8 C4: a pile the room EMPTIED - one with a remainder keeps it, as the apply's skip keeps the local list
    }
  }
  /** WORLD3: the room's roster - the layout foe at `i` rebuilt as another species (and gender) through the one build
   *  chain, standing at its marker until the stream or the record poses it; once at a time per index, never past
   *  the layout's run. AUDIT WORLD34 B1: a DEAD one too - two players' random flats differ by level, so a joiner
   *  whose own save had killed the foe at `i` refused the rebuild for the life of the context, and the room's live
   *  foe there stood mismatched: frozen, and invulnerable to that joiner (damageFoe keeps a mismatched puppet's blow
   *  home). The record that follows the rebuild lands it dead or alive as the room has it. */
  /** AUDIT FOES FOE4: how many times each index's rebuild has REFUSED - the host re-offers a mismatched index for
   *  ever, so a build that cannot succeed on this machine must stop being asked. Cleared by a rebuild that lands. */
  const _retypeFails = new Map();
  const RETYPE_TRIES = 3;
  async function retypeFoe(i, mobileType, gender = null, { anyFoe = false, at = null } = {}) {
    const f = foes[i];
    // AUDIT WORLD3 E3: the same guard buildFoeAt uses. ENEMY_BASICS[39] exists with maleTexture 0, so both build
    // branches skip it, the fallback flat runs, stand() is never called and the retry fires again on every frame of
    // the stream - pushing a dead entry into the build-time-only flatGroups map each time, for ever.
    // OH-E: `anyFoe` - There's a Hole in the Bottom of the Ocean's ApplyEnemySettings reaches a spawned foe too, and
    // `at` stands the new body where the old one is (AlignToGround from its own place), not at its marker.
    if (!f || (!anyFoe && i >= _layoutFoes) || !f.src || _retyping.has(i) || !canStandFoe(mobileType)) return false;
    _retyping.add(i);
    try {
      const rec = await buildFoeAt({ ...f.src, ...(at ?? {}), mobileType, gender: gender === 'female' || gender === 'male' ? gender : undefined }, true, { at: i });
      const landed = !!rec && foes[i] === rec;
      // AUDIT RENOWN1 GAME-10: a LIVE foe stood again in another body (a joiner's copy rebuilt as the host's species) is
      // the same fight, and my blows on it still count; a dead one's rebuild (the stream's un-death, the hour's respawn)
      // is a new fight, and carries nothing
      if (landed && !f.dead) renownFoeCarry(f, rec);
      return landed;
    } finally { _retyping.delete(i); }
  }
  /** MAC6 #1: where this dungeon stands - its map pixel and map id, for the save (null for a location with no map row: the probe). */
  const dungeonHome = () => {
    const mt = dfLocation?.mapTableData;
    if (!mt || !Number.isFinite(mt.longitude) || !Number.isFinite(mt.latitude)) return null;
    const p = longitudeLatitudeToMapPixel(mt.longitude, mt.latitude);
    return { pixel: { x: p.x, y: p.y }, mapId: mt.mapId ?? null };
  };
  function collectWorld() {
    return {
      foes: foes.filter((f) => f._ownFrom == null && f.companion == null).map((f) => ({   // CREW-COMPANIONS: a companion is the party's (navalHost's save), never the room's - he would stand twice on a load   // QUEST-PARTY phase 3c: a party member's quest foe is its owner's, never this save's
        health: f.entity.health, dead: !!f.dead,
        died: f.dead && Number.isFinite(f._diedAt) ? f._diedAt : null,   // WORLD8: when it fell, the relay's clock - the hour's respawn reads it
        ...(f.abyssDestroyed ? { abyssDestroyed: true } : {}),   // AUDIT OH-F B1: Object.Destroy'd - in DFU's save not at all
        ...(f.dead && (f.escaped || f.executed || f._swornAway) ? { noBody: true } : {}),   // REVENANT-FATE (the 2026-10-02 audit): fled, burnt away or sworn - gone with no body, so a load lays none
        feet: [...f.ai.feet], yaw: f.ai.yaw, anchor: 1,   // REVIEW 2026-09-05: feet under the enemyAnchor law (a pre-fix save carries no stamp)
        items: (f.entity.items ?? []).map((it) => ({ ...it })),
        // CH4 (the senses verify pass): SerializableEnemy carries
        // isHostile + hasEncounteredPlayer (:113-114, restored at
        // :182-183) and currentMagicka (:112/:178 - a discharged
        // caster must not refill on load). The port's halves.
        hostile: f.ai.isHostile !== false,
        encountered: !!f.ai.hasEncounteredPlayer,
        magicka: f.entity.magicka ?? 0,
        // AUDIT 26 F220: SerializableEnemy also round-trips
        // startingHealth (entity.MaxHealth, :109), currentFatigue
        // (:111) and the instanced effect bundles (:120, restored
        // :222). Without maxHealth a rebuild-then-restore load
        // re-rolled it (enemyEntity.js:121) and restored health could
        // sit above the new max; without activeEffects a paralyzed
        // boss woke and a burning foe stopped burning on load.
        // AUDIT WORLD B4: the species. Two players' random flats differ by level (dungeonEnemies.js bands the pick
        // on playerLevel), so a record that reaches another client patches only its own kind at that index.
        mobileType: f.mobileType,
        gender: f.gender,   // WORLD3: and the gender, so a rebuilt roster wears the right sheet
        maxHealth: f.entity.maxHealth,
        fatigue: f.entity.fatigue ?? 0,
        activeEffects: (f.entity.activeEffects ?? []).map(copyEffectEntry),
        // AUDIT 63 F26: the TEAM pair - SerializableEnemy.cs:125
        // `data.team = (int)entity.Team + 1;` (the live entity) and
        // :121 alliedToPlayer (the per-mobile MobileEnemy struct copy,
        // this port's `entity.mobileTeam`). Record fidelity here: this
        // host's applyWorld patches the LIVE foes in place, so a
        // same-context load already keeps the team - but the fields
        // belong in the record, and the exterior pool's half of F26
        // (which re-mints) is the observable one.
        team: f.entity.team, mobileTeam: f.entity.mobileTeam,
        // AUDIT 63 F29: WabbajackActive (:124, restored :172).
        wabbajackActive: !!f.entity.wabbajackActive,
        // AUDIT 63 F27: SpecialTransformationCompleted (:126, restored
        // :225-228 through the setter).
        specialTransformationCompleted: !!f.mobile?.specialTransformationCompleted,
      })),
      piles: lootPiles.map((p) => ({ items: p.items.map((it) => ({ ...it })) })),
      // AUDIT 23 (save-load-4): player-dropped piles are containers in
      // DFU's save (LootContainerData_v1) - without them a boot load
      // vanished drops and a backward load duplicated them.
      // G5: textureArchive rides beside textureRecord - the PAIR is
      // what LootContainerData_v1 stores, and a cycled drop icon is
      // lost without it.
      droppedTorches: droppedTorches.snapshot(),   // HT1: HandheldTorchesSaveData
      camps: camps.snapshot(),   // SURV3: my fires, the same law
      droppedLoot: droppedLoot._piles.map((p) => ({
        pos: [...p.pos], archive: p.archive, record: p.record, items: p.items.map((it) => ({ ...it })),
      })),
      actions: actions.collectSaveData(),
      // AUDIT 63 F30: PlayerEnterExit.PlayerTeleportedIntoDungeon.
      // SerializablePlayer.cs:188-191 writes it ONLY under
      // `IsPlayerInsideDungeon` and :402-405 restores it ONLY when the
      // save was `insideDungeon` - so it belongs in THIS host's
      // envelope, where both gates are true by construction, and not
      // in ENTITY_FIELDS, which is copied blind in both directions.
      // Its sole consumer is DaggerfallAction.cs:262's
      // CastleDaggerfallMagicDoorsSpecialOpenHack ("just to prevent
      // player being locked inside throne room"): load a
      // teleported-in slot while standing in Castle Daggerfall having
      // walked in, and without this the foyer doors stayed held.
      teleportedIntoDungeon: !!playerEntity.playerTeleportedIntoDungeon,
    };
  }
  /** One saved foe record onto its live foe (applyWorld's per-foe body; WORLD3: and onto a foe rebuilt for it). */
  function patchFoe(f, sf, wire = false) {
    f.entity.health = sf.health;
    // AUDIT WORLD4 B3: a foe's item list off the WIRE is a container's list by another name - `corpse:<i>` reads
    // exactly this array - and it landed here with no projection at all, so the clamp WORLD4 put on the live frame
    // was bypassed for half its own vocabulary, and one malformed record threw out of the socket handler after
    // `_sharedApplied` was already set, leaving the restore half applied and never retried. Presence-gated, so a
    // record without the field - which is every record the memory writes since AUDIT WORLD4 D4 - leaves this foe's
    // own roll alone. A save off DISK is this client's own word and keeps its list whole.
    if (!wire) f.entity.items = sf.items.map((it) => ({ ...it }));
    else if (sf.items != null) { const li = unbound(validLootList(sf.items)); if (li) f.entity.items = li; }   // SS3: nor a bound piece on a body
    // REVIEW 2026-09-05: a save written before the enemyAnchor law holds
    // every idle bat's feet AT its marker; the rebuilt spawn stands
    // correctly and the old feet would put it back into the ceiling.
    if (!keepRebuiltSpawn(sf, f.ai.feet, f.idleH, f.mobile?.basics?.behaviour ?? 'General', f.marker ?? null)) { f.ai.feet[0] = sf.feet[0]; f.ai.feet[1] = sf.feet[1]; f.ai.feet[2] = sf.feet[2]; }
    f.ai.yaw = sf.yaw;
    // CH4: the senses/resource halves restore when the save carries
    // them (:182-183 motor.IsHostile / senses.HasEncounteredPlayer,
    // :178 SetMagicka); saves from before CH4 leave the live state.
    if (sf.hostile != null) f.ai.isHostile = !!sf.hostile;
    if (sf.encountered != null) f.ai.hasEncounteredPlayer = !!sf.encountered;
    if (sf.magicka != null) f.entity.magicka = sf.magicka;
    // F220, presence-gated like every additive field: the saved max
    // replaces the re-roll BEFORE health lands on the next line's
    // ordering guarantee (health was already set above - re-clamp).
    if (sf.maxHealth != null) { f.entity.maxHealth = sf.maxHealth; f.entity.health = Math.min(f.entity.health, sf.maxHealth); }
    if (sf.fatigue != null) f.entity.fatigue = sf.fatigue;
    if (sf.activeEffects) f.entity.activeEffects = sf.activeEffects.map((a) => ({ ...a, ...(a.effect ? { effect: { ...a.effect } } : {}), ...(a.statMods ? { statMods: { ...a.statMods } } : {}), ...(a.skillMods ? { skillMods: { ...a.skillMods } } : {}), ...(wire && Number.isFinite(a.lastMinute) ? { lastMinute: Math.floor(ownMinutes()) } : {}) }));   // AUDIT LIVED1 V (P6): a poison's minute off the WIRE was stamped on the publishing host's own clock, days from this one's - it resumes at this host's now rather than landing the whole gap in one round
    // AUDIT 63 F26 / F29: the team pair (:179-181 + :157) and the
    // Wabbajack latch (:172), presence-gated. `!= null` and not a
    // truthiness test for the latch, so a BACKWARD load lowers a
    // flag raised after the save, which is what the C#'s
    // unconditional assignment over a rebuilt enemy does.
    if (sf.team != null) f.entity.team = sf.team;
    if (sf.mobileTeam != null) f.entity.mobileTeam = sf.mobileTeam;
    if (sf.wabbajackActive != null) f.entity.wabbajackActive = !!sf.wabbajackActive;
    // AUDIT 63 F27: the Seducer's transformation, BEFORE the corpse
    // arm below - spawnCorpse reads f.mobile.basics.corpseTexture,
    // and only the setter has rewritten it to the winged 400/5 by
    // then (SerializableEnemy.cs:225-228 -> Base/MobileUnit.cs
    // :208-224). The inverse arm is this host's alone: DFU restores
    // over a re-instantiated mobile, so a saved FALSE means an
    // untransformed Seducer, and a host that patches in place has to
    // undo the struct-copy rewrite and re-mint the transform clock -
    // the same rewind SL2's un-kill arm below spells for death.
    if (sf.specialTransformationCompleted && f.mobile && !f.mobile.specialTransformationCompleted) {
      f.mobile.setSpecialTransformationCompleted();
    } else if (sf.specialTransformationCompleted === false && f.seducer) {
      // AUDIT 68 S05-seducer-rewind-incomplete: taken whether or not the live flag is up - a transform in
      // progress, a spent clock and the infighting latch all predate the save too (SetupDemoEnemy.cs:191-195's
      // fresh component on a rebuilt enemy).
      f.seducer.rewind();
    } else if (sf.specialTransformationCompleted === false && f.mobile?.specialTransformationCompleted) {
      f.mobile.clearSpecialTransformationCompleted();
    }
    // CORPSE-FOOD: and a body the room's memory hands an arrival without its list (the memory writes none since AUDIT
    // WORLD4 D4) is this copy's own roll too - food and all, as the stream's death above. A save off disk carries its
    // own list, and a room's list is the room's.
    if (wire && sf.dead && !f.dead && sf.items == null) { addCorpseFood(f.entity, { luck: liveStat(playerEntity, 'luck') }); stampWonWeapons(f.entity.items, 1); }   // SIGIL1: the sigils too, a fight nobody here saw
    if (sf.dead && Number.isFinite(sf.died)) { const _n = _wallNow(); f._diedAt = _n == null ? sf.died : Math.min(sf.died, _n); }   // WORLD8: the room's stamp, not this client's arrival; AUDIT WORLD7/8 B4: never AHEAD of now (a far-future stamp revoked the hour for thirty days)
    if (sf.dead && !f.dead) setFoeDead(f, true);
    // SL2 (AUDIT 23 save-load-2): the BACKWARD rewind. DFU's load
    // REBUILDS the location and RestoreSaveData SETS the saved
    // truth per LoadID (SerializableEnemy.cs:176 SetHealth; only
    // data.isDead disables, :200-203) - a foe killed AFTER the
    // save stands alive again and its corpse container, absent
    // from the save, leaves with the rebuild. The port patches in
    // place: un-kill and free the corpse flat by its foe (setFoeDead,
    // WORLD2's one door for the save and the stream).
    else if (!sf.dead && f.dead) setFoeDead(f, false);
  }
  function applyWorld(w, { truncate = true, wire = false } = {}) {
    // SL-3 (AUDIT 65): THE PICKPOCKET LATCH DIES WITH THE POOL - which
    // in this host means it has to be lowered by hand. DFU's load
    // REBUILDS the enemy set: SerializableStateManager.cs:404-425
    // InstantiatePrefab's a fresh GameObject per saved record, so
    // EnemyEntity's `PickpocketByPlayerAttempted` default is the loaded
    // truth for every enemy. The re-minting pools match that by
    // construction (exteriorFoes.js:2051's restoreWorld goes through
    // spawnFoe), but this host patches the LIVE foes in place, so a
    // same-dungeon reload kept a raised latch and a failed pickpocket
    // could never be retried - falsifying the law
    // player/mobileEnemyActivate.js:44-47 states in its own header.
    // A PRE-PASS over the WHOLE live pool, not a line in the loop
    // below: that loop visits only the indices the record carries.
    for (const f of foes) if (f?.entity) f.entity.pickpocketAttempted = false;
    // REVENANT-FATE (the 2026-10-02 audit): a judgement in flight is the replaced game's - a same-dungeon load patched the
    // foe whole and left it kneeling, or burning (its pile dropped after the load)
    for (const f of foes) { if (!f) continue; f.yielded = null; f.executing = null; f.sparing = null; f.trophy = null; f.yieldEvent = null; }
    if (truncate) clearOwnPuppets();   // QUEST-PARTY phase 3c: the save holds none (collectWorld), so its indices are this pool's without them - they stand again from their owners' next frames
    const _now = _wallNow();
    const settling = [];   // AUDIT OH-F B1: the restore's rebuilds - RestoreEnemyData is whole before the mod loop runs
    w.foes?.forEach((sf, i) => {
      const f = foes[i];
      if (!f || !sf) return;   // CORPSE-GOLD: a record the restore refused is a hole at its own index
      // AUDIT OH-F B1: an enemy Object.Destroy'd (the drowned dungeon's flame foe) is in no DFU save - the load stands
      // the saved set alone (SerializableStateManager.RestoreEnemyData), so it stays gone: no corpse, no loot, no respawn
      if (sf.abyssDestroyed) { if (!f.abyssDestroyed) { f.abyssDestroyed = true; questPoolOps.removeFoe(f); } return; }
      // WORLD8: a foe the room remembers dead past the hour is not applied dead - it is due back. A fresh build stands
      // as it is (the memory's record is skipped whole); a live one already dead here (this host stayed) is rebuilt
      if (wire && sf.dead && respawnDue(sf.died, _now)) {   // AUDIT WORLD7/8 B8: the ROOM's species first (WORLD3's roster law) - a fresh rebuild as the record's kind, alive
        if (sf.mobileType != null && sf.mobileType !== f.mobileType) settling.push(retypeFoe(i, sf.mobileType, sf.gender ?? null));   // AUDIT 68 S19-retype-orphans-corpse: the corpse leaves in stand(), on success - freed first, a refused rebuild left a bodiless dead foe
        else if (f.dead) respawnFoe(i);
        return;
      }
      if (sf.mobileType != null && sf.mobileType !== f.mobileType) {   // AUDIT WORLD B4: another species at this index (a save from before the field patches blind)
        // WORLD3: the roster is the ROOM's - rebuilt as the record's species, the record landing on the rebuilt foe.
        // AUDIT WORLD3 E1: the SAVE's restore takes the same arm. Before WORLD3 a mismatch here could only be a save
        // written by another build, and dropping it was the safe read; since WORLD3 the live roster can be the room's,
        // so this player's OWN save routinely disagrees with the fresh level-banded build - and the old `return`
        // silently discarded that slot's death, health, items, effects and team every time.
        // CORPSE-GOLD (2026-09-27, Discord: "out of sync dungeons can generate infinite gold upon entry if there are dead
        // corpses of monsters"): and the room's word about the BODY lands on it too. restoreSharedWorld applies the
        // memory's loot list the moment this arm returns, while the rebuild still awaits its art - so the foe at `i` was
        // still the fresh build's, alive and no container, and applyLoot skipped the body's record. The rebuild then
        // stood a fresh entity with its own loot roll (gold and all), stand() forgot `corpse:<i>`, and the record's
        // death laid that roll down as the body. A player whose level bands a random marker to another species than the
        // room's roster (a level gained since the room's first visit, a party member at another level) found every such
        // body the room had emptied full again, on every entry. The body's own record, once it stands dead (a save has
        // no loot list - its bodies carry their own items - so nothing lands there).
        settling.push(retypeFoe(i, sf.mobileType, sf.gender ?? null).then((ok) => { if (ok && foes[i]) { patchFoe(foes[i], sf, wire); applyLoot(bodyRecords(w.loot, i)); } }).catch((e) => console.error('[online] the rebuilt foe could not take the record - the foe stands as it is:', e)));   // AUDIT ONCRASH1 A1: the async tail has its own catch - `_deliver` cannot see past the promise it is handed
        return;
      }
      // REVENANT-FATE (the 2026-10-02 audit): one gone with no body (fled, burnt away, sworn) - out again with none: a save
      // of it had laid its corpse, its whole pack lootable (an executed one's twice over: its pile is the save's too). One
      // due back past the hour was rebuilt above, as any foe is
      if (sf.noBody && sf.dead) { if (!f.dead) questPoolOps.removeFoe(f); if (Number.isFinite(sf.died)) f._diedAt = sf.died; return; }
      patchFoe(f, sf, wire);
    });
    // SL2 / SerializableStateManager.RestoreEnemyData (:404-425): a
    // DFU load REBUILDS the scene and then instantiates exactly the
    // saved enemy set, so an enemy BORN AFTER the save - a quest
    // CreateFoe wave, a rest interruption - simply does not exist
    // afterwards. The port patches the live scene in place and every
    // late spawn APPENDS, so the live tail past the snapshot's length
    // is precisely that post-save population and has to be destroyed
    // by hand. Without this a backward load kept the wave alive AND
    // let the rewound CreateFoe counter (quest/actions.js saveShape)
    // mint it a second time.
    // WORLD1: the room's memory carries the layout's foes alone, so a shared restore leaves the pool past its
    // count standing - those are the quest owner's own foes; a save's restore still cuts to its record
    for (let i = foes.length - 1; truncate && i >= (w.foes?.length ?? 0); i--) {
      const f = foes[i];
      if (f.batch) { renderer.destroyBillboardBatch(f.batch); f.batch = null; }
      freeCorpse(f);   // AUDIT 68 S19-corpses-array-dead: the one helper, not a hand copy of it
      f.dead = true;
      f.questBehaviour?.notifyDestroyed();   // Destroy(gameObject): the resource uncouples
      // MT-iv (AUDIT 39, #40): a culled record keeps its HEALTH, and the
      // target machine's dead-target cull reads health - so a survivor
      // outside the spawn band holds this one for ever unless the sweep
      // runs here too. Every removal calls it; this was the one that did not.
      dropCandidate(f);
      if (f._encId != null) _sharedById.delete(f._encId);   // REST-SYNC: and the room's list - every puppet of it goes at the next full frame
      foes.splice(i, 1);
    }
    // SL2: pile items rewind BOTH ways and the flat FOLLOWS the
    // items, exactly where a rebuild-then-restore lands: an
    // emptied-in-save pile loses its flat (SerializableLootContainer
    // .cs:158-160 - Items.Count == 0 -> RemoveLootContainer on
    // restore) and a refilled-by-rewind pile gets the rebuild's own
    // mint back (p.half is the build-time size; a pile the build
    // never mounted stays unmounted).
    w.piles?.forEach((sp, i) => {
      const p = lootPiles[i];
      if (!p) return;
      p.items = sp.items.map((it) => ({ ...it }));
      settleLootFlat(i);   // AUDIT WORLD4 C3/D2: both directions, ONE HOME - this arm was the only one that had them
    });
    // AUDIT WORLD B3: the save's alone - the room's memory carries no drops (a drop is the dropper's own), and a
    // clearing restore would delete this player's floor stash and mint the host's under their feet
    if (truncate) droppedLoot.restorePiles(w.droppedLoot);   // AUDIT 23: absent list clears, per rebuild-from-save
    if (truncate) droppedTorches.restore(w.droppedTorches);   // HT1: the same law
    if (truncate) { camps.dropOwn(); camps.restore(w.camps); }   // SURV3; AUDIT SURV-TIERS (the third pass): the save says which fires are mine - a kit fire lit after it goes with the rewind
    // P10 + AUDIT 23 (save-load-11): state, lock and BOTH tweens
    // restore, then each object settles its matrix and collider bucket
    // (an open door no longer restores solid-and-closed, and a door
    // saved mid-rise keeps rising).
    actions.restoreSaveData(w.actions);
    // AUDIT 63 F30: SerializablePlayer.cs:402-405's
    // `if (data.playerPosition.insideDungeon) playerEnterExit
    // .PlayerTeleportedIntoDungeon = data.playerPosition
    // .playerTeleportedIntoDungeon;`. applyWorld runs only when the
    // save's locationKey IS this dungeon, which is that gate; a
    // pre-fix save carries no key and takes the C#'s not-assigned arm,
    // leaving the live flag standing.
    if (w.teleportedIntoDungeon != null) playerEntity.playerTeleportedIntoDungeon = !!w.teleportedIntoDungeon;
    // AUDIT OH-F B1: settled when every rebuild the restore started has stood and taken its record - DFU's
    // RestoreEnemyData is whole before SaveLoadManager's mod loop reads the dungeon (SaveLoadManager.cs:1497, :1519)
    return Promise.allSettled(settling).then(() => undefined);   // a rebuild that failed says so itself; a load never aborts on it
  }

  // Shared foe-damage path: melee and spells kill through the same
  // door (corpse + reaction). Factored in S5 so missiles do not grow
  // a second death path.
  /** AUDIT 58: HandleAttackFromSource's PLAYER ARM, lifted out of the
   *  damage door because DFU runs it on a CONNECTING swing whether or
   *  not the swing dealt anything. WeaponManager.WeaponDamage's damage
   *  fork closes at :615; :627 `enemyEntity.DecreaseHealth(damage)`
   *  and :630 `HandleAttackFromSource(PlayerEntityBehaviour)` are two
   *  unconditional statements after it, so a swing that lost the
   *  to-hit roll (calculateSuccessfulHit clamps 3..97 - a miss is
   *  always possible) still enrages what it touched. The port routed
   *  the pair through damageFoe alone, and every player-attack
   *  resolver skipped damageFoe at zero damage: a foe talked down by
   *  tryLanguagePacification stayed pacified and the room slept on.
   *  DaggerfallEntityBehaviour.cs:249-261's body is unchanged below. */
  function handleAttackFromPlayer(foe, playerFeet = null, peer = false, peerId = null) {
    if (!foe?.ai || foe.companion != null) return;   // AUDIT CC-B1: no blow of the player's - nor a peer's - turns a companion
    // AUDIT WORLD2 B9/C4: a PEER's blow (applyHit) turns the struck foe alone - the room-wide wake and the charmed
    // ally's revert are the host player's own attack, and a peer's is not it
    // ROAD-B: ...and the AREA turns with it.
    // DaggerfallEntityBehaviour.cs:249-261 is TWO calls in order -
    //     if (!enemyMotor.IsHostile) GameManager.MakeEnemiesHostile();
    //     enemyMotor.MakeEnemyHostileToAttacker(player);
    // - so striking one sleeping/passive foe wakes the WHOLE room,
    // and only the struck one learns where you are. The port had the
    // second call and not the first, which is why a passive RDB
    // guard could be picked off one at a time in a room full of
    // them. The `!isHostile` read has to happen BEFORE the walk,
    // because the walk flips this foe too.
    // ARENA2: a bout fighter struck from outside its bout (the player in the stands of an exhibition) - the floor never
    // turns for it; the bout's own hook answers (exteriorFoes' twin)
    const bout = foe.entity?.bout ?? null;
    if (bout && !peer && foeDeps && foeDeps.boutGate(foe, foeDeps.PLAYER_TARGET, true) !== true) { bout.hooks?.intrude?.(foe); return; }
    if (!peer && !foe.ai.isHostile) makeEnemiesHostile(foes);
    if (foeDeps) {
      // WORLD3: a peer's blow turns the foe on the PEER - its candidate, at the striker's feet the hit carried
      foe.ai.makeEnemyHostileToAttacker?.((peer && peerCandidate(peerId)) || foeDeps.PLAYER_TARGET, playerFeet ?? lastPlayerFeet);
      if (!peer) foeDeps.resetAllyTeamOnPlayerAttack(foe.ai, foe.entity, foe.mobileType);
    } else if (!foe.ai.isHostile) {
      foe.ai.isHostile = true; foe.ai.makeHostileToPlayer?.(undefined, lastPlayerFeet);   // wave 36: seeded with where the attack came from
    }
  }

  /** AUDIT 26 F035/F041: `fromPlayer` is this door's provenance flag,
   *  the third pool's copy of the same law - see exteriorFoes. */
  let _ecvT = 0;   // ECV1: the foe pass's clock (seconds), for the shimmer and the hit reveal - declared above its first reader
  /** PSCALE1: a SHARED foe - one of the layout's, which every client in the room holds by index and the host
   *  simulates for all of them. A foe past the layout (a quest's wave, a Wabbajack's change) is only mine to see -
   *  REST-SYNC: a rest's encounter is the room's now, and shared (isRoomFoe) - and my own summoned ally is nobody's to weigh. Offline, and in a dungeon split while its host is
   *  silent (SEAT-HEAL), only my own blows ever reach a copy, so its fighters are one and nothing is weighed.
   *  PSCALE-OWN (2026-09-27, Mac: "Finish the 2 gaps"): and a shared quest's foe on the room's own lane (QUEST-PARTY
   *  phase 3c) - mine, which the party strikes through me, or a party member's, stood here as its puppet. It was the
   *  one foe the party fights together that no party's size weighed underground. SUMMON-SYNC: and a loose stand, which
   *  the whole room fights now (mine, or another's puppet). */
  function _sharedFoe(f) {
    if (!f || f.entity?.team === 'PlayerAlly') return false;
    return isRoomFoe(f) || f._ownFrom != null || ownRides(f);   // REST-SYNC: and a rest's encounter, which the room now shares; PSCALE-OWN: and a shared quest's, on the own lane; SUMMON-SYNC: and a loose stand
  }
  /** PSCALE-OWN: whether THIS copy runs `f`, and so counts who fights it - the room's foes while I hold the seat, my own
   *  on the own lane always (their spawner steps them, whoever holds the seat); a puppet is its runner's. */
  function _runsFoe(f) { return f._ownFrom == null && (_authority || ownRides(f)); }
  /** AUDIT PSCALE1 (Mac: "Whoever fights it"): how many players fight `f` - counted at this door from every blow it
   *  takes while I run it (systems/partyScale.js foeFighters), else its runner's word on its record (`n`). Kept
   *  on the foe (`_fightN`) for the readers outside this pool (the Renown bonus, the sigil's forge). */
  function fightN(f) { return _runsFoe(f) ? (f._fightN = foeFighters(f, performance.now())) : (f._fightN ?? 1); }
  /** PSCALE1: a shared foe's weapon or arrow hit on me, weighed by the players fighting it, the remainder carried on
   *  me (AUDIT PSCALE1 DOORS-4) - ONE home for the blow and the arrow, so the flash and the cry read what I took. */
  function _weighHit(f, dmg) { return f && _sharedFoe(f) ? partyFoeHits(dmg, fightN(f), playerEntity) : dmg; }
  /** AUDIT PSCALE1 DOORS-5: a heal on a shared foe I run is a heal of the bigger pool; a puppet is its runner's to heal
   *  (the next record says so). */
  function healFoe(f, n) {
    if (!(n > 0) || !f?.entity || f.dead) return;
    const h = _runsFoe(f) && _sharedFoe(f) ? partyFoeHeals(f, n, fightN(f)) : n;
    f.entity.health = Math.min(f.entity.maxHealth ?? Infinity, f.entity.health + h);
  }

  /** AUDIT CC-E1 (Mac: "Full co-op combat now"): a blow on another client's body that a COMPANION's fight is - my
   *  companion's on another's foe (`al`, `ac` his own-lane number - the owner's foe turns on him), or a foe of mine on
   *  another's companion (`fb`, `sf` the striker's number when it has one) - as the hit's payload, or null (anything
   *  else stays dropped: a puppet's harm is its owner's simulation). */
  function coopHit(foe, damage, knockDir, kind, striker) {
    if (!striker || striker.dead || striker._ownFrom != null || isPuppetFoe(striker)) return null;
    const base = { dmg: Math.max(0, Math.round(Number(damage) || 0)), kind, ...(knockDir ? { d: [q3(knockDir[0]), q3(knockDir[1]), q3(knockDir[2])] } : {}) };
    if (foe.companion != null) return { ...base, fb: 1, ...(striker._ownSeq != null ? { sf: striker._ownSeq } : {}) };
    if (striker.companion != null) return { ...base, al: 1, ...(striker._ownSeq != null ? { ac: striker._ownSeq } : {}) };
    return null;
  }
  /** AUDIT CC-E1: my companion's blow on the room's foe while another hosts it - to the host as an ally's (its foe turns on him). */
  function roomCoop(foe, pi, damage, knockDir, kind, striker) {
    const coop = coopHit(foe, damage, knockDir, kind, striker);
    if (coop?.al === 1) opts.onFoeHit?.({ ...(foe._encId != null ? { i: foe._encId, xs: 1 } : { i: pi }), ...coop });
  }
  function damageFoe(foe, damage, playerFeet = null, knockDir = null, { fromPlayer = true, bypassShield = false, kind = 'melee', peer = false, peerId = null, whole = false, spell = null, striker = null } = {}) {   // AUDIT CC-E1: `striker` the foe whose blow it is (hurtFromFoe's)
    // AUDIT 68 S19-damagefoe-dead-reentry: a corpse takes no blow. EnemyDeath runs once; the round sinks tick on
    // after the killing tick inside one window, and each re-ran the whole death arm (trap, chime, OnEnemyDeath).
    if (foe.dead || (fromPlayer && !peer && foe.companion != null)) return;   // CREW-COMPANIONS: and my companion takes no blow of mine (exteriorFoes' AUDIT NAV2 F55 gate) - it turned him
    const bout = foe.entity?.bout ?? null;   // ARENA2: a fighter on the arena floor's sand (scenes/arenaBouts.js)
    if (fromPlayer && !peer && !bout) renownFoeStruck(foe);   // RENOWN1: MY blow - a joiner's too, before the divert sends it to the host; ARENA2: no renown on the sand
    if (foe.yielded || foe.executing || foe.sparing) return;   // REVENANT-FATE: a beaten revenant takes no blow - its fate is the player's choice
    // AUDIT PSCALE1 DOORS-1: a KILL is not a blow - a Disintegrate, a stat drained to zero (the sinks' `whole`), the
    // Razor's whole-health strike (its mark on the foe) - and no fighters' toughness divides it, here or at the host
    const _whole = whole || takeWholeBlow(foe.entity);
    // the STRIKER's own HUD - the target frame (PX30) and the concealed reveal (ECV1) - before the divert (AUDIT
    // WORLD2 B6: a joiner's blow never marked) and never for a peer's blow applied here (C4: a peer's poke across the
    // room hijacked the host's target frame)
    if (!peer) { markFoeStruck(foe, { fromPlayer }); if (damage > 0) markConcealedHit(foe, _ecvT); }
    // WORLD2: a PUPPET's blow is the host's to apply - the number is this client's (computed before this door, the
    // sounds already played) and goes out as a hit; the next stream frame carries the health. A blow from anything
    // but the player (a fall, a foe) is the host's simulation, not this client's: dropped. A connecting swing of no
    // damage goes too (B13: it wakes the foe, DFU's own rule); a puppet whose species the stream disagreed with
    // sends nothing (B5: its index is another foe's on the host).
    // QUEST-PARTY phase 3c: a party member's quest foe stood here (the room's own lane) - the blow is its OWNER's to
    // apply, whoever hosts the room: out as a hit marked `own`, named by the owner's number, the relay routing it to `to`
    // ARENA4: one of the relay's fighters on its sand (scenes/arenaBouts.js stands it as a puppet of the relay) - my
    // blow's number goes to the bout's referee, which holds its health and decides what lands
    if (foe._ownFrom === ARENA_PUPPET_OWNER) {
      // ARENA4b: a swing's or a shaft's sequence (a cleave through two of them is one blow); a spell's - its damage comes
      // through the sinks as kind 'spell' with no record (foeSinks), which ARENA4 claimed as a swing and the referee then
      // held to a sword's reach - claimed as a spell, under its cast's one number (arenaSpellQ)
      const cast = kind === 'spell' || !!spell;
      if (fromPlayer && damage >= 0) opts.onArenaHit?.({ i: `a${foe._ownI}`, d: damage, kind: kind === 'arrow' ? 'arrow' : cast ? 'spell' : 'melee', w: playerWeapon?.strikingWeapon?.templateIndex ?? -1, m: playerWeapon?.strikingWeapon?.material ?? 0, q: cast ? arenaSpellQ() : _arenaQ });
      return;
    }
    if (foe._ownFrom != null) {
      if (fromPlayer && damage >= 0) {
        const _pAt = playerFeet ?? lastPlayerFeet;
        const _pt = foe._divertPt ?? null; foe._divertPt = null;
        opts.onFoeHit?.({ own: 1, to: foe._ownFrom, k: _locationKey, i: foe._ownI, dmg: damage, kind,
          ...(_pAt ? { p: [q2(_pAt[0]), q2(_pAt[1]), q2(_pAt[2])] } : {}),
          ...(knockDir ? { d: [q3(knockDir[0]), q3(knockDir[1]), q3(knockDir[2])] } : {}),
          ...(_pt != null ? { pt: _pt } : {}),
          ...(kind === 'arrow' ? { ar: 1 } : {}),
          ...(spell ?? {}),   // STRIKE-SHARED: a strike spell's record and level (`sp`, `lv`) - the owner lands the whole spell
          ...(_whole ? { z: 1 } : {}) });
      } else {
        // AUDIT CC-E1: a companion's fight across the room's clients - a foe of mine mauling another's companion (`fb`),
        // or my companion's blow on another's loose stand (`al`) - goes to the puppet's owner, where it is real
        const coop = striker ? coopHit(foe, damage, knockDir, kind, striker) : null;
        if (coop) opts.onFoeHit?.({ own: 1, to: foe._ownFrom, k: _locationKey, i: foe._ownI, ...coop });
      }
      return;
    }
    if (!_authority) {
      const pi = foes.indexOf(foe);
      // AUDIT FOES FOE9: a record the pool NO LONGER HOLDS takes no blow. retypeFoe
      // swaps foes[i] for a fresh record and marks the old one dead, but anything that
      // closed over the old one - an arrow already in flight (its dealDamage holds the
      // record), a lock-on, a melee pick resolved a frame earlier - still points at it.
      // indexOf then answers -1, the divert below was skipped, and the blow fell
      // through to the LOCAL damage path and landed on a ghost nothing draws and
      // nothing streams. With a joiner's roster retyping at nearly every index on
      // arrival (the species bands on the striker's own level) and again on every
      // un-death, that is not rare. The blow is dropped instead of being spent on a
      // body that is not there.
      if (pi < 0) return;
      if (isRoomFoe(foe, pi)) {   // REST-SYNC: the layout's run, or a shared encounter's puppet (named by the room's number, `xs`)
        // WORLD3: the striker's feet (p) and the blow's direction (d) ride the hit - the aggro turns toward the striker
        // and the shove goes the way the blow went; an arrow's shaft lands in the host's copy (ar)
        // AUDIT WORLD3 F1: the striker's feet ride EVERY kind, not only the ones that carry a knock ray - the spell
        // sink hands playerFeet null (a spell knocks nothing, verbatim), so a joiner's spell turned the host's foe
        // toward the HOST, at the host's feet, while naming the joiner as its attacker.
        const _pAt = playerFeet ?? lastPlayerFeet;
        // WORLD6b-iii(e): the blade's or the shaft's dose (poisonFoe, inside this blow's calc) - spent by this door, once;
        // AUDIT WORLD6b-iii(e) A5: by this player's own blow (a fall's or a foe's door leaves it)
        const _pt = fromPlayer ? (foe._divertPt ?? null) : null; if (fromPlayer) foe._divertPt = null;
        // AUDIT FOES FOE4 (2026-09-15, Mac relaying players: "certain enemies cant be
        // damaged"): THE BLOW GOES WHILE MY BODY IS WRONG. This was gated on
        // `!foe._pupMismatch` under B5's reading - "its index is another foe's on the
        // host" - and WORLD3 retired that premise: the roster is the ROOM'S, and the
        // index names the same marker on every client (driven: the layout's foe COUNT
        // never varies with level; only the SPECIES the level bands does). What stands
        // at `i` here is the host's foe at `i`, posed by its stream and carrying its
        // health - wearing the wrong body until the rebuild lands. A blow at it is a
        // blow at that foe, and the host applies it to its own.
        //
        // Held home, it was not a late blow, it was no blow: this arm applies nothing
        // locally. And the mismatch is the NORM on join, not an edge - two players'
        // random flats band on their own level, so a level-3 and a level-14 character
        // disagree at 758 of 760 markers - so every index depended on an async,
        // fallible rebuild clearing the flag, and any rebuild that refused left that
        // foe invulnerable to that client for the life of the context.
        if (fromPlayer && damage >= 0) opts.onFoeHit?.({ ...(foe._encId != null ? { i: foe._encId, xs: 1 } : { i: pi }), dmg: damage, kind,
          ...(_pAt ? { p: [q2(_pAt[0]), q2(_pAt[1]), q2(_pAt[2])] } : {}),
          ...(knockDir ? { d: [q3(knockDir[0]), q3(knockDir[1]), q3(knockDir[2])] } : {}),
          ...(_pt != null ? { pt: _pt } : {}),   // WORLD6b-iii(e): the striker's poison rides to the host's foe; AUDIT WORLD6b-iii(e) A3: the calc's word, whatever the number (the Strikes payload can zero it after the dose)
          ...(kind === 'arrow' ? { ar: 1 } : {}),
          ...(spell ?? {}),   // STRIKE-SHARED: a strike spell's record and level (`sp`, `lv`) - the host lands the whole spell
          ...(_whole ? { z: 1 } : {}) });
        else if (striker) roomCoop(foe, pi, damage, knockDir, kind, striker);   // AUDIT CC-E1: my companion's blow on the room's foe - out to the host as an ally's
        return;
      }
    }
    // C-slice: MakeEnemyHostileToAttacker - damaging a PACIFIED foe
    // re-hostiles it (and pre-loads the pursuit, the G1 shape). F041:
    // inside DFU's player-source gate, so a FALL cannot do it.
    // MT-iv: and INSIDE that gate the whole of
    // MakeEnemyHostileToAttacker (EnemyMotor.cs:186-214), as the
    // exterior pool now runs it - the target-reassign guard fires on
    // EVERY player hit (a no-op before targeting existed), and the
    // player arm reverts a struck former ally to its species. The
    // revert reads the STATIC row by mobile id, never the instance's
    // own copy. foeDeps guards it: everything below the lazy block
    // must, and a foe hurt before the subsystem loaded still stands
    // up through the legacy arm.
    if (fromPlayer && foe.ai) {
      handleAttackFromPlayer(foe, playerFeet, peer, peerId);
    }
    // AUDIT 58: THE SHIELD POOL, on the FOE door as well as the
    // player's. DFU's hook is inside the ABSTRACT BASE's
    // DecreaseHealth (DaggerfallEntity.cs:313-328 - "Allow an active
    // shield effect to mitigate incoming damage from all sources"), so
    // every entity absorbs alike; Shield's AllowedTargets is
    // TargetFlags_All (Shield.cs:35), and the port's own applySpell
    // really does push the pool onto a foe (systems/effects.js, kind
    // 'shield'). Only the player's door consumed it, so a Shield cast
    // on a foe was carried and never read. The pool is consulted at
    // the SUBTRACTION only: DFU's knockback reads the RAW damage and
    // runs BEFORE DecreaseHealth (WeaponManager.cs:576-596, :627), and
    // HandleAttackFromSource runs after it unconditionally (:630), so
    // a fully absorbed blow still knocks back and still turns the foe.
    const healthDamage = bypassShield ? damage : damageShieldPool(foe.entity, damage);
    // AUDIT PSCALE1 (Mac: "Whoever fights it"): every player's blow names a fighter - mine, and a joiner's through
    // applyHit - here where the host hears them all
    if (fromPlayer) noteFighter(foe, peer ? peerId : PARTY_ME, performance.now());
    // PSCALE1: a shared foe fights its fighters with more health - its damage over their toughness, here where the
    // host applies every blow (a SetHealth(0) and a kill are no blows, and stand as they were)
    foe.entity.health -= !bypassShield && !_whole && _sharedFoe(foe) ? partyFoeLoses(foe, healthDamage, fightN(foe)) : healthDamage;
    if (bout && healthDamage > 0) bout.hooks?.hurt?.(foe, healthDamage, { fromPlayer: fromPlayer && !peer, striker });   // ARENA2: the blow, to the bout's law
    if (foe.entity.health <= 0) {
      // ARENA2: THE FOE YIELD FLOOR (exteriorFoes' twin) - a bout fighter at the floor is held at 1 and is out of the bout:
      // no corpse, no loot, no renown, no death notice
      if (bout) { foe.entity.health = 1; if (!bout.out) { bout.out = true; bout.hooks?.floor?.(foe, { fromPlayer: fromPlayer && !peer, striker }); } return; }
      // CREW-COMPANIONS: a companion is knocked out, never killed (exteriorFoes' twin) - before the trap and the corpse
      if (foe.companion != null) { foe.entity.health = 1; foe._knockedOut = true; return; }
      // REVENANT-FATE: one of the player's revenants, the player's ALONE here (offline, or past the room's shared run -
      // REVENANT-DUNGEON's own gate), yields instead of dying; a kill (a Disintegrate's whole) is a kill
      if (opts.fates && !_whole && (!onlineRoom() || !isRoomFoe(foe)) && revenantMayYield(foe)) { yieldDungeonFoe(foe); return; }
      // X5: SOUL TRAP intercepts the kill, exactly where DFU's
      // EnemyEntity.SetHealth override does (:157-177) - before the
      // death, on every damage source alike. A successful roll with no
      // empty gem TETHERS the foe at 1 health instead of killing it,
      // and the next killing blow rolls again.
      // AUDIT WORLD2 B9: a PEER's killing blow reads no gem of the host's and fills no Star of the host's - the kill
      // is the peer's (their own gem is slice 4's, "who struck last" on the death)
      // STRIKE-SHARED: and a PEER's trap reads no gem of mine whoever struck - its soul is its caster's, named on the
      // body's record (roomRecord's `j`, `q`) for the caster to roll against its own pack
      const _peerTrap = peerSoulTrapOf(foe.entity);
      const trap = peer || _peerTrap ? { allowDeath: true } : attemptSoulTrap(foe.entity, foe.mobileType, playerEntity.items, Math.random());
      if (trap.alert) hudText.add(SOUL_TRAP_TEXT[trap.alert]);
      if (!trap.allowDeath) { foe.entity.health = 1; return; }
      foe._trapBy = _peerTrap ? _peerTrap.by : null;
      foe._trapQ = _peerTrap ? Math.max(0, Math.min(100, Math.trunc(Number(_peerTrap.chance) || 0))) : 0;
      // V3: the equipped AZURA'S STAR takes every slain MONSTER's soul
      // (DaggerfallEntityBehaviour.cs:240-247) - no Soul Trap effect
      // needed, always successful while the Star is empty. Runs AFTER
      // the trap intercept, so a trap-filled Star is simply no longer
      // empty and this arm no-ops; class enemies (mobileType >= 128)
      // have no soul to take, DFU's EnemyMonster gate.
      if (!peer && foe.mobileType < 128 && isAzurasStarEquipped(playerEntity)
        && fillEmptyTrap(playerEntity.items, foe.mobileType, { azurasStarOnly: true })) {
        hudText.add(SOUL_TRAP_TEXT.trapSuccess);
      }
      foe._killedBy = fromPlayer && peer && typeof peerId === 'string' ? peerId : null;   // AUDIT SET P-M3: whose blow - the joiner's own record says so (roomRecord's `v`)
      foe._killedAt = performance.now();   // AUDIT FINAL F7: ...for KILLED_BY_MS
      foe.dead = true;
      if (fromPlayer && !peer) reportPlayerKill(foe.entity, { kind });   // SET2: MY blow killed it (a set's "each kill")
      renownFoeDied(foe);   // RENOWN1: whoever struck last - it pays me if a blow of mine is recent
      // E-slice: EnemyDeath:132-136 - the targeting foe's death
      // clears the alert (survivors re-raise it next update).
      // EnemyDeath:131-136 gates on `senses.Target ==
      // PlayerEntityBehaviour` - a foe killed while fighting ANOTHER
      // foe never touches the player's alert (MT-iv).
      if ((!foeDeps || !foe.ai?._armedTargeting || foeDeps.isLocalPlayerTarget(foe.ai?.target)) && foe.ai?.detected) setEnemyAlert(playerEntity, false);   // AUDIT WORLD3 C3: mine, not a peer's
      // LOOT7-CHECK DUNGEON-DIED: EnemyDeath:79-83, THE KILL NOTICE ("%s just died.", DisableEnemyDeathAlert its gate) -
      // DFU says it at every death, and the two street pools have since AUDIT 24 wave 38; this pool never did, so no
      // dungeon foe's death was ever said (and no dungeon champion's name with it). Mine alone, the street's law (AUDIT
      // WORLD6b B2): a PEER's killing blow applied here speaks no notice of mine - the striker's own rings at the
      // striker, below in applyFoeRecord, when this host's record names it
      if (!peer) sayEnemyDied((l) => hudText.add(l), foe.mobileType, foe.entity);
      if (foe.entity?.revenant) { const nr = revenantSlain(playerEntity, foe.entity); if (nr && !peer) revenantSay(revenantSlainEvent(nr, playerEntity?.name, { archive: foe.mobileArchive }), (l) => hudText.add(l)); }   // REVENANT-DUNGEON: one that killed me here and stood, slain at last
      spawnCorpse(foe);
      playRareDrop(audio, foe.ai.feet, foe.entity.items);   // LR3: the chime for a Rare or better on the body
      stampWonWeapons(foe.entity.items, _sharedFoe(foe) ? fightN(foe) : 1);   // SIGIL1: the body's Magic+ weapons won online may carry a sigil; a bigger fight, better odds
      raiseEnemyDeath(foe.entity, { luck: liveStat(playerEntity, 'luck') });   // UL1: OnEnemyDeath (EnemyDeath.cs:139) - the kill, not the load's rewind. AUDIT VC6: the player's luck, which SURV2's food rolls against - this host keeps no loot stream of its own, so the roll stays Math.random as its spawn loot's is
      return;
    }
    // C15 knockback (WeaponManager.WeaponDamage): WEAPON hits carry
    // the attack ray (melee = the look ray, arrows = flight) - spell
    // damage passes no ray and knocks nothing, verbatim. The gate:
    // monsters need MobileEnemy.Weight > 0 (weight-0 spectrals -
    // ghosts/wraiths - take NO knockback), class enemies re-knock
    // only once the current shove decays under the hurt threshold.
    // The sprite Hurt anim now rides the motor's knockback threshold
    // (KnockbackMovement), not the hit itself - damage without
    // knockback plays no hurt, as DFU.
    if (knockDir && foe.ai) {
      const isClass = !!foe.entity.isClass;
      const mobileWeight = ENEMY_BASICS[foe.mobileType]?.weight ?? 0;
      // WeaponManager.cs:578-581, verbatim precedence: `&&` binds
      // tighter than `||`, so the gate is
      // (speed <= 5/ratio && isEnemyClass) || Weight > 0. AUDIT 24 (the
      // seven-slice sweep): the port had `!isClass &&` on the second
      // arm, which C# does not write. It is a no-op on today's data -
      // every class row leaves Weight at its struct 0 - but it is not
      // what the source says, and the day a class row carries a weight
      // the two would part.
      // AUDIT 24 (wave 38): through the shared gate now - this was the
      // only pool that had the precedence right, and one home means the
      // other two cannot drift away from it again.
      if (weaponKnockbackApplies(foe.ai.knockbackSpeed, isClass, mobileWeight)) {
        // EW1: the foe's own kit is half of DFU's weight
        const w = enemyWeightClassicUnits(isClass, foe.gender, mobileWeight, foe.entity?.items);
        foe.ai.knockbackSpeed = weaponKnockbackSpeed(damage, w);
        foe.ai.knockbackDir = [knockDir[0], knockDir[1], knockDir[2]];
      }
    }
    if (foe.mobile) return;
    if (playerFeet && foeDeps) {
      const hdx = playerFeet[0] - foe.ai.feet[0], hdz = playerFeet[2] - foe.ai.feet[2];
      const front = foeDeps.withinYaw(foe.ai.yaw, hdx, hdz, 90);
      foe.reaction = { clip: foeDeps.REACTIONS[front ? 'HurtFront' : 'HurtBack'], t: 0 };
    }
  }


  // C16: EnemyAttack.MeleeDamage - one resolution for both damage
  // clocks (the rigs' machine hit frame, the mobiles' -1 sequence
  // marker). Gate 0.25 / MeleeDistance + 35.156deg, then
  // CalculateAttackDamage with the S18/S19b riders.
  /** C2-slice (combat-17): the 20% enemy-class attack voice at the
   *  melee damage frame, whatever the outcome (MeleeDamage's tail). */
  function foeAttackVoice(f) {
    const v = enemyAttackVoice(f);
    if (v && v.clip >= 0) audio.play3d(v.clip, [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16, pitch: 1 + v.pitchLift });   // AUDIT 58: EnemySounds.cs:172-175
  }

  /** MT-iv: MeleeDamage's TWO-ARM SPLIT (EnemyAttack.cs:199-209) -
   *  `if (Target == PlayerEntityBehaviour) ApplyDamageToPlayer else
   *  ApplyDamageToNonPlayer(weapon, transform.forward)`. The fork
   *  lives HERE rather than at the two call sites (the rig path and
   *  the sprite marker path), so both spellings get it from one
   *  home. Returns true when it handled a FOE target. */
  function resolveFoeMeleeVsFoe(f) {
    const t = f.ai.target;
    if (!foeDeps || !f.ai._armedTargeting || !t || foeDeps.isPlayerTarget(t)) return false;
    const tf = t.ai.feet;
    const fdx = tf[0] - f.ai.feet[0], fdz = tf[2] - f.ai.feet[2];
    // EnemyAttack.cs:191-194 - the metal drop runs BEFORE the reach
    // fork and before the weapon-vs-weaponless swap, so a Ghost or a
    // Lich takes the striker's hand-to-hand attack instead of the
    // silent report(0) the material gate hands enemies.
    const wpn = foeDeps.chooseEnemyWeapon(foeDeps.dropWeaponIfTargetImmune(f.entity.weapon, t.entity), ENEMY_BASICS[f.mobileType]);
    const fwd = [Math.sin(f.ai.yaw), 0, Math.cos(f.ai.yaw)];   // transform.forward (:208)
    if (foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, fdx, fdz, foeDeps.MELEE_HIT_YAW_DEG))) {
      applyDamageToNonPlayer(f, t, {
        weapon: wpn, direction: fwd, rolls: Math.random,
        calculateAttackDamage: foeDeps.calculateAttackDamage,
        dealDamage: (tt, d) => tt.hurtFromFoe?.(d, fwd, f),
        audio, hitEffects,
        // AUDIT 58: FormulaHelper.cs:691-696 has NO player gate - a
        // poisoned foe blade doses the foe it strikes, on DFU's own
        // target. Without the hook the formula still cleared the dose.
        onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),
        say: (l) => hudText.add(l),   // C-slice: equipment breaks speak (ItemBreaks pops for any owner)
      });
    } else {
      audio.play3d(enemyMissSound(wpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
    }
    foeAttackVoice(f);   // :216-226 fires whatever the target
    return true;
  }

  function resolveFoeMelee(f, playerFeet, { vsPlayer = false } = {}) {
    if (!vsPlayer && resolveFoeMeleeVsFoe(f)) return;   // MT-iv: the ELSE arm is everything below
    // WORLD3: a PEER target - the blow is the peer's to resolve (its puppet's damage frame, its own reach and stats);
    // here the swing's voice alone. vsPlayer: a puppet's blow at me, the player arm whatever the motor last held.
    if (!vsPlayer && f.ai.target?.isPeer) { foeAttackVoice(f); return; }
    const hdx = playerFeet[0] - f.ai.feet[0], hdz = playerFeet[2] - f.ai.feet[2];
    // E4b: weapon vs weaponless per the DFU rule (EnemyAttack also
    // drops the weapon if the target is metal-immune to it - the
    // player has no minMetalToHit, so that gate is inert)
    const wpn = foeDeps.chooseEnemyWeapon(f.entity.weapon, ENEMY_BASICS[f.mobileType]);
    if (!blowConnects(f.ai, foeDeps.meleeHitConnects(f.ai._dist, f.ai.inSight, foeDeps.withinYaw(f.ai.yaw, hdx, hdz, foeDeps.MELEE_HIT_YAW_DEG)))) {   // TACT4: a telegraphed blow's shape decides
      // C2-slice (combat-9): the out-of-reach whiff RINGS - the
      // else arm of MeleeDamage's reach fork plays the miss sound,
      // and the attack-voice roll still runs after the fork.
      audio.play3d(enemyMissSound(wpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
      foeAttackVoice(f);
      return;
    }
    // AUDIT 2026-08-17c: every resolved enemy attack on the player
    // tallies Dodging (EnemyAttack, before the damage branch) - it
    // was never tallied since C8.
    tallySkill(foeDeps.playerEntity, SKILLS.Dodging, 1);
    // S18: the special-attack rider seam - monster weaponless hits
    // run OnMonsterHit per hit (disease/paralysis/fatigue)
    const dmg = blowScaled(f.ai, _weighHit(f, foeDeps.calculateAttackDamage(f.entity, foeDeps.playerEntity, {   // TACT4: a telegraphed blow's weight
      weapon: wpn,   // AUDIT 18: target group derived from the entity (isPlayer -> Humanoid)
      onMonsterHit: (att, tgt, hit) => onMonsterHit(att, tgt, hit, {
        currentDay: Math.floor(classicMinutesRef.value / MINUTES_PER_DAY), sinks: playerSinks,
        regionIndex: dfLocation?.regionIndex ?? -1,   // DISC10-D V3: PlayerGPS.CurrentRegionIndex underground is the dungeon's own region (VampirismInfection.cs:91)
        castParalyze: () => {   // S19: spider/scorpion free-cast Spider Touch (66)
          const sp = spellsByIndex?.get(SPIDER_TOUCH_SPELL_INDEX);
          if (sp) castEnemySpell(f, sp, true);
        },
      }),
      // S19b: a damaging poisoned-weapon hit infects (and the
      // formulas clear the weapon's poison)
      onInflictPoison: (att, tgt, pt) => inflictPoison(foeDeps.playerEntity, pt, false, { currentMinute: Math.floor(classicMinutesRef.value) }),
      say: (l) => hudText.add(l),   // C-slice: equipment breaks speak
    })));   // PSCALE1: harder for the players fighting it - weighed once, so the flash and the cry below read what I took (AUDIT PSCALE1 DOORS-3)
    if (dmg > 0) audio.playOneShot(hitSoundFor(wpn), PLAYER_HIT_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:330-344 - the blow that lands ON the player is volumeScale 1, not EnemySounds' 1.1
    // C2-slice (combat-9): a connected attack that LOST the roll
    // rings the miss sound too (ApplyDamageToPlayer's else arm).
    else audio.play3d(enemyMissSound(wpn), [f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], 1, { maxDistance: 16 });
    hurtPlayer(dmg);
    // AUDIT 24 (wave 39/46): EnemyAttack.cs:406 SENDS RemoveHealth, and
    // Unity's SendMessage reaches every component - so the same blow
    // drives ShowPlayerDamage's flash AND PlayerFootsteps' 40% cry.
    // Guarded on a LANDED blow: SendDamageToPlayer is only reached
    // from the hit arm.
    if (dmg > 0) {
      flashPlayerDamage(dmg);   // BA1: RemoveHealth carries the amount
      playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
    }
    foeAttackVoice(f);   // C2-slice (combat-17): after the fork, hit or miss
  }

  // Combat collision triggers (the last Combat-queue row):
  // DaggerfallActionCollision verbatim shape - per-object 0.12s
  // timeout, fires only while the player ACTIVELY MOVES horizontally
  // (up/down/jump don't trigger in classic), contact beneath the
  // player -> WalkOn else WalkInto. DISC29-A (Skibbster on Discord: the
  // throne puzzle's switch never activates): the Collision01 standing
  // ray does NOT fold into the beneath test - that test is the top of
  // the object's BOX, and a Collision01 object's surface can stand well
  // under it (N0000037's two thrones: the box tops the backrest at
  // 34.08, the seat is at 32.55). The ray is its own arm, as in the C#.
  const _wish = [0, 0];   // AUDIT PRE-MERGE 0929 D1/D2: the pass's one scratch for the direction the body presses
  function collisionTriggers(dt, playerFeet, moveHeld, playerHeight = CAPSULE_HEIGHT, playerMove = null) {
    if (!playerFeet) return;
    // Verbatim DaggerfallActionCollision: fires only while a MOVE
    // action is HELD (up/down/jump excluded) - not on position delta.
    // The delta gate (audit 2026-08-16) missed the classic case of a
    // player pushing INTO a blocking WalkInto object: the collider
    // cancels the motion, the delta is zero, and the trigger never
    // fired. Input-held is the source's rule and covers it.
    if (!moveHeld) return;
    // AUDIT PRE-MERGE 0929 D1/D2: THE DIRECTION THE BODY PRESSES - the motor's own sin/cos of forward and strafe
    // (PlayerMotor.update's ground arm) - so a side of the object is heard only when the body moves into it, as a
    // ControllerColliderHit only comes of a Move into its collider. A host that names no yaw presses every side.
    let wish = null;
    if (playerMove && Number.isFinite(playerMove.yaw) && (playerMove.forward || playerMove.strafe)) {
      const sn = Math.sin(playerMove.yaw), cs = Math.cos(playerMove.yaw);
      _wish[0] = sn * playerMove.forward + cs * playerMove.strafe;
      _wish[1] = cs * playerMove.forward - sn * playerMove.strafe;
      wish = _wish;
    }
    const R = 0.45, H = 1.8;   // the player capsule
    for (const o of actions.objects.values()) {
      if (!o.aabb) continue;
      // AUDIT 63 F45: DFU's collision pass is a COMPONENT, not a loop -
      // AddAction attaches DaggerfallActionCollision only on
      // Collision01/Collision03/MultiTrigger/Collision09
      // (RDBLayout.cs:992-996), and that component is the only
      // collision caller of Receive. Everything downstream of Receive's
      // trigger gate already agreed (TRIGGER_GATE admits WalkOn/WalkInto
      // for exactly those four), but the Castle Daggerfall hack runs
      // AHEAD of that gate (DaggerfallAction.cs:183), so once F38 gave
      // recorded doors a box a `Door`-flagged foyer door would have
      // unlocked and swung open on a bump - a Receive DFU's component
      // set makes unreachable. Refusing the CALL, not the gate, keeps
      // ROAD-B B4's ordering intact for the objects that do collide.
      if (!hasActionCollision(o)) continue;
      if (o.restOnlyTrigger && o.state !== 'start') continue;   // a mover in flight: bounds stale, and classic triggers on the step, not the ride
      o._colTimer = (o._colTimer ?? COLLISION_TIMEOUT_S) + dt;
      if (o._colTimer < COLLISION_TIMEOUT_S) continue;
      // AUDIT 63 F38: a DOOR is measured live. Its BoxCollider rides the
      // transform, and a door's record can carry a Move of its own that
      // translates the closed door away from its placement
      // (_applyMatrix's moveT arm) - DFU collides with it where it now
      // stands. Every other kind keeps its stored box: movers only reach
      // here parked at 'start', where the two are identical, and flats
      // travel their box in _applyFlat.
      const a = o.kind === 'door' ? objectAabb(o) : o.aabb;
      const overlapXZ = playerFeet[0] + R > a.min[0] && playerFeet[0] - R < a.max[0]
        && playerFeet[2] + R > a.min[2] && playerFeet[2] - R < a.max[2];
      if (!overlapXZ) continue;
      const overlapY = playerFeet[1] + H > a.min[1] && playerFeet[1] < a.max[1] + 0.15;
      if (!overlapY) continue;
      // AUDIT PRE-MERGE 0929 D1/D2: THE TOUCH ITSELF, as DFU hears it (actionSystem.js actionContact) - the contact's
      // direction beneath the body (WalkOn, every flag), a Collision01's standing ray, or a bump - off the object's own
      // triangles: a mover or a door is its own bucket in `collider`, an effect or relay keeps one in triggerSurfaces.
      // The box above is only the broad phase: a box touched with nothing of the object touched hears nothing. An
      // acting flat has no triangles and keeps its box's top (standsOnAction).
      const touch = o.isFlat
        ? (standsOnAction(o, playerFeet, a, triggerSurfaces) ? 'WalkOn' : 'WalkInto')
        : actionContact(o, playerFeet, playerHeight, o.kind === 'effect' || o.kind === 'relay' ? triggerSurfaces : collider, wish);
      if (!touch) continue;
      actions.receive(o, touch);
      o._colTimer = 0;
    }
  }

  // P11: the current block's water surface (world y) - the swim
  // toggle rule reads it (PlayerEnterExit blockWaterLevel); P12's
  // drowning tick reads it too.
  function waterSurfaceYAt(x, z) {
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        const level = levelOf(b);
        return level === 10000 ? null : -level * GLOBAL_SCALE;
      }
    }
    return null;
  }
  /** OH-D: PlayerEnterExit.blockWaterLevel written from outside (WaterizeDungeon, ClearAbyssState) - it holds for the
   *  block the player stood in when it was written, until they cross into another, where DFU reads the block's own. */
  let _blockWaterOverride = null;   // {block, level}
  const blockAtXZ = (x, z) => dungeon.blocks.find((b) => x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) ?? null;
  const levelOf = (b) => (_blockWaterOverride && _blockWaterOverride.block === b ? _blockWaterOverride.level : b.layout.waterLevel);
  /** ROAD-B (b3): UnderwaterFog wants blockWaterLevel RAW - the RDB
   *  short PlayerEnterExit.cs:337 stores and passes to UpdateFog
   *  (:351), not the world Y above. 10000 is DFU's "no water in this
   *  block" sentinel (:343) and is passed through unchanged, because
   *  UpdateFog's own arithmetic turns it into a threshold 250 units
   *  under the deepest floor and answers "dry" without a special case.
   *
   *  Off every block DFU reports playerBlockIndex == -1 and simply
   *  does not call UpdateFog that frame (:349-352); null says so. */
  function blockWaterLevelAt(x, z) {
    // WATER-BACK: AIWATER's other half, and it never covered the whole
    // question. Three doors answer "is there water here" - this one
    // (the fog and the swim check), `waterSurfaceYAt` above (the swim
    // TOGGLE and P12's drowning tick) and the draw's quads - and the
    // spawn exclusion was written into two of the three. So a spawned
    // dungeon had water that `waterSurfaceYAt` could still put a
    // player INTO and drown them in, with no plane drawn and no fog to
    // say why: invisible water in the literal sense, and the dangerous
    // sense rather than the ugly one. Removing it is what puts the
    // three back on one answer.
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        return levelOf(b);
      }
    }
    return null;
  }
  // ROAD-B (b3): the green murk. UnderwaterFog is a per-PlayerEnterExit
  // instance in DFU (constructed once at Start, :322) because its
  // backup/restore is stateful - so it is constructed once here, per
  // dungeon context, and both dungeon hosts share it.
  const _underwaterFog = new UnderwaterFog();
  let _abyssFogSaved = null;   // OH-E: the fog's own two fields while There's a Hole in the Bottom of the Ocean holds them
  /** UnderwaterFog.UpdateFog's call site (PlayerEnterExit.cs:349-352):
   *  every frame the player is inside a dungeon and over a block.
   *  `base` is the fog the host would otherwise draw with (DFU's
   *  RenderSettings at the moment of the call), and the return is what
   *  it should draw with instead - null when there is no block under
   *  the player, which is the frame DFU skips. */
  function underwaterFogSettings(camY, playerFeet, base) {
    const level = blockWaterLevelAt(playerFeet[0], playerFeet[2]);
    if (level == null) return null;
    return _underwaterFog.updateFog(level, camY, base);
  }
  /** AUDIT 21 (music lane, F3): IsPlayerInsideDungeonCastle.
   *
   *      isPlayerInsideDungeonCastle = playerDungeonBlockData.CastleBlock;
   *  (PlayerEnterExit.cs:338), read by SongManager.cs:450-457 for the Castle
   *  playlist (GPALAC/FPALAC) and by AmbientEffectsPlayer.cs:291-299 for
   *  doNotPlayInCastle.
   *
   *  Both call sites hardcoded `insideDungeonCastle: false`, so MUSIC_ENV.Castle
   *  was unreachable and CASTLE_SONGS was a dead constant - and `deps.inCastle`
   *  was READ by ambientEffects and WRITTEN by nobody, so the one-shot
   *  suppression was inert too. The flag blamed "no castle-block detection
   *  yet", and rdbLayout has computed castleBlock verbatim
   *  (DaggerfallBillboard.cs:227) on every block all along - test/dungeon.test.js
   *  already pins that five real castle blocks exist in the archive.
   *
   *  Same block lookup as the water surface above, because it is the same
   *  question: which RDB block is the player standing in. */
  function castleBlockAt(x, z) {
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        return Boolean(b.layout.castleBlock);
      }
    }
    return false;
  }
  /** AUDIT 26 F183: the castle block's sibling. SpecialAreaCheck
   *  (PlayerEnterExit.cs:1221-1238) switches on the block NAME and has
   *  exactly one case - S0000161.RDB, the Daggerfall treasure room.
   *  Same block lookup, same question. */
  function specialAreaBlockAt(x, z) {
    for (const b of dungeon.blocks) {
      if (x >= b.originX && x < b.originX + RDB_SIDE && z >= b.originZ && z < b.originZ + RDB_SIDE) {
        return b.name === SPECIAL_AREA_BLOCK;
      }
    }
    return false;
  }
  /** The ambient the player's CURRENT block takes
   *  (PlayerAmbientLight.cs:82-90), castle before special area. */
  function ambientAt(feet) {
    if (!feet) return DUNGEON_AMBIENT;
    return dungeonAmbientFor({
      inCastle: castleBlockAt(feet[0], feet[2]),
      inSpecialArea: specialAreaBlockAt(feet[0], feet[2]),
    });
  }
  // P12/P18: breath/drowning (PlayerEntity.FixedUpdate on the classic
  // update cadence). Submerged = the controller CENTER (feet + 0.9)
  // + 76*GlobalScale - 0.95 below the block water surface (the head-
  // under threshold; the swim toggle uses 50). The clause itself -
  // the DeepBreath guild refill, the 19th-update drain with the
  // Argonian coin refund, drowning at 0, surfacing zeroing - is
  // systems/breath.js breathStep (P18); this host owns the cadence,
  // the geometry, and the SetHealth(0).
  let _breathTimer = 0;
  const _breathState = { tally: 0 };
  // F117: the last classic update's submersion, for the avoid-death
  // consult - Temple.AvoidDeath reads IsPlayerSubmerged globally, and
  // this host's equivalent global is the breath tick's own test.
  let _submergedNow = false;
  // AUDIT 24 player: `player.transform.position.y` in
  // PlayerEnterExit.cs:382/:407 is the LIVE capsule's centre, and a
  // swimmer is force-crouched to 0.9 - so the half-height rides in
  // from the host rather than being hardcoded at the standing 0.9.
  function breathTick(dt, playerFeet, playerHeight = CAPSULE_HEIGHT) {
    _breathTimer += dt;
    while (_breathTimer >= CLASSIC_UPDATE_INTERVAL) {
      _breathTimer -= CLASSIC_UPDATE_INTERVAL;
      const surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      const submerged = surf != null && playerFeet[1] + playerHeight / 2 + 76 * 0.025 - 0.95 < surf;
      _submergedNow = submerged;   // F117
      if (breathStep(playerEntity, submerged, _breathState) === 'drowned') {
        // PlayerEntity.cs:339-340 - `if (currentBreath <= 0) SetHealth(0)`.
        // The three-argument door is the IMPORT (hurtEntity, :26), not
        // this file's one-argument hurtPlayer wrapper (:1030) that
        // shadows its name: called through the wrapper the entity
        // arrived as `dmg`, playerEntity.js:120's `!(dmg > 0)` guard read
        // NaN and returned, and dungeon drowning never dealt a point.
        // bypassShield because SetHealth(0) is a kill, not damage.
        hurtEntity(playerEntity, playerEntity.health, { bypassShield: true });   // SetHealth(0): drowned
      }
    }
  }
  // A3: the dungeon scene ambience (the scene's Dungeon object runs
  // 5/28) - the 14 one-shots "somewhere around" + the classic-cadence
  // water sounds. Castle-block detection (doNotPlayInCastle) pends.
  const sceneAmbience = new AmbientEffects(DUNGEON_AMBIENT_WAITS);
  sceneAmbience.setPreset('dungeon');
  function drawFoes(dt, canvas, proj, view, eye, playerFeet, moveHeld = false, playerHeight = CAPSULE_HEIGHT, playerSneaking = false, playerMove = null, playerBobY = 0, playerCrouching = false, playerRenderFeet = null, playerClimb = null, aimView = null) {
    if (_staleChunkNotice) { _staleChunkNotice = false; setMidScreenText(STALE_CHUNK_IN_PLAY_TEXT, STALE_CHUNK_IN_PLAY_SECONDS); }
    // AUDIT CLIMB-ARC F10: what the player AIMS with - the look, the ears, the spell's line, the blow's, the activation's -
    // is the view before the climb's feel laid its pitch and roll on the picture (the world and exterior hosts read cam)
    const aimed = aimView ?? view;
    _ecvT += dt;
    respawnSweep(_ecvT);   // WORLD8: the hour's respawn, once a second
    const ecvOn = combatVisualsOn();   // ECV1: once per frame
    _weaponCanvas = canvas;   // C10: the rig's late canvas (gesture dim + the overlay draw)
    // MW-D8: latch the eye and heading THIS frame, before anything draws.
    // Set after weaponRig.draw() instead, the arm would render a frame
    // behind the camera - a lag you only see while turning, which is
    // most of what a first-person arm does.
    _fpEye = eye;
    _fpFeet = playerFeet;   // HT1
    _fpYaw = Math.atan2(-aimed[2], -aimed[10]);
    // The view matrix's third row is the camera's BACKWARD axis, so the
    // look direction is its negation and the pitch is that vector's y.
    _fpPitch = Math.asin(Math.max(-1, Math.min(1, -aimed[6])));
    // MW-D15 / rule 32(a): the same latch, for the same reason - the arm
    // must see the stance the player is in THIS frame.
    _fpSneaking = !!playerSneaking;
    _fpMove = playerMove;   // MW-D26: same latch, same reason
    _fpClimb = playerClimb;   // CLIMB6: ...and the climb's, the body's limbs on the stone
    _fpBobY = playerBobY;   // IG1: same latch - the arm's bob channel
    // THE FOUR HOSTS RULE (2026-08-27, Mac: "blood texture stays static
    // in the air when attacking them in dungeons"). The splash pool's
    // clock was the HOST'S to run - dungeon.js ran it, worldModes never
    // did - so in the played game a splash spawned into billboardBatches
    // and then nothing advanced or retired it: frame 0, for ever, in the
    // air where the foe was. The context is the one thing both dungeon
    // hosts share and this is the one frame function both call, so the
    // clock lives here and no host can forget it. Real dt, and it ENDS
    // (a finished splash frees its batch inside tick).
    hitEffects.tick(dt);
    hitEffects.bleed(dt, foes, foeBleedView);   // BLOOD2c: the wounded drip, the dead bleed out
    hitEffects.bleedPlayer(dt, playerFeet, playerEntity);   // BLOOD2e: and the player's own blood, at the feet
    droppedTorches.tick(dt);   // HT1: the burn, the flight, the flames
    camps.tick(dt);   // SURV3: the fires burn down
    // PX21c / WORLD-HOVER: THE HOVER PLAQUE, from the frame function
    // both dungeon hosts already call - the splash clock's reasoning,
    // one slice on. It runs the SAME pick the take runs, so it cannot
    // disagree with what pressing the button would open. Enhanced skin
    // only: the classic HUD says nothing about a pile until you open
    // it, which is Daggerfall's own answer.
    //
    // EVERY FRAME NOW, not at 10 Hz. PX21c throttled it because "a
    // raycast over every pile and corpse is not free" - the cost was
    // guessed, and the guess was wrong by two orders of magnitude.
    // Measured on this pick: one collider ray is ~3 us and the whole
    // tick over `lootTargets()` is ~3 us more, which is 0.0005 ms of a
    // 16.7 ms frame. What the throttle bought was nothing; what it cost
    // was a plaque that lagged the crosshair by up to a tenth of a
    // second, so sweeping past a rack of barrels named them out of step
    // with the reticle and the name stuck after you looked away.
    //
    // AND THE OTHER HALF, CORRECTED (AUDIT-WH P4). This block used to
    // end "`lootTargets()` is 18 entries and is not [expensive]", and
    // eight lines below it the call hands over
    // `dungeonActivationTargets()` - which is `lootTargets()` PLUS
    // `activationTargets(actions.objects)`, and that is a full VERTEX
    // WALK per action object per frame (AUDIT 63 F37's live-pose law:
    // `objectAabb` -> `worldAabb` over the model's positions, because
    // a lever that has swung must not be picked at the box it had
    // before it swung). A justification resting on a number the next
    // statement invalidates is worse than none.
    //
    // MEASURED before the cache below, normalized: 0.068 ms for 62 objects at ~78 verts, and
    // 0.582 ms for 150 at ~300 - so a busy RDB level costs about 3.5%
    // of a 16.7 ms frame here, not 0.0005%. It is still worth paying,
    // and the reason is the one this seam exists for: this is the
    // SAME list the press races, and a cheaper list of the plaque's
    // own would be a second answer to "what is under the crosshair".
    // The throttle is still the wrong saving - it bought 90% of a cost
    // that is dominated by the list, not the ray, and paid for it in a
    // readout that lagged the reticle.
    //
    // THE CACHE, and where it lives (AUDIT 68 S15-objectaabb-vertex-walk).
    // This used to say the only correct cache would key on every
    // object's matrix, "which is the walk it would be replacing" - but a
    // pose change REPLACES an action object's matrix, so `objectAabb`
    // keys each box on the matrix it was measured from (an identity
    // test, not the walk) and only an object that moved is walked
    // again. The list itself is still built, which is the cost left.
    //
    // (The expensive half of a hover in this port is BUILDING the
    // target list, not casting the ray - which is why the seam takes a
    // thunk and the hosts with real lists hand over one they are
    // holding anyway.)
    worldHoverFrame({
      eye,
      dir: eye ? [-aimed[2], -aimed[6], -aimed[10]] : null,
      // the SAME list the press races - one seam, so the plaque cannot
      // name what the button ignores...
      // WORLD-HOVER H2: ...and the LIVE BODIES beside it, which are in
      // no target list at all. `tryMobileEnemyActivate` sweeps the pool
      // itself and the press takes a foe only when it is STRICTLY
      // nearer than the list's winner; standing one IN the list would
      // eat the click in silence, because no press arm reads that key.
      // So it is raced here, through the one precedence `raceWinner`
      // spells, where the list wins a tie as the strict `<` does.
      pick: () => {
        const d = eye ? [-aimed[2], -aimed[6], -aimed[10]] : null;
        if (!d) return null;
        const ray = raceWinner({
          ground: pickActivatableHit(eye, d, api.dungeonActivationTargets(), collider),
          foe: ((ft) => peacefulFoePass(pickActivatableHit(eye, d, ft, collider), ft, doorDistanceOf(eye, d, api.dungeonActivationTargets(), collider), getInteractionMode()))(liveFoeTargets(foes, 'mobileFoe')),   // AUDIT TACT C7: the plaque names the door the press opens
          peer: opts.peerHoverPick?.() ?? null,   // PEER-PLAQUE1: another player underground, raced as the F key picks them - off the key's own ray (AUDIT DROPS E3)
        });
        return opts.profHoverPick?.(ray) ?? ray;   // PROF-MENU: a vein or a body the press would take, over the race's winner
      },
      collider,
      canvas,
      // AUDIT-WH H4: THE PLAQUE'S OWN WORD, not a scheduling accident.
      // The record claimed the dungeon's "only runs with no overlay up"
      // had been replaced by law and it had not - this call had no
      // `cursorActive` at all, and both dungeon hosts return above
      // `drawFoes` when an overlay is live, so the law was still the
      // accident. Those returns take it down now (`hideWorldPlaque`
      // beside `hideHudText`); this is the belt, and it is the CONTEXT's
      // own answer - a host with a window of its own over the dungeon
      // (townTalk's slot) hides it on its own branch.
      cursorActive: dungeonPaused() || !!opts.pointerSurfaceUp?.(),   // AUDIT DROPS E1: and under the F-menu / chat / friends panel - the plaque painted over the menu
      contents: api.lootContents,
      name: api.hoverName,   // WORLD-HOVER: the mod's ladder, the port's own objects, then whatever the host stands
    });
    const _mobileBatches = [];   // C11: the frame's live sprite-mobile quads
    if (playerFeet) { lastPlayerFeet = [...playerFeet]; lastPlayerHeight = playerHeight; }
    if (_blockWaterOverride && playerFeet && blockAtXZ(playerFeet[0], playerFeet[2]) !== _blockWaterOverride.block) _blockWaterOverride = null;   // OH-D: a new block reads its own level   // ROAD-H H2: the enemy AoC blast reads the player's live capsule through castEnemySpell
    // ENHANCED AI 3b: ONE BAKE PER DUNGEON, off the frame, once the
    // player's feet are known - they are the anchor, the component the
    // enemies live in. Only when the Enhanced tab's switch is on; the
    // classic motor never sees this. The bake lands on enhancedNav.chf
    // for the motor (ENHANCED AI 4) and its stats on the console.
    if (playerFeet && !enhancedNav.requested && getPref('enhancedAI')) {
      enhancedNav.requested = true;
      enhancedNav.client = new NavClient();
      enhancedNav.client.bake({ collider, anchor: [playerFeet[0], playerFeet[1], playerFeet[2]], anchors: enemies.map((e) => floorLanding(collider, [e.x, e.y + 0.2, e.z])), exclude: new Set([...actions.objects.values()].filter((o) => isActionDoorObject(o) && !(o.currentLockValue > 0)).map((o) => o.key)), key: _locationKey })   // 2026-09-27 (the degenerate bake of m1204685): the soup leaves out every door a foe opens - an unlocked action door, openDoorsStep's own test; a special or a locked one stays a wall - and the mesh keeps every place agents live: the player's feet and each layout foe's, floor-landed as buildFoeAt lands one (:1107). One line, so no cite into this file moves
        .then((bake) => { if (bake) { enhancedNav.chf = bake.chf; console.log(`[enhanced-ai] navmesh: ${bake.stats.polys} polys, cs ${bake.stats.cs}${bake.cached ? ', cached' : `, ${bake.stats.ms}ms`}`); } })
        .catch((e) => console.warn('[enhanced-ai] navmesh bake failed - classic motor stands:', e?.message ?? e));
    }
    // B1: QuestResourceBehaviour.Update every frame the object lives
    // (dead included - a corpse's component still runs in DFU, and the
    // kill credit lands the update AFTER health hit zero).
    for (const f of foes) { f.questBehaviour?.update(); if (f._keptTag) keptKillTick(f); }   // KEPT-KILL: and a foe kept on a partner's word says its fall
    // AUDIT 18 F5: the rest clock USED to tick here, which made it
    // unreachable - drawFoes only runs when NO overlay is up, and the
    // rest window IS an overlay. It ticks from tickOverlay now, called
    // by the hosts' overlay branch. Left as a marker so the seam is
    // not re-added to the wrong side of the gate.
    if (playerFeet) {
      // AUDIT 27h S1: the breath waits under ANY window holding the player - this host's own (drawFoes does not run
      // under those) and the outer host's street slot (opts.breathHeld), which held the motor while the lungs ran on.
      breathTick(opts.breathHeld?.() ? 0 : dt, playerFeet, playerHeight);
      const _surf = waterSurfaceYAt(playerFeet[0], playerFeet[2]);
      if (!isGateArena(dfLocation) && !isArenaFloor(dfLocation)) sceneAmbience.update(dt, {   // ARENA2: no drip nor dungeon door on the open sand - the crowd is its air (scenes/arenaBouts.js)   // WB6b: the court has its own air (scenes/deadlandsAir.js) - no drip, no door, no bird in the Deadlands
        playerPos: [playerFeet[0], playerFeet[1] + playerHeight / 2, playerFeet[2]],   // the controller center (DFU transform.position)
        waterSurfaceY: _surf,
        submerged: _surf != null && playerFeet[1] + playerHeight / 2 + 76 * 0.025 - 0.95 < _surf,
        // AUDIT 21 (music lane, F3): doNotPlayInCastle
        // (AmbientEffectsPlayer.cs:291-299). ambientEffects READ deps.inCastle
        // and nothing in src/ ever WROTE it, so the suppression was inert and
        // a castle kept dripping and moaning. Same block lookup as the water.
        inCastle: castleBlockAt(playerFeet[0], playerFeet[2]),
      });
    }
    magic.firePending(eye, [-aimed[2], -aimed[6], -aimed[10]]);   // classic: the readied spell fires on the click
    // P13: the shared stealth senses context (EnemySenses' player-
    // side reads). S21: all three illusion branches are LIVE -
    // invisible always blocks (the 13 seers exempt), blending 8%
    // see-through, shade 4% - each folding normal + true powers
    // (DaggerfallEntity.IsInvisible/IsBlending/IsAShade, verbatim).
    // sharedStealthMinute = PlayerEntity.TimeOfLastStealthCheck: the
    // Stealth tally fires once per classic minute ACROSS all foes.
    // AUDIT 24 (wave 36): ONE BUILDER, in scenes/shared.js - the three
    // exterior call sites passed `{ playerInvisible }` alone, and the
    // difference between the two objects was three live bugs above
    // ground. The shared-stealth box moved onto the player entity with
    // it, which is where PlayerEntity.TimeOfLastStealthCheck lives.
    // MT-iv: THE ACTIVE-ENEMY DATABASE for this host. Unlike world.js
    // there is nothing to join - this pool is the dungeon's only
    // enemy pool - but it must filter `dead` every frame so corpses
    // and culled records leave the database the frame they die, as
    // DFU's GetActiveEnemyBehaviours yields only ACTIVE ones.
    // `_activity` is a persistent mutable bag: spread, never mutate.
    const _senses = sensesContext(playerEntity, classicMinutesRef.value, {
      ..._activity, playerHeight, playerCrouching,   // AUDIT 62 F23: playerHeight is the LIVE capsule drawFoes already holds (crouch 0.9, ride 2.6)   // ROAD-H H1b: and the LATCHED crouch state beside it (PlayerMotor.cs:132-136) - the swim case is 0.9 too and draws no arrow dip
      // WORLD3: the peers in the room ride the list - but only for a foe the STREAM carries (AUDIT WORLD3 D1: a quest
      // spawn, a summon or an encounter past the layout's run is nobody's puppet, so a peer it picked was fought by
      // no one: the host took nothing and the peer never learned it existed)
      candidates: foeDeps ? (streamed = false, rec = null) => [...foes.filter((f) => !f.dead && f.ai), ...((_authority && streamed) || ownLoose(rec) ? peerCandidates() : (ownQuestTag(rec) ? peerCandidates().filter((c) => ownShare()?.peerMayHit?.(c.id, rec)) : []))] : null,   // QUEST-PARTY phase 3c: my shared quest foe hunts the party it rides to; SUMMON-SYNC: my loose stand, the room it rides to
      // ROAD-B: EnemySenses.StealthCheck's first statement (:619-621).
      // This is the ONE host that can answer it true, off the same
      // block read the music and the ambient take.
      insideDungeonCastle: lastPlayerFeet ? castleBlockAt(lastPlayerFeet[0], lastPlayerFeet[2]) : false,
    });
    // AUDIT 18: the PLAYER half of this tick moved to systems/worldTick.js
    // and is now called by every host - it used to run only here, so a
    // character who stayed above ground never aged an effect, never
    // progressed a disease, never drained fatigue and NEVER GAINED A
    // LEVEL. The FOE half stays here: it walks this host's foe list.
    const _tick = tickPlayerMinutes({
      entity: playerEntity,
      classicMinutes: classicMinutesRef.value,
      dt,
      sinks: playerSinks,
      activity: _activity,
      fatigueMultiplier: fatigueLossMultiplier(),
      rolls: Math.random,
      // AUDIT 64 F27: the DELAY is the law's, not the host's -
      // AddHUDText takes it (LoanChecker.cs:15's loanReminderHUDDelay),
      // and HudText.add's default parameter restores
      // PopupText.popDelay for every line that passes none.
      say: (msg, delay) => hudText.add(msg, delay),
      // CG2: a dungeon IS inside - HandleStartingCrimeGuildQuests
      // gates on !IsPlayerInside, so the invitation letter waits at
      // the door rather than finding the player underground. The
      // pending clock is untouched; it lands the moment they surface.
      inside: true,
      survival: survivalFeed(playerEntity, survivalEnvNow(), { say: (msg) => hudText.add(msg) }),   // SURV7: the needs' minute
    });
    classicMinutesRef.value = _tick.classicMinutes;
    // AUDIT CLIMB1 F8: the frame's EDGES are spent by the tick that billed them. The bag's one writer is
    // reportActivity, which a street-slot window over a world-hosted dungeon holds (worldModes' overlayHeld) while
    // this tick runs on - so a jump's or a move's edge was billed again every held frame (a mantle's fatigue and
    // Climbing tally sixty times a second: the `jumped` edge had carried the same fault since C6).
    _activity.jumped = false;
    _activity.parkoured = null;
    // AUDIT 24 (wave 32): the FOE half of the same broker event, on the
    // window the tick CLAIMED - one raise, every manager. This loop used to
    // run [floor(clock at frame start), floor(clock now)) off its own
    // arithmetic, so it had neither the broker's catch-up nor its 2880 cap:
    // any minute added by someone else (the rest window, a court sentence)
    // was simply lost for the foes, and diseases never ran on them at all.
    for (const f of foes) {
      if (f.dead) continue;
      runMagicRoundsFor(f.entity, _tick.magicRoundWindow.from, _tick.magicRoundWindow.to, { sinks: foeSinks(f, false) });   // AUDIT 68 S19-round-ticks-player-provenance: as the rest window's
    }
    // AUDIT 24 (wave 31): every entity has an EntityEffectManager, so the
    // stat-zero kill is a FOE law too - a drained-to-zero Strength kills
    // the thing you drained. Off the frame's dt, not the minute loop.
    for (const f of foes) if (!f.dead) killIfAnyLiveStatZero(f.entity, foeSinks(f, false), dt);   // AUDIT 68 S19-round-ticks-player-provenance: SetHealth(0), no source
    collisionTriggers(dt, playerFeet, moveHeld, playerHeight, playerMove);
    updateMissiles(dt, playerFeet, playerHeight);
    // X11: the look direction and the capsule height ride along now -
    // the engine hangs the Light effect's magic candle 1.4 units in
    // FRONT of the player, and `-view[2..10]` is the same forward the
    // cast above fires down.
    magic.update(dt, playerFeet, [-aimed[2], -aimed[6], -aimed[10]], playerHeight, playerRenderFeet);   // M3: player spell missiles fly in the engine; DISC13-A the candle off the render feet
    { const mv = lycanthropeMoveSound(playerEntity, dt); if (mv != null) audio.playOneShot(mv, 1); }   // LM1: the beast's own noise while transformed (real time)
    // S19: WeaponManager's paralysis gate - weapons hide and the
    // machine holds while paralyzed (casting is NOT gated, verbatim:
    // DFU has no IsParalyzed check in the casting path).
    const _pParalyzed = entityIsParalyzed(playerEntity);   // S22: the FreeAction read-time fold
    {
      // WeaponManager.IsPositionInCameraView: project through the
      // live proj*view, inside NDC with positive w
      const pv = multiply(proj, view);
      const inView = ([x, y, z]) => {
        const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
        if (w <= 0) return false;
        const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w;
        const ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w;
        return nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
      };
      audio.setListener(eye, [-aimed[2], -aimed[6], -aimed[10]]);   // A1: the camera is the ears
      // A2 ambient pass. Torches: LoopIfPlayerNear - the looping
      // Burning source exists only while the player is within 5
      // (linear rolloff, volume 0.7); out of range it stops and
      // frees the node. Animals: PlayRandomlyIfPlayerNear - per
      // CLASSIC UPDATE in range, DFRandom.rand() <= 100 barks.
      for (const t of torches) {
        const tdx = eye[0] - t.pos[0], tdy = eye[1] - t.pos[1], tdz = eye[2] - t.pos[2];
        const inRange = tdx * tdx + tdy * tdy + tdz * tdz <= TORCH_MAX_DISTANCE * TORCH_MAX_DISTANCE;
        if (inRange && !t.handle) t.handle = audio.loop3d(SOUND.Burning, t.pos, TORCH_VOLUME, { maxDistance: TORCH_MAX_DISTANCE });
        else if (!inRange && t.handle) { t.handle.stop(); t.handle = null; }
      }
      animalAmbience.update(dt, eye);   // A4 fold: the shared PlayRandomlyIfPlayerNear pass (was inline A2)
      // C10: the rig owns the gesture consume, the swing-sound edge,
      // and the machine step (paralysis holds all three, S19).
      for (const ev of weaponRig.frame(dt, { paralyzed: _pParalyzed })) {
        // AUDIT 23 (combat-2) - WeaponManager.cs:376-380: the bow's
        // swing sound is ArrowShoot at frame 4 of the release.
        if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
        if (ev !== 'hit' || !playerFeet) continue;
        // AUDIT 17k / Mac's report: null weapon = fists, never a bow
        // (the ?. is load-bearing - this raw deref threw on EVERY
        // bare-handed strike frame, the fist crash)
        // AUDIT 17k / Mac's report: null weapon = fists, never a bow
        // (the ?. is load-bearing). AUDIT 18: the test now reads the
        // TEMPLATE, not the display name - an enchanted Long Bow is
        // renamed by createRegularMagicItem and stopped being a bow.
        if (isBowWeapon(playerWeapon.weapon)) {
          // Combat bows: the strike frame LOOSES an arrow along the
          // look instead of the melee arc (WeaponManager verbatim
          // shape).
          const lookDir = [-aimed[2], -aimed[6], -aimed[10]];   // the view-matrix forward this file already uses for the viewmodel
          // one round per loose, verbatim (the ammo guard normally
          // pre-sheathes at zero). WHICH round is the weapon's answer:
          // a bow spends an Arrow, the Thunderlock a Dwemer Pellet.
          if (!spendAmmoFor(playerEntity.items, playerWeapon.weapon)) continue;
          fireArrow(eye, lookDir, playerWeapon.weapon, true, null, null, weaponRig.thunderlockMuzzle(fieldOfView())); weaponRig.noteShot?.(playerWeapon.weapon);   // SPELLFX1: the peers draw it   // FIELD-GUN17: the barrel's own offset when the hand holds the gun, null for every bow - the rig answers, the lane forks   // ROAD-H H1c: fireArrow applies GetAimPosition's player arm (the bow hand), as DFU's missile does its own
          // WeaponManager.cs:419-436, in DFU's order: the swing costs
          // fatigue whatever it hits, and a BOW always takes the tally
          // arm (`!hitEnemy && WeaponType != Bow` is false for a bow),
          // so Archery AND CriticalStrike count a use per loose.
          drainFatigue(SWING_FATIGUE_COST);
          tallySwingSkills(playerEntity, playerWeapon.weapon);
          continue;
        }
        const hitEnemy = resolvePlayerHit(eye, inView, playerFeet, [-aimed[2], -aimed[6], -aimed[10]]);
        // "// Fatigue loss" - unconditional, then the tally arm only
        // when the swing connected. swingWeaponFatigueLoss (11) was
        // ported as a constant and applied by nobody, and
        // CriticalStrike was tallied nowhere in the port at all.
        drainFatigue(SWING_FATIGUE_COST);
        if (hitEnemy) tallySwingSkills(playerEntity, playerWeapon.weapon);
        // AUDIT 23 (C9) - WeaponManager.cs:423-424: the swing sound
        // fires at the HIT FRAME of a swing that hit no enemy (never
        // at strike entry, where the rig used to play it).
        else audio.playOneShot(swingSoundFor(playerWeapon.weapon), 1.1);
      }
    }
    // ENHANCED AI 4: his enemy.js:404 - the findPath budget is refilled
    // once a frame, so a room's worth of foes spreads its pathfinds
    // over frames instead of spiking one. Created lazily: the world
    // object outlives the bake and every foe reads the same one.
    if (enhancedNav.world) enhancedNav.world.pathBudget = enhancedNav.world.budgetPerFrame;
    let _fi = -1;
    _peerFrame++;   // WORLD3: the peers' feet are read once a frame
    // FOE-SPACING: two bodies in one spot are pushed apart (characters/foeSpacing.js) - never a room's foe this page
    // does not own (its owner's stream poses it, as the loop's puppet arm below reads it)
    spaceFoes(foes, collider, foeFrameDt(dt), (f, i) => spacingSkips(f) || f._ownFrom != null || (!_authority && isRoomFoe(f, i)));   // AUDIT (pre-merge) D4: a party member's own foe (QUEST-PARTY 3c, SUMMON-SYNC) is a puppet too - its runner's frame places it
    // AUDIT TACT C7: and no foe holds a dungeon's (or a castle's) doorway - TACT3's rule, always on, on the level's action doors
    clearDoorways(foes, actionDoorSpots(actions.objects, playerFeet, 30), collider, foeFrameDt(dt), (f) => spacingSkips(f) || f._ownFrom != null || (!_authority && isRoomFoe(f, foes.indexOf(f))));
    for (const f of foes) {
      _fi++;
      if (f.dead) continue;
      // S19: a paralyzed foe freezes - EnemyMotor (CanAct = false,
      // FreezeAnims) stops senses/pursuit and EnemyAttack returns
      // (no decisions, no damage frame). EnemySounds is NOT gated
      // in DFU, so the bark pass below still runs.
      const _fParalyzed = entityIsParalyzed(f.entity);   // S22: the FreeAction read-time fold
      const _pf = playerFeet || eye;
      // ROAD-U: MobileUnit.OneShotPauseActionsWhilePlaying, read where
      // DFU's components read it - the transforming Seducer takes no
      // action at all (EnemyMotor.cs:464-466 + :267-269,
      // EnemyAttack.cs:59-61), not merely no anim intent.
      const _fPaused = !!(f.mobile?.isPlayingOneShot() && f.mobile.oneShotPauseActionsWhilePlaying());
      const _fateHeld = !!(f.yielded || f.executing || f.sparing || f.leaving);   // REVENANT-FATE / COMPANION-PORTAL: held where it stands - no step, no blow, no cast
      if (_fateHeld && dungeonFateFrame(f, dt, _pf, eye) === 'gone') continue;
      // WORLD2: a PUPPET - another hosts the room and this layout foe follows its stream (puppetStep): nothing below
      // decides for it (no senses, no pursuit, no swing, no cast, no fall, no door, no bark of its own choosing);
      // the mobile arm past this block still draws it - the walk, the attack clip, the hurt one-shot
      const _roomFoe = isRoomFoe(f, _fi);   // REST-SYNC: the layout's run, or a shared encounter
      const _puppet = isPuppetFoe(f, _fi);   // QUEST-PARTY phase 3c: a party member's quest foe follows its owner's stream; AUDIT PRE-MERGE 0928 O6: the one test, which the host asks too
      let _tgt = null, _strikeEdge = false;
      if (_puppet) {
        _strikeEdge = puppetStep(f, dt);
        f.ai._senses?.(_pf, null);   // AUDIT WORLD2 B4: observation, not decision - the rest gate and the exhaustion collapse read detected/inSight/_dist off the streamed pose
        if (f._pupMine && f.ai.inSight && f.ai.detected && !f.dead) setEnemyAlert(playerEntity, true, classicMinutesRef.value);   // AUDIT WORLD6b-ii B6: the host's foe beating on me is an enemy alert of mine
        f.sounds ??= new EnemySoundSource(f.mobileType);
        tickEnemySound(f.sounds, f.ai.feet, playerFeet || eye, dt, { audio, collider, hearing: acuteHearingMultiplier(playerEntity) });   // the barks are the foe's, not the frame's
        if (_strikeEdge) playEnemyClip(audio, f.sounds.attack(), f.ai.feet, acuteHearingMultiplier(playerEntity));   // the streamed swing's own sound
      }
      else if (!_fateHeld) {   // REVENANT-FATE: a held foe decides nothing
      // MT-iv: the armed context and the target's feet - exteriorFoes'
      // pair, one spelling. Unarmed (no candidates, or the foe
      // subsystem never loaded) both fall through to the legacy
      // player-only path untouched.
      const _armed = (rec, sn, streamed = false) => (sn?.candidates && foeDeps ? {
        ...sn,
        targeting: (ai, pf, cdt) => foeDeps.runTargetMachine(rec, sn.candidates(streamed, rec), pf, cdt, {
          playerEntity: sn.playerEntity ?? playerEntity, playerHeight: sn.playerHeight,   // AUDIT 62 F23: GetTargets measures the player at its LIVE capsule too
        }),
      } : sn);
      const _targetFeet = (rec) => {
        const t = rec.ai.target;
        if (t == null) return rec.ai._armedTargeting ? null : _pf;
        return foeDeps?.isPlayerTarget?.(t) ? (t.feet ?? _pf) : t.ai.feet;   // WORLD3: a peer at its own feet
      };
      // C12: paralysis now flows THROUGH the motor (DFU CanAct=false +
      // flyerFalls) - senses keep running, decisions stop, paralyzed
      // FLYERS fall out of the air, swimmers freeze.
      applyEnemyMotorEffectFlags(f.ai, f.entity);   // A5: Levitate.SetEnemyMotor's IsLevitating, folded from the effect's presence
      f.ai.update(foeFrameDt(dt), _pf, _armed(f, _senses, _roomFoe), _fParalyzed, _fPaused);   // E2 senses + pursuit; P13: the stealth context; MT-iv: the target machine; AUDIT WORLD3 D1: the peers only for a foe the stream carries
      _tgt = _targetFeet(f);   // MT-iv: whatever it SELECTED
      // REVENANT-DUNGEON (systems/revenant.js revenantFleeStep - the open world's own law): a special foe MINE ALONE (offline,
      // or past the room's shared run - a room's layout foe vanishing on one client would leave it standing on the rest)
      // may run; running it aims at nothing (no blow, no cast; the walk below still draws it); out of reach it has
      // ESCAPED - retired through the quest pool's door, no corpse, a revenant made; run down, it is CORNERED and fights on
      const _flee = f.fleeing || (!f._fleeRolled && revenantFleeHealth(f.entity)) ? revenantFleeStep(f, _pf, { mayRun: !onlineRoom() || !_roomFoe, onMe: () => !foeDeps || !f.ai._armedTargeting || foeDeps.isLocalPlayerTarget(f.ai.target) }) : null;   // asked only of a foe running or under the line
      if (_flee === 'escape') { escapeDungeonFoe(f); continue; }
      if (_flee === 'start') revenantSay(revenantFleeEvent(f.entity, foeTitle(f.entity, enemyDisplayName(f.mobileType)), { gender: f.gender, archive: f.mobileArchive, playerName: playerEntity?.name }), (l) => hudText.add(l));
      else if (_flee === 'cornered') revenantSay(revenantCorneredEvent(f.entity, foeTitle(f.entity, enemyDisplayName(f.mobileType)), { gender: f.gender, archive: f.mobileArchive, playerName: playerEntity?.name }), (l) => hudText.add(l));
      if (_flee === 'start' || _flee === 'run') _tgt = null;
      // CH3 (characters-8): a past-threshold landing bills the
      // player's fall formula - trunc(5 x (drop - 5)) - through the
      // pool's damage door (no knockback), ringing FallDamage at the
      // foe. The blood splash rides damageFoe's own art.
      // AUDIT 62 F20: EnemyMotor.cs:1403-1406 splashes at bare
      // `transform.position`, and a DFU enemy's transform is the
      // idle sprite's CENTRE, not the capsule base - the prefab
      // centres the controller on it (m_Center 0) and
      // SetupDemoEnemy.cs:98-115 moves only controller.center
      // (GameObjectHelper.cs:360 confirms: height * 0.52f). That is
      // `centreOffset`, which _centre() answers. The FallDamage
      // clip keeps the FEET: :1409 rings it at FindGroundPosition().
      if (f.ai.landedFall > 0 && !f.dead) {
        const dmg = Math.trunc(FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD));
        f.ai.landedFall = 0;
        if (dmg > 0) {
          audio.play3d(SOUND.FallDamage, [f.ai.feet[0], f.ai.feet[1], f.ai.feet[2]], 1, { maxDistance: 16 });
          // AUDIT 62 F20: the TRANSFORM (feet + centreOffset), per the note above.
          hitEffects?.showBloodSplash(0, f.ai._centre(), null, { ...bloodHit(dmg, f.entity), markIndex: ENEMY_BASICS[f.mobileType]?.bloodIndex ?? 0 });   // BLOOD1b: a fall bleeds by what it cost, like any other blow   // BLOOD1 AUDIT 3: the SPLASH is record 0 for everyone (EnemyMotor.cs:1403-1407's own literal), the MARK is the foe's own - a skeleton's fall stains nothing
          damageFoe(f, dmg, null, null, { fromPlayer: false });   // F041: a fall is nobody's attack
        }
      }
      // E-slice: EnemySenses:533-535 - a foe with the player IN SIGHT
      // raises the enemy alert every update (the dungeon rest roll
      // reads it; an 8-hour decay lowers it).
      // EnemySenses:531-535 - `Target == PlayerEntityBehaviour &&
      // TargetInSight`. MT-iv: two foes brawling must not hold the
      // player's alert state up.
      // AUDIT WORLD3 C3: MY player's alert - a foe that has only ever seen a PEER held it up (isPlayerTarget is true
      // for a peer since WORLD3), and the alert is what refuses the rest and arms its encounter roll
      if ((!foeDeps || !f.ai._armedTargeting || foeDeps.isLocalPlayerTarget(f.ai.target))
        && f.ai.inSight && f.ai.detected && !f.dead) setEnemyAlert(playerEntity, true, classicMinutesRef.value);
      // C-slice (AUDIT 23 characters-3): EnemyMotor.OpenDoors - a
      // CanOpenDoors foe whose sight ray to the player is blocked by
      // an action DOOR opens it when unlocked and within 2m. The
      // senses recorded the blocking bucket key; only a
      // DaggerfallActionDoor counts (walls block sight with the level
      // key). AUDIT 63 F36: EnemySenses.cs:913 stores `actionDoor` off
      // GetComponent<DaggerfallActionDoor>() and EnemyMotor.cs:1425-1442
      // consumes senses.LastKnownDoor with no flag test - a RECORD-LESS
      // door is still one (RDBLayout.cs:247-259), and a special door
      // (a separate MonoBehaviour) is not.
      if (!_fParalyzed && foeDeps && f.ai.doorKey != null && ENEMY_BASICS[f.mobileType]?.canOpenDoors) {
        const _door = actions?.objects.get(f.ai.doorKey);
        if (isActionDoorObject(_door)) {
          foeDeps.openDoorsStep(f.ai.feet, true, {
            state: _door.state, currentLockValue: _door.currentLockValue,
            center: [_door.matrix[12], _door.matrix[13], _door.matrix[14]],
          }, () => actions.toggleDoor(_door));
        }
      }
      // C-slice (AUDIT 23 characters-2): the FIRST-encounter language
      // check (EnemySenses:504-528). A known tongue rolls
      // CalculateEnemyPacification with the sheathed state; success
      // stands the foe down (IsHostile false) and tallies the skill
      // by 3 (DFU's BCHG over classic's 1); a FAILED roll still
      // tallies 1 for the monster tongues - "using" the language -
      // but not for Etiquette/Streetwise. languagePacified's prose is
      // ours (the string table is not in the snapshot; key cited).
      // AUDIT 24 (wave 42): through the one home. This was the tree's
      // only consumer of justEncountered, though the motor raises it
      // for every pool - so no monster and no watchman above ground
      // was ever talked down.
      if (foeDeps) {
        tryLanguagePacification(f.ai, f.entity, f.mobileType, playerEntity, {
          sheathed: playerWeapon.sheathed,
          enemyLanguageSkill: foeDeps.enemyLanguageSkill,
          calculateEnemyPacification: foeDeps.calculateEnemyPacification,
          say: (l) => hudText.add(l),
        });
      }
      // A1 EnemySounds. AUDIT 24 (wave 41): this was the tree's ONLY
      // copy, written inline here, and it had drifted three ways - its
      // mute gate was `!entity.isClass` where DFU carves the city
      // watch out (:222), it never ran SetVolumeScale so a bark came
      // through a dungeon wall at full volume, and it played on an
      // INVERSE rolloff where DFU pins linear to the attract radius.
      // One home now, and the two exterior pools (which had nothing at
      // all) ask the same object the same way.
      f.sounds ??= new EnemySoundSource(f.mobileType);
      tickEnemySound(f.sounds, f.ai.feet, playerFeet || eye, dt, { audio, collider, hearing: acuteHearingMultiplier(playerEntity) });
      // AUDIT 23 (characters-11) - EnemyAttack.cs:70-77: the divisor
      // mints every update from PermanentSpeed / max(8, LiveSpeed).
      f.mobile.frameSpeedDivisor = Math.max(1, Math.trunc((f.entity.stats?.speed ?? 50) / Math.max(8, liveStat(f.entity, 'speed'))));
      // E2b: verbatim attack decision on the shared machine. S19:
      // paralysis returns early, and that is DFU's own gate
      // (EnemyAttack.cs:55-56 `DisableAI || IsParalyzed`).
      // AUDIT 24 (the re-read): a PACIFIED foe is NOT a second gate
      // here - EnemyAttack.FixedUpdate has no hostility test at all, so
      // it still burns its DFRandom byte every classic tick. What stops
      // it swinging is the senses' target drop, which now reads blind
      // in the motor. Skipping the component was a law left with the
      // host, and it desynced the shared stream.
      f.events = (_fParalyzed || !_tgt) ? [] : f.attack.update(foeFrameDt(dt), f.ai, _tgt, _fPaused);   // MT-iv: at the SELECTED target (:199-209)   // AUDIT (pre-merge) P5: FOE-CATCHUP's step - the motor's clock, not the frame's (a 1 s hitch no longer swings at once)
      // C11 audit 08-17: the attack START edge (machine Idle -> swing
      // this frame) - MeleeAnimation fires ChangeEnemyState + the
      // attack sound ONCE at the start, not at the hit frame, and not
      // gated on the hit later connecting. A LEVEL signal replayed the
      // sprite sequence inside one swing (the machine outlasts it).
      const _seq = f.attack.swingSeq;   // AUDIT 68 S04-strike-edge-cut: EnemyAttack's own start count - a mid-release cut restarts the machine inside one update(), which an Idle->strike state edge never saw
      _strikeEdge = _seq !== (f._swingSeq ?? 0);
      f._swingSeq = _seq;
      if (_strikeEdge) f._atkA = foeDeps.bumpAtkCount(f._atkA, f.attack.firedRanged);   // WORLD2: the attack count out, the ranged bit in its low bit (AUDIT WATCH1: one home, enemyTargets.bumpAtkCount)
      // PlayAttackSound (:100-113) - half the time, humans silent
      // except the watch, at whatever volumeScale the last attract
      // sound left behind. Through the one home (AUDIT 24 wave 41):
      // this arm's own `!f.entity.isClass` gate was the same drift.
      if (_strikeEdge) {
        f.sounds ??= new EnemySoundSource(f.mobileType);
        playEnemyClip(audio, f.sounds.attack(), f.ai.feet, acuteHearingMultiplier(playerEntity));
      }
      // S16: the casting decision rides beside the attack machine
      // (DoRangedAttack's spell branch + DoTouchSpell); the decision
      // casts INSTANTLY. RESIDUAL (honest): DFU casters also hold at
      // range and strafe (Enhanced AI) or stand off - our motor keeps
      // the C8 pursuit; the foe casts while closing.
      // P0b (Mac 2026-08-28, the live dungeon crash): guard on _tgt,
      // not playerFeet - the two differ exactly when the MT-iv target
      // machine is ARMED and holds NO target (its duel opponent died
      // this frame), where _targetFeet answers null while the player
      // stands in plain sight. The attack arm above and the exterior
      // host both already guard on _tgt; this arm alone read the
      // wrong variable and handed the null into EnemyCaster.update's
      // playerFeet[0]. DFU's cast branches read the senses' target
      // and simply do not run without one - so the guard IS the law,
      // not a papered-over null.
      // ROAD-U: ...and not while a pausing one-shot plays. DoRangedAttack's
      // spell branch and DoTouchSpell both sit BELOW TakeAction's
      // return at EnemyMotor.cs:466, so a transforming Seducer - which
      // carries a spell table - casts nothing.
      if (_tgt && f.caster && !_fParalyzed && !_fPaused && f.ai.isHostile) {
        // MT-iv: the decision aims at the SELECTED target and reads
        // that target's own entity, so a foe duelling another foe
        // neither picks its school off the player's effects nor
        // releases at them.
        const _castEnt = (!foeDeps || !f.ai._armedTargeting || foeDeps.isLocalPlayerTarget(f.ai.target))
          ? playerEntity : (f.ai.target?.entity ?? foeDeps.PEER_CAST_TARGET ?? playerEntity);   // AUDIT WORLD6b-iii(a) A10: a PEER's effects are none to the pick (AUDIT WORLD6b-ii A9's law, unpaid here - isPlayerTarget admitted a peer and the veto read MINE)
        const dec = f.caster.update(foeFrameDt(dt), f.ai, f.attack, _tgt, _castEnt);
        if (dec) { f._castN = ((f._castN | 0) + 1) & 0xffff; f._castIdx = dec.spell.index | 0; castEnemySpell(f, dec.spell); }   // WORLD3: the cast rides the stream (c, s)
      }
      // E3b: the machine's hit frame resolves against the player -
      // EnemyAttack.MeleeDamage verbatim: gate 0.25 / MeleeDistance +
      // 35.156deg, then CalculateAttackDamage (class hand-to-hand;
      // equipment E4). The player is the Humanoid group
      // (GetBonusOrPenaltyByEnemyType's PlayerEntity arm - the Undead
      // half needs vampirism, which the port does not have).
      // HUD pends the UI arc: health surfaces on __player.
      // C17: sprite archers loose on their -1 shoot marker (below); a
      // RANGED swing's hit frame stays the DECISION clock only. (ON ICE
      // with the rig path: the machine-frame loose for rig archers.)
      // C-slice: keyed on the SWING that fired - a bow foe inside 6m
      // swings MELEE (DoRangedAttack's fallback) and lands damage here
      // like anyone.
      // AUDIT 68 S19-archer-hit-frame-continue: a gate, not a `continue` - that skipped the foe loop's mobile update
      // and draw below, so a sprite archer vanished for one frame on every bow shot.
      if (playerFeet && f.events.includes('hit') && !f.attack.firedRanged) {
        // C16: the machine's hit frame is the RIGS' damage clock;
        // sprite mobiles land damage on their -1 sequence markers
        // below (doMeleeDamage, verbatim - the Frost Daedra's base
        // sequence strikes TWICE per swing).
        if (!f.mobile) resolveFoeMelee(f, _pf);
      }
      }   // WORLD2: the end of the authority's own step - a puppet skipped it
      if (f.mobile) {
        // C11: the sprite mobile. Paralysis freezes the anim clock
        // (FreezeAnims - the cached output redraws); otherwise the
        // unit consumes the frame's intent: attack while the shared
        // machine swings, hurt on the damage trigger, move/idle by
        // pursuit. The frame texture uploads lazily per record#frame.
        // AUDIT 24 (wave 33): NO ANIMATION FREEZE. This used to skip the
        // whole mobile update while paralysed and redraw the cached
        // output, on the strength of EnemyMotor.HandleParalysis's
        // `mobile.FreezeAnims = true` - but :259 sets it back to false on
        // the line after the closing brace, with nothing reading it in
        // between and no other writer in the tree, so a paralysed enemy's
        // animation is NEVER frozen in DFU. UpdateToIdleOrMoveAnim runs
        // after the `if (CanAct)` gate and puts a stationary one into
        // Idle, which keeps playing; UpdateOrientation has no FreezeAnims
        // check at all, so the sprite keeps turning to face the player
        // too - and the port's cache froze the FACING as well as the
        // frame. What stops the blow is EnemyAttack's early return, which
        // is the consume-and-clear below.
        if (!_fateHeld) {   // REVENANT-FATE: a held foe's pose is its own (dungeonFateFrame) - it is still drawn below
          // A5 - DaedraSeducerMobileBehaviour.Update, a MonoBehaviour
          // Update that runs BEFORE the anim step consumes the state
          // it raises. Its one input is `enemySenses.Target ==
          // PlayerEntityBehaviour`, spelled here exactly as the alert
          // arm below spells it (an unarmed host targets the player).
          f.seducer?.update(foeFrameDt(dt), !foeDeps || !f.ai._armedTargeting || foeDeps.isLocalPlayerTarget(f.ai.target));   // AUDIT WORLD6b-ii A4: DFU's trigger is Target == PlayerEntityBehaviour - ME, not a peer
          // EnemyMotor.CanFly (:837-845) reads `mobile.Enemy.Behaviour`
          // LIVE - "This can change in the case of a transformed
          // Seducer" - where the port's motor captured it at spawn.
          // The transform rewrites that field twice (Flying while
          // crouched, General while standing) and once more for good
          // at SetSpecialTransformationCompleted, so the read is folded
          // here, on the one mobile whose behaviour is not a constant.
          if (f.seducer) f.ai.flies = f.mobile.basics.behaviour === 'Flying' || f.mobile.basics.behaviour === 'Spectral';
          f._mout = f.mobile.update(dt, {
            moving: f.ai.moving,
            striking: _strikeEdge && !f.attack.firedRanged,   // the START edge (paralysis eats it - the attack machine above is gated, so ChangeEnemyState never fires: EnemyAttack.Update's early return, NOT FreezeAnims - wave 33)
            rangedStriking: _strikeEdge && !!f.attack.firedRanged,   // C17: archers draw records 20-24 - keyed per SWING (the in-band bow shot), not per foe
            hurting: f.ai.hurtKnock,   // C15: the knockback threshold IS the hurt anim (KnockbackMovement)
            casting: !!f._castPending,   // C14: the cast decision's edge (Spell one-shot)
          }, f.ai.yaw, f.ai.feet, eye);
          f._castPending = false;
          // a puppet lands no blow of its own (WORLD2) - unless the blow is at ME, and a shaft at anyone flies (WORLD3, the arm consumes
          // those). AUDIT WORLD6b-ii B10: dropped AFTER the mobile set them this frame, not in puppetStep before it - a frame latched
          // while the target was another survived to the next frame, and fired at me if the streamed target flipped in between
          if (_puppet && f.mobile) {
            if (!f._pupMine) f.mobile.doMeleeDamage = false;   // WORLD2 dropped unconsumed, WORLD3: unless mine
            if (f._pupTarget == null) f.mobile.shootArrow = false;   // WORLD2 dropped unconsumed, WORLD3: unless at anyone
          }
          // C17: the ranged -1 (shootArrow) looses the arrow at the
          // player - the machine's hit event no longer fires it for
          // sprite archers.
          // C16: the -1 damage marker IS the damage moment (AnimateEnemy
          // doMeleeDamage -> MeleeDamage). Paralysis does not reach it
          // because EnemyAttack.Update returns at the top (:91-94) - and
          // because that return happens BEFORE the clear at :100, the
          // latch survives and the blow lands on the first unparalysed
          // frame. (The comment here used to credit FreezeAnims, which
          // is a dead store - wave 33.)
          //
          // MELEE FIRST, and the arrow as the ELSE-IF: DFU's
          // EnemyAttack.Update is `if (mobile.DoMeleeDamage) {...} else
          // if (mobile.ShootArrow) {...}` (:97-105). Wave 33 wrote two
          // independent ifs in arrow-first order, so a foe that had
          // latched both would loose an arrow AND land a blow in one
          // frame, and would prefer the arrow. (Found by the wave-35
          // re-read.)
          if ((_tgt || f._pupMine) && !_fParalyzed && f.mobile.doMeleeDamage) { f.mobile.doMeleeDamage = false; resolveFoeMelee(f, _pf, { vsPlayer: !!f._pupMine }); }   // MT-iv: gated on a live TARGET (:136-137), not the player alone; WORLD3: a puppet's blow at ME, my own reach
          else if ((_tgt || f._pupTarget != null) && !_fParalyzed && f.mobile.shootArrow) {   // ROAD-H tail: gated on a live TARGET like the melee arm - BowDamage returns at `senses.Target == null` (EnemyAttack.cs:136-137); WORLD3: a puppet's at its streamed target
            f.mobile.shootArrow = false;
            const from = foeDeps.enemyArrowOrigin(f.ai);   // ROAD-H H1: GetAimPosition's ENEMY ARROW arm - the caster's TRANSFORM plus forward*0.6 plus height/3 (DaggerfallMissile.cs:528-539), through the ONE law in enemyTargets so the two pools' loose points cannot drift apart the way their aim points had. `feet + 1.2` was a guess in the player's scale with no forward lean at all
            // WORLD3: a puppet's shaft flies at its streamed target - me (a real one), or a peer's body (a shaft that pays nothing); the host's at a peer likewise pays nothing here
            const _at = f._pupTarget != null ? (f._pupMine ? foeDeps.PLAYER_TARGET : peerCandidate(f._pupTarget)) : (f.ai.target ?? foeDeps.PLAYER_TARGET);
            if (!_at) { /* a target I cannot see: no shaft */ }
            else {
            const _atPlayer = foeDeps.isPlayerTarget(_at) && !_at.isPeer;   // ROAD-H tail: BowDamage's two-arm split (EnemyAttack.cs:139-143) - the shaft flies at the SELECTED target, as the exterior pool's has since MT-ii
            const aim = foeDeps.targetAimPoint(_at, _pf, playerHeight);   // AUDIT 62 F21 (review): the target's TRANSFORM - the player at its LIVE height (PlayerHeightChanger.cs:477-478), a foe at feet + centreOffset - the same aim point the spell arm takes (DaggerfallMissile.cs:571-581)
            const dir = foeDeps.arrowAimDirection(foeDeps.enemyTransformPoint(f.ai), aim, { targetIsPlayer: _atPlayer, playerCrouching: !!_senses.playerCrouching });   // ROAD-H H1b: the DIRECTION is measured from the BARE transform (:581), not from that offset origin - DFU's two functions do not share an origin - and a shot at a CROUCHING player dips 0.05 after the normalise (:583-585)
            fireArrow(from, dir, f.entity.weapon, false, f, _atPlayer ? null : _at);   // the missile REMEMBERS its foe target so the impact fork runs BowDamage's non-player arm (a peer: no arm, the shaft pays nothing)
            audio.play3d(SOUND.ArrowShoot, from, 1, { maxDistance: 16 });   // C2-slice (combat-9): the loose rings from the archer (EnemyAttack Update)
            }
          }
        }
        // A5 - EntityConcealmentBehaviour.Update/MakeConcealed
        // (:36-43, :56-62): "Handles magical concealment for entities
        // other than player". A non-player entity whose
        // IsMagicallyConcealed is true has its renderer DISABLED -
        // any of the six flags, normal or true power. The animation
        // above still ran (DFU's Update on the mobile is untouched by
        // this component); only the draw is dropped.
        // ECV1: on the enhanced skin with the switch on, the concealed
        // foe is DRAWN concealed instead (systems/combatVisuals.js):
        // `hidden` is the A5 skip, `conceal` rides the batch to the
        // renderer's concealed phase, `plain` is an unconcealed foe.
        const ecv = foeDraw(f, ecvOn, _ecvT);
        if (ecv.kind === 'hidden') continue;
        f.batch.conceal = ecv.kind === 'conceal' ? ecv.visual : null;
        setBatchHitFlash(f.batch, foeHitFlash(f, performance.now() / 1000));   // HITFLASH1: a foe struck flashes red - any blow, mine, a peer's, or its owner's stream
        setBatchEliteGlow(f.batch, eliteGlow(f.entity, performance.now() / 1000, (f.mobileType * 1.7) % 6.28), performance.now() / 1000);   // ELITE FOES: the pulse
        const _dv = f.executing || f.sparing || f.portalFx ? fateDissolve(f, Date.now()) : null;   // REVENANT-FATE / COMPANION-PORTAL: burning away, or through a portal
        if (!_dv && f.portalFx && f.portalFx.dir === 'in') f.portalFx = null;
        setBatchDissolve(f.batch, _dv ? _dv[0] : 0, _dv ? _dv.slice(1) : undefined);

        const out = f._mout;
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${f.mobileArchive}_${rkey}`)) uploadRecordFrame(f.mobileArchive, out.record, out.frame);
        f.batch.record = rkey;
        const sz = mobileBillboardSize(f.mobileTex, out.record);   // AUDIT MM1: a mobile unit's record cache carries the xml scale - a shared, cached object: read, never written
        // C17: the texture-475 female casting records read too small
        // from the files - DFU post-scales 20-24 by 1.35 (OrientEnemy).
        // FB0930-FOE-RAYS: onto LOCALS. It multiplied the width and height ON the
        // cache's own object, so every frame a caster spent casting grew
        // that record by another 35% for the rest of the session.
        const szK = f.mobileArchive === 475 && out.record >= 20 && out.record <= 24 ? 1.35 : 1;
        const szE = eliteSize(f.entity);   // ELITE FOES: a quarter larger
        const szW = sz.w * szK * szE, szH = sz.h * szK * szE;
        f.batch.size = { w: out.flip ? -szW : szW, h: szH };   // negative width = FlipLeftRight (UVs ride the corners)
        // INCIDENT 2026-09-04: the billboard shader bottom-anchors. A
        // walker's origin is its feet (DaggerfallMobileUnit.cs:402-406
        // keeps them aligned across records); a flyer or swimmer keeps
        // its CENTRE (:407-410), so its origin is centre - recordH/2.
        const _bh = f.mobile.basics.behaviour ?? 'General';
        if ((_bh === 'Flying' || _bh === 'Aquatic') && f.idleH !== undefined) {
          const o = f._origin ?? (f._origin = [0, 0, 0]);
          o[0] = f.ai.feet[0]; o[1] = spriteOriginY(f.ai.feet[1], f.idleH, szH, _bh); o[2] = f.ai.feet[2];
          f.batch.origin = o;
        } else f.batch.origin = f.ai.feet;
        _mobileBatches.push(f.batch);
        continue;
      }
      if (!f.rig) continue;   // ON ICE (C17): the rig path below draws nothing - every live foe is a mobile
      if (!_fParalyzed) {   // S19 FreezeAnims: the rig holds its live frame
        f.rig.setGait(f.ai.moving ? 1 : 3);   // WALK while pursuing, IDLE sway at rest
        let pose = f.attack.pose();
        if (f.reaction) {                     // a hit stagger overrides the strike
          f.reaction.t += dt;
          const R = f.reaction.clip;
          if (f.reaction.t >= R.dur) f.reaction = null;
          else pose = foeDeps.sampleClip(R, f.reaction.t);   // seconds, not phase (units bug, audit 2026-08-16: staggers cut at a third)
        }
        f.rig.setPose(pose);
        f.rig.update(dt);
      }
      const s = f.rig.scale, p = f.ai.feet;
      const mat = trs(p[0], p[1] - f.rig.liveFootY * s, p[2], 0, f.ai.yaw * 180 / Math.PI, 0, s, s, s);   // live support point, same grounding rule as the player rig
      _drawSprite(renderer, canvas, f.rig, mat, proj, view, eye);
    }
    // C11: the sprite mobiles draw as one billboard pass. The right
    // axis is the NEGATED view row - the same (cos yaw, 0, -sin yaw)
    // axis every host passes for its static flats. That axis carries
    // the engine's screen-mirror convention (our right-handed lookAt
    // shows world +x on screen-right where Unity shows -x; the flats'
    // axis bakes the compensating mirror in), so DFU's verbatim
    // FlipLeftRight booleans land in the same frame as everything
    // else. Ground-truthed against raw record art: skeletal warrior
    // 270/17 renders unmirrored (facing its walk direction) with this
    // axis, mirrored (moonwalking) with the raw view row.
    // U26: the player's own dropped piles ride the SAME pass as the
    // sprite mobiles - they are billboards at a world position with
    // no animation, exactly like a corpse.
    if (_leftDone.length) runLeftDone();   // COMPANION-PORTAL: the portal has them - out of the pool, after the loop
    droppedLoot.tickFlats(dt);   // FA1 slice 3
    portals.tick(eye);   // COMPANION-PORTAL
    const _dropBatches = [...droppedLoot.batches(), ...portals.batches()];   // COMPANION-PORTAL: the portals ride the drops' pass
    const _spellBatches = magic.batches();   // M3: player spell missiles
    // BLOOD1 AUDIT 3: the ring is NOT drawn here. It was - inside this
    // gate - and both dungeon hosts already draw the context's pool by
    // its handle beside the level's own flats (worldModes.js's dungeon
    // arm, dungeon.js), so the world-hosted dungeon drew every mark and
    // every chunk TWICE a frame, and the standalone host drew them only
    // while a foe, a drop or a spell was alive: clear the level and the
    // floor went clean. The host owns the pass, as the other three do.
    if (_mobileBatches.length || _dropBatches.length || _spellBatches.length) {
      renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],
        new Float32Array([-view[0], -view[4], -view[8]]), UP_Y);
    }
    // INVIS-LOOK (2026-09-27): the host's concealed peers' bodies, translucent - after the last opaque flat (the foes),
    // before the water and the screen quads that end the world pass (WATER-D1's law, below)
    opts.lateWorldDraw?.();
    // WATER-D1 (2026-09-21, LostMyLeg: "you can see 2 Watertiles/textures
    // floating around ... the console says 2 Water in every dungeon";
    // Mac's AIWATER report before it: "shown well below the floor, in
    // patches, reading like a no-clip glitch"). THE WATER WAS DRAWN
    // AFTER THE FRAME HAD BEEN RESOLVED. Both dungeon hosts called
    // renderer.drawWater AFTER this function returned - and this
    // function ends with the weapon overlay and the HUD, which are
    // screen quads, and a screen quad is where the enhanced-lighting
    // lane ENDS the world pass and RESOLVES its frame target to the
    // canvas (renderer.drawScreenQuad -> _compositeAir: the lane's
    // framebuffer is unbound, `_frameFbo` is null). A water quad drawn
    // after that lands on the DEFAULT framebuffer, whose depth buffer
    // holds no world at all (the frame's depth went into the lane's
    // target), so it passed the depth test everywhere: a plane visible
    // through every wall and every floor, wherever you stood. On the
    // classic set there is no lane and no resolve, the default depth
    // buffer IS the world's, and the same call order was correct -
    // which is why the plane was right for months and wrong from EL3
    // (2026-09-17) on. The level itself was never the defect: the
    // quads sit exactly where DFU's AddWater puts its plane (R7).
    //
    // The draw is a WORLD draw, so it runs here, in the one frame
    // function both hosts call, after the last world billboard and
    // BEFORE the first screen quad - the same law the exterior's water
    // surface has always kept (world.js draws it inside its pixel loop,
    // long before the HUD). Blended with depth writes off, after the
    // foes, as the hosts had it. Under an overlay this function is not
    // called and the water is not drawn - as before.
    _waterT += dt > 0 ? dt : 0;
    if (waterQuads.length && _waterArchive != null) {
      renderer.drawWater(waterQuads, DUNGEON_WATER_COLOR,
        renderer.textures.get(`${_waterArchive}_0`), _waterT * WATER_SCROLL_TILES_PER_SEC);
    }
    opts.csaDrawParticlesBlended?.();   // CSA-F: a boat on the dungeon's water - its drops, blended after the water (the Transparent queue), before the first screen quad
    // LAST before the HUD: the classic weapon overlay composites over
    // the whole frame (DaggerfallUI draws it under the HUD). The rig
    // runs the bow-arrow guard and the ShowWeapons legs; S19
    // paralysis rides the same call (C10 fold).
    if (playerFeet) weaponRig.draw({ paralyzed: _pParalyzed });
    // U1: HUD last (over the viewmodel), heading from the view
    // forward this file already derives (0 = +z, wrapped 0..1).
    const hfw = [-view[2], -view[10]];
    const heading01 = ((Math.atan2(hfw[0], hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1;
    // X4: the Detect markers ride the same call - foes and loot piles
    // are this host's two nearby pools.
    const detected = detectFeed.tick(dt);
    drawHud(renderer, canvas, hudArt, playerEntity, heading01, dt,
      { font: hudFont, cursorActive: !!activeOverlay,
        // AUDIT 64 F35 (review round): the PAINT's gate, which is not
        // "a window is open" - a message box carries the HUD under it
        // (DaggerfallUI.cs:1330 over DaggerfallPopupWindow.cs:76-84).
        windowCoversHud: !!activeOverlay && dungeonWindows.hudCovered(activeOverlay),
        hudHidden: hidesHud(activeOverlay),   // AUDIT PRE-MERGE 0928 U8: a window that takes the HUD away outright, large HUD and all (MAP-FIELD2's word - Come Sail Away's position map, PauseGame(true, true), mounts here too)
        detected, playerXZ: playerFeet ? [playerFeet[0], playerFeet[2]] : null,
        party: partyCompassPoints({ bodies: opts.party ?? null }), nodes: playerFeet ? (opts.nodeMarks?.(playerFeet) ?? null) : null,   // COMPASS-PARTY: the mates standing in this dungeon, at their feet in its frame; NODE-MARKS: the professions' nodes standing here (its veins), in its frame
        largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity),
        // AUDIT 39: the enhanced HUD's two hand plaques - see world.js.
        readied: magic.readied() ?? null,
        weapon: playerWeapon.weapon ?? null,
        // QS4: THE PHONE'S OWN DOORS. The diamond's cells take a finger
        // on a touch-first device (ui/enhancedHud.js's second departure),
        // and a door the host never handed over is a control that
        // platform does not have - which is the whole of AUDIT SOC C9.
        quickUse: (n) => quickUse(n), quickSwap: () => quickSwap(), quickOffHand: () => quickOffHand(), quickSpell: () => quickSpell(), quickSwitchHand: () => quickSwitchHand(),   // QS6   // MAC-R3
        grip: _activity.grip ?? null,   // CLIMB2: the host's report carries the enhanced climb's grip
        weaponSheathed: !!playerWeapon.sheathed });   // AUDIT 28 W2: the arrow counter's drawn-bow gate   // U38 + X4 + U43
    opts.csaDrawWindWidget?.();   // CSA-E: Come Sail Away's wind widget over the HUD (the outer host's)
    hudText.tick(dt);
    // AUDIT 64 F37: popupText is a NativePanel component of the HUD
    // window (DaggerfallHUD.cs:172-173) and the Draw override
    // (:347-351) suppresses it with everything else; the tick is
    // Update's and keeps draining.
    hudText.observe(!!activeOverlay && (dungeonWindows.hudCovered(activeOverlay) || hidesHud(activeOverlay)));   // AUDIT ENH-NOTICE3 C2: the previousWindow chain (windowCoversHud above asks the same), not the slot - a pushed box keeps the toasts as DFU keeps PopupText under it   // AUDIT FONT F4: a canvas window standing over the column takes it down - the DOM column has no draw order to put it underneath
    if (hudFont && hudRenderEnabled()) hudText.draw(renderer, canvas, hudFont, hudScaleFor(canvas.width, canvas.height)); else hudText.hide();   // FONT1: the refused frame reaches the hide door - the enhanced skin's column is DOM and persists (AUDIT 64 F37)
    // The CLICK TO LOOK banner retired with click-to-look itself: the
    // hosts re-engage a dropped lock on the next gesture (DFU shape),
    // so an unlocked frame is transient, not a mode to advertise.
    // The F8 'lock' debug line below keeps the diagnostic.
    if (debugHud && hudFont) {
      // F8 diagnostics: every live-play unknown, on screen.
      const s2 = hudScaleFor(canvas.width, canvas.height);
      const feet = lastPlayerFeet ? lastPlayerFeet.map((v) => v.toFixed(2)).join(',') : 'null';
      const lines = [
        `build ${BUILD_TAG}`,
        `feet ${feet}  ${_motorState}`,
        `enter ${this.enterMarker ? [this.enterMarker.x, this.enterMarker.y, this.enterMarker.z].map((v) => v.toFixed(2)).join(',') : 'none'}  start ${this.startMarker ? [this.startMarker.x, this.startMarker.y, this.startMarker.z].map((v) => v.toFixed(2)).join(',') : 'none'}`,
        `overlay ${activeOverlay ? activeOverlay.constructor.name : 'none'}  chargenDone ${!!playerEntity.chargenDone}`,
        `lock ${typeof document !== 'undefined' && document.pointerLockElement ? 'yes' : 'NO'}  class ${playerEntity.careerIndex ?? '?'} ${playerEntity.career?.name ?? ''}`,
        `hp ${playerEntity.health}/${playerEntity.maxHealth}  mp ${playerEntity.magicka}/${playerEntity.maxMagicka}`,
        `mouse ${_mouseState}`,
        `input ${_inputState}`,
        // IF1 (Mac: "in the dungeon, enemies don't attack each other"):
        // the infighting census, because every layer of that feature
        // reads correct on paper and the question is which one is not
        // firing in a real dungeon. One line separates all of them:
        //   armed 0        -> the target machine is not running here
        //   teams 1        -> one team present, so NO infighting is
        //                     DFU-correct and there is nothing to fix
        //   vsFoe 0 with   -> selection is running and rejecting every
        //     teams 2+        candidate; the bug is in getTargets' gates
        //   vsFoe > 0      -> they ARE picking each other, and the gap
        //                     is downstream in acting or in visibility
        _foeCensus(),
      ];
      lines.forEach((t, i) => drawText(renderer, hudFont, t, 4 * s2, (4 + i * 9) * s2, s2, [0.4, 1, 0.5, 1]));
    }
    // FONT3 (2026-10-02, Mac: "we need to ensure everything recieves our enhanced font"): the classic skin's line
    // alone. Under the enhanced skin the HUD's caption already says the readied spell in the pixel face ("Ready" and
    // its name, ui/enhancedHud.js parts.readied), so this bitmap line stood under it in a second face, saying it twice.
    if (hudFont && magic.readied() && !isEnhanced()) {
      // U2a's first consumer: the readied spell + cost, classic text
      // above the vitals (the spellbook window replaces this in U4).
      const s = hudScaleFor(canvas.width, canvas.height);
      drawText(renderer, hudFont, `${magic.readied().name} (${magic.readiedCost()})`, 10 * s, canvas.height - 60 * s, s, [0.9, 0.9, 0.75, 1]);
    }
  }

  // Music is NOT started here any more (AUDIT 19's 1:1 pass): the
  // SongManager decides when a song changes, from a context the host feeds
  // it every frame. What this context owes it is the SEED, above.

  // A1: THE AUTOMAP MOUNT. Identity + world AABBs were collected at
  // the draw-entry push sites; the per-dungeon record enters here (a
  // fresh entry resets visitedThisRun - the LOAD arm lives in
  // quickLoad), the 5 Hz probe clock rides the hosts' automapTick,
  // and M opens the window through toggleAutomap.
  const automapKey = automapDungeonKey(dfLocation?.regionIndex ?? -1, dfLocation?.name ?? _locationKey);
  // MAP-KEEP (2026-09-27, Flylighter: "Parts of the map previously filled out will randomly disappear from the 3D
  // map"): a LOAD into this dungeon enters on the load arm (InitWhenInInteriorOrDungeon's initFromLoadingSave,
  // :2492-2493). The world host builds a saved dungeon through the door's own build, and this line reset the colour
  // tier of the record the load had just restored - every step of the run went gray - stamped it and pruned the
  // store the save carried; quickLoad's re-fetch below came too late to keep any of it.
  let automapRec = isGateArena(dfLocation) || isArenaFloor(dfLocation) ? detachedAutomapRecord()   // ARENA2: nor the arena's floor   // AUDIT 27h M1: the court keeps no map, so it takes no slot from one
    : enterDungeonAutomap(automapKey, classicMinutesRef.value, { fromLoad: !!opts.automapFromLoad });
  // ROAD-C c2/S1: the reveal MODEL (rows in DFU's block/element/model
  // walk order, the point-query hash grid, the draw partition). Bind
  // it to the record: a first visit stamps the block-name list, a
  // return runs DFU's layout guard (:2385-2386) over it.
  const automapModel = buildRevealIndex(automapEntries);
  bindAutomapLayout(automapRec, automapModel);
  // ROAD-E E3: Automap.Start's LAST act (:965-975) - AutoMapConsoleCommands
  // .RegisterCommands, inside DFU's own try/catch. It lands after the bind
  // because the bind is what makes `Automap.instance` answer.
  registerAutomapConsoleCommands();
  // ROAD-C c2/S8: THE AUTOMAP'S TELEPORT LISTENER. DFU subscribes
  // Automap.OnTeleportAction to the static DaggerfallAction event at
  // :924, so a portal the player walks through is recorded on the map
  // whichever host is driving. The port installs it HERE, on the context
  // that owns both the action system and the automap record, so BOTH
  // dungeon hosts get it without either of them knowing: each overwrites
  // `actions.onTeleport` with its own motor warp and neither touches
  // this seam. It is installed AFTER bindAutomapLayout, because the bind
  // is what may empty a stale record's portals.
  actions.onTeleportPortal = (from, to) => { recordTeleporterConnection(automapRec, from, to); };
  // TP-SEEN: EVERY portal in the level, read off the same action graph and layout rows the warp uses, so the map can
  // show a teleporter once the place it stands has been seen - not only after it has been walked through. Keyed as
  // recordTeleporterConnection keys it, so a walked portal is the same portal. Built once, on the first ask.
  let _automapPortals = null;
  const automapPortals = () => {
    if (_automapPortals) return _automapPortals;
    const out = new Map();
    for (const o of actions.objects?.values?.() ?? []) {
      if (o?.actionFlag !== ACTION_FLAGS.Teleport) continue;
      const to = actions.resolvePosition?.(o.ns, o.nextKey) ?? null;
      const from = actions.resolvePosition?.(o.ns, o.positionKey) ?? (o.origin ? { pos: o.origin, yawDeg: 0 } : null);
      const c = from && to ? teleporterConnection(from, to) : null;
      if (c && !out.has(c.key)) out.set(c.key, c.conn);
    }
    _automapPortals = out;
    return out;
  };
  let automapScanT = SCAN_INTERVAL_S;   // the first tick probes at once (Automap.cs:993-1002's lazy-init scan)
  let _automapEye = null;
  // The player marker arrow, Daggerfall mesh 99900 (Automap.cs:1355).
  // Absent from a stripped ARCH3D the window falls back to a red quad.
  let automapArrow = null;
  try { automapArrow = await getGpuMesh(99900); if (automapArrow) await ensureRemap(99900); } catch { automapArrow = null; }
  // c2/S7: the arrow's own local bounds are the picker's proxy for it
  // (DFU adds a MeshCollider to the same object, :1358). Absent, the
  // arrow is drawn and simply not pickable - which is what an absent
  // collider means.
  const automapArrowBounds = (() => {
    const cpu = cpuModels.get(99900);
    if (!cpu?.positions?.length) return null;
    return worldAabb(cpu.positions, identity());
  })();
  // ROAD-C c2/S5: AMAP00I0 + AMAP01I0 + the compass strip, warmed the
  // way every other native window's art is (the U23 shape). A failure
  // costs the ART, not the map - the window keeps its keyed fallback.
  preloadAutomapArt({ renderer, fetchBytes, palette })
    .catch((e) => console.warn('[automap] native map art unavailable; keyed fallback:', e?.message ?? e));
  // InitWhenInInteriorOrDungeon raises the reset signal the window's
  // next OnPush pulls and erases (Automap.cs:2490-2494) - entering a
  // dungeon IS that moment.
  signalAutomapReset();

  // SPAWNED-DUNGEONS-TTL: the clear scan's own throttle and its latch - the
  // host is told ONCE, not once a frame for the rest of the visit.
  let _clearedCheckT = 0, _clearedSent = false;
  const CLEARED_CHECK_INTERVAL_S = 5;

  // WORLD-HOVER hoisted this OUT of the api literal: the construction
  // seam below composes it, and a method reaching back through `api`
  // inside `api`'s own initialiser is the TDZ shape the boot gate
  // refuses (test/tdz_selfreference.test.js). A named function is what
  // both of them call, and `api.lootTargets` below is the same one.
  // S2 pickup: piles + dead foes' corpses as activation targets;
  // U26: activating one now OPENS THE INVENTORY with the pile as the
  // remote target, which is what PlayerActivate does - the old
  // takeLoot vacuumed everything in one keypress.
  function lootTargets() {
    const targets = [];
    // AUDIT 65 MC-2: every kind here competes for the ray at the
    // RAY's reach (PlayerActivate.cs:76/:314) and carries its own
    // handler constant beside it, because the refusal is spoken
    // INSIDE the handler - ActivateLootContainer's
    // `hit.distance > TreasureActivationDistance` (:868-873) and the
    // corpse arm's `hit.distance > CorpseActivationDistance`
    // (:936-941), each SetMidScreenText(youAreTooFarAway). Dropping
    // the target at the pick, as the port did, answers with silence
    // and lets the click fall through to whatever stood behind it.
    lootPiles.forEach((p, i) => {
      if (!p.batch) return;
      const [hx, hy] = p.half;
      targets.push({ key: `loot:${i}`, aabb: { min: [p.pos[0] - hx, p.pos[1], p.pos[2] - hx], max: [p.pos[0] + hx, p.pos[1] + hy * 2, p.pos[2] + hx] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
    });
    foes.forEach((f, i) => {
      if (!lootableBody(f) || !f.entity?.items?.length) return;   // AUDIT 68 S19-removed-foe-lootable
      const p = corpseAt(f);
      // PlayerActivate.cs:85/:938 - a corpse has its OWN reach,
      // CorpseActivationDistance = 150 * GlobalScale = 3.75, not the
      // 128-unit default the loot piles use.
      targets.push({ key: `corpse:${i}`, aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true });   // LOOT-STACK: a body, the producer's word (player/lootStack.js)
    });
    targets.push(...droppedLoot.lootTargets());   // U26: the player's own drops
    targets.push(...droppedTorches.targets());   // HT1: the dropped torches, at the mod's 3.2
    targets.push(...camps.targets());   // SURV3: the fires, at the same 3.2
    return targets;
  }

  // WORLD-HOVER: the host-registered halves of the activation target
  // list and of the naming ladder (see addActivationTargets and
  // addActivationNamer below). The context's own namer runs LAST, so a
  // host can override a word for a family it stands differently.
  const _hostTargets = [];
  const _hostNamers = [];

  /**
   * The context's own arm of the naming ladder: World Tooltips' words
   * for what a dungeon stands, each cited to the mod's source.
   *
   * It answers NOTHING it does not know, which is the mod's own
   * behaviour (an empty `ret` leaves the tooltip down, .cs:169-172) and
   * what stops an unported family labelling itself with its key string.
   */
  function _dungeonHoverName(key) {
    // AUDIT-WH2 L2-F5: C1's guard. The exterior ladder got it when C1
    // shipped and the other three did not; this one is reached through
    // `addActivationNamer`, which the tree documents as the door a third
    // party would use, so it must survive a key it did not mint.
    if (typeof key !== 'string') return null;
    const modOn = worldTooltipsOn();
    const hide = hideInteractTooltip();
    // PX21c's loot rows come first and are NOT the mod's - they are
    // the port's own departure and predate its arrival, so they answer
    // whether the mod is switched on or off.
    if (key.startsWith('corpse:')) {
      const f = foes[Number(key.split(':')[1])];
      // .cs:526 - the entity's name and "(dead)".
      return lootableBody(f) ? { title: corpseName(championName(f.entity, enemyDisplayName(f.mobileType))) } : null;   // AUDIT 68 S19-removed-foe-lootable; LOOT7: a champion's body by its name
    }
    if (key.startsWith('loot:') || key.startsWith('droppedLoot:')) {
      // .cs:534-548 - a pile of ONE is named by that one item; the
      // port lists the rest UNDER this title rather than stopping here.
      return { title: lootPileName(api.lootContents(key)) };
    }
    if (!modOn) return null;
    // .cs:304-312 - a LIVE entity is `Entity.Name`, and only when its
    // motor says it is not hostile. Keyed by INDEX, as this pool's
    // corpses are: a dungeon's foe list is never spliced.
    if (key.startsWith('mobileFoe:')) {
      const f = liveFoeFor(foes, key, 'mobileFoe');
      if (!f) return null;
      const t = mobileEntityName(liveEntityName(f, enemyDisplayName(f.mobileType)), { hostile: !!f.ai?.isHostile && !f.yielded });   // HOVER-PLAIN: a hostile foe is never named here, a champion, an elite or a revenant included - its name stands on its health bar alone; a kneeling revenant (still hostile in its motor) is done fighting, so it says so below
      return t ? { title: f.yielded ? `${t} - beaten` : t } : null;   // REVENANT-FATE (the 2026-10-02 audit): a kneeling revenant says so, as the street's does
    }
    if (key.startsWith('door:') || key.startsWith('act:')) {
      const o = actions.objects.get(key) ?? null;
      if (!o) return null;
      // .cs:641-650 - an action door says "Door", and its lock level
      // when it is locked. DaggerfallActionDoor.IsLocked is
      // currentLockValue > 0.
      if (o.kind === 'door') return actionDoorName((o.currentLockValue ?? 0) > 0, o.currentLockValue ?? 0);
      // .cs:400-471 - Direct/Direct6/MultiTrigger only, by model id.
      const t = actionName(o.triggerFlag, o.modelIdNum, { hideInteract: hide });
      return t ? { title: t } : null;
    }
    return null;
  }
  /**
   * AUDIT-WH M10: THE EXTENSION NAMERS RUN FIRST, and the mod's own
   * ladder last.
   *
   * That is the mod's documented order - `EnumerateCustomHoverText`
   * is the FIRST statement of the tooltip body (.cs:285) and the bands
   * below it are guarded on `IsNullOrEmpty(ret)`, so a registered namer
   * wins outright - and the port had it inverted: the dungeon's
   * own ladder ran ahead of the torches, the camps and whatever the
   * host stands.
   *
   * AUDIT-WH2 L4-F2: "every band" was too strong and is corrected
   * above. The `DefaultActivationDistance` block at .cs:397 opens on
   * the distance alone, with no `IsNullOrEmpty(ret)` beside it - it is
   * the one band that would run under a filled `ret`, and its own arms
   * then overwrite it. It does not change this ordering (the extension
   * namers are still first and still win every band that IS guarded);
   * it is simply not true of all of them, and systems/worldTooltips.js
   * already states it correctly.
   *
   * It is INERT TODAY, because the key sets are disjoint - nothing a
   * torch or a camp answers is a key `_dungeonHoverName` knows. That
   * is exactly why it is worth fixing rather than noting: the day a
   * host stands a family whose key this context also names, the
   * precedence decides it, and a precedence that only becomes
   * observable at the moment it goes wrong is the FONT1 two-faces
   * shape. The interior and the exterior arms already run their host
   * namers first; this makes the three agree.
   */
  const _namer = composeNamer([
    (key) => droppedTorches.hoverName?.(key) ?? null,   // HT1, through the mod's extension API
    (key) => camps.hoverName?.(key) ?? null,            // SURV3/HEARTH1, likewise
    (key, hit) => composeNamer(_hostNamers)(key, hit),  // ...and whatever the host stands
    _dungeonHoverName,                                  // ...then the mod's own ladder (.cs:285-296)
  ]);

  /** AUDIT PRE-MERGE 0928 M1: a foe another player runs - a party member's own, a room foe while another holds the seat
   *  (the pre-merge audit's D1) - is its runner's to replace or destroy: its runner's abyss had it, and its stream says
   *  what stands. The abyss's doors below neither read it nor touch it. */
  const runByAnother = (f) => isPuppetFoe(f);   // the frame's own puppet test (O6's isPuppetFoe): one expression, as isRoomFoe is
  /** OH-E: one enemy as There's a Hole in the Bottom of the Ocean reads it - its CURRENT type (a replacement is the
   *  new type the moment it is applied), the humanoid test's EntityType (EnemyClass: the 128..146 careers), its
   *  LoadID (the layout's blockData.Position + obj.Position; a spawn's the port's own counter) and QuestSpawn. */
  const abyssFoeView = (rec) => ({
    rec,
    get entity() { return rec.entity; },
    get dead() { return !!rec.dead; },
    get mobileType() { return rec.retypedTo ?? rec.mobileType; },
    get isClass() { const t = rec.retypedTo ?? rec.mobileType; return t >= 128 && t <= 146; },
    get loadID() { return rec.src?.loadID ?? 0; },
    get questSpawn() { return !!rec.questBehaviour || !!rec.src?.questSpawn; },   // AUDIT OH-F C3: set before OnEnemySpawn, as DFU's is
    demo: true,   // every enemy the port stands is SetupDemoEnemy's
    get abyssWasHumanoid() { return !!rec.abyssWasHumanoid; },
    get retypedTo() { return rec.retypedTo; },
  });
  const api = {
    // WARDEN-STRIKE (FB 2026-09-29g): the court's boss's spell door, for the OUTER host's enchant ctx - hosted, this
    // context mounts none (`enchantCtx: false`), so its own `bossSpell` never ran and a Cast When Strikes spell on the
    // Warden went nowhere in the real game. Outside a court, nobody: false.
    spellOnBoss: (record, target = null) => (opts.gateBoss ? spellOnStandIn(record, target) : false),   // AUDIT WB11 W1: by the stand-in it met
    // LOOT11 (the Loot arc): the finds a line of light may stand over - a searchable body (the room's on every client: its
    // list is the room's record) and a treasure pile, each its crown and its list read live (scenes/lootLines.js picks)
    lootFinds: () => [
      ...foes.filter((f) => lootableBody(f) && f.corpsePos && f.entity?.items?.length).map((f) => ({ root: lootCrown(f.corpsePos, f.corpseBatch?.size), items: f.entity.items })),
      ...lootPiles.filter((p) => p.items?.length).map((p) => ({ root: lootCrown(p.pos, p.batch?.size), items: p.items })),
      ...droppedLoot.lootFinds(),   // and what was put down here
    ],
    spellToOwner,   // STRIKE-SHARED: a strike spell of mine on a foe another player runs, to that player
    // AUDIT 19 / 1:1: SelectCurrentSong's dungeon arm seeds DFRandom with
    // the dungeon record header's Unknown2 XOR the region byte
    // (SongManager.cs:346-358). An earlier pass flagged this as
    // "unavailable" - it is not. mapsFile parses unknown2 onto the same
    // header this host already reads locationId from, and DFU casts it to
    // ushort, so the low 16 bits are the field. Verified over the real
    // archive: 4,232 dungeons, 3,769 distinct keys, near-uniform across
    // the 15-song list.
    /** The host's cumulative clock, for the music context's gameDays. LIVED1: the world's - the calendar the song
     *  picks by is the sky's. */
    get classicMinutes() { return worldMinutes(); },
    // PARTY-REST1: the dungeon twin of worldModes.js's own restState -
    // see that getter's doc comment for the whole of why (world.js owns
    // every party/online seam and cannot see into this closure's own
    // window stack any other way). Null while not resting and null for
    // a mirrored session, same law.
    restEnemiesNearby: () => _restDeps.enemiesNearby(),   // AUDIT PARTY-REST: the mirror's own foe question, this host's scan
    survivalEnvNow,   // AUDIT SURV-TIERS (the second pass): and the mirror's needs - world.js's ticker runs a mirrored night here with this host's reader
    get restState() {
      const w = activeOverlay;
      // PARTY-REST6: see worldModes.js's own restState getter for the bug this `state === 'resting'` guard
      // closes - `session` truthy alone does not mean the window is still actually ticking.
      if (!w?.isRestWindow || w.isPartyRestMirror || !w.session || w.state !== 'resting') return null;
      return { mode: w.mode, hoursRemaining: w.session.hoursRemaining, totalHours: w.session.totalHours };
    },
    /** AUDIT 21 (music lane, F3): IsPlayerInsideDungeonCastle, live off the
     *  block the player is standing in - the Castle playlist and
     *  doNotPlayInCastle both had it hardcoded false. */
    get inCastle() { return lastPlayerFeet ? castleBlockAt(lastPlayerFeet[0], lastPlayerFeet[2]) : false; },
    /** F183: the ambient this block takes - the host applies it. */
    get ambient() { return ambientAt(lastPlayerFeet); },
    musicSeed: dungeonKey(
      (dfLocation?.dungeon?.recordElement?.header?.unknown2 ?? 0) & 0xffff,
      dfLocation?.regionIndex ?? 0),
    drawList,
    get staticBatch() {   // PERF5: merged and uploaded once, on the first frame that asks
      if (!staticBuilt) { staticBuilt = true; const m = staticBuilder.finish(); staticBatch = m ? renderer.createMesh(m) : null; }
      return staticBatch;
    },
    dynamicDraws,
    actions,
    /** AUDIT FONT F3: THE HIDE DOORS, for the hosts' OVERLAY BRANCH.
     *  Both dungeon hosts (scenes/dungeon.js, scenes/worldModes.js)
     *  return out of the frame before `drawFoes` while a window is up,
     *  and drawFoes is the only place either of them reaches drawHud -
     *  so ui/hud.js's `if (hudDrawn) midScreenText.draw(); else
     *  midScreenText.hide();` never ran on those frames at all. Under
     *  the enhanced skin both surfaces are DOM and stay painted until
     *  told otherwise, so "You are too far away" stood over an open
     *  dungeon window until it closed, and on ?dungeon - which has no
     *  townTalk to draw a second time - the popup column stood too.
     *  The branch says it now, in one call that owns both. */
    hideHudText: () => hideHudTextSurfaces(hudText),
    hudSay: (t, delayInSeconds = undefined) => hudText.add(t, delayInSeconds),   // R1: the host's one-line channel (the F1-F4 mode line)   // AT2: AddHUDText's delay arg rides through, as townTalk.say's does - Ambient Text sets it per line (textDisplayTime)
    hudBox: (rows) => pushDungeonWindow(new ActionTextBox(rows)),   // AUDIT 63 F33: DaggerfallUI.MessageBox, for the enemy arm's success boxes
    randomText: (id) => textRsc?.randomTextById(id, Math.random) ?? '',   // AUDIT 63 F33: TextProvider.GetRandomText (:250-269) - the 8999 pool
    makeAreaHostile,   // AUDIT 63 F33: GameManager.MakeEnemiesHostile over this host's pool
    collider,
    texRemap,
    billboardBatches,
    flatAnims,   // FA1: the host ticks the flats it draws
    hitEffects,  // AUDIT 24 (wave 39): and the blood splashes it draws
    bloodMarks,  // BLOOD1a: the marks under them, for the world host’s own pass
    droppedTorches, torchBatches: () => droppedTorches.batches(), torchLights: () => droppedTorches.lights(),   // HT1: the dropped torches, for the hosts' draw pass and light channel
    camps, campBatches: () => camps.batches(), campLights: () => camps.lights(),   // SURV3: the campfires, on the same two passes; the pool itself for the hosts' env (byFire) and the probes
    cookFire: () => !!(_fpFeet && camps.fireNear(_fpFeet)),   // PROF9: a lit fire within reach of the feet - Cooking's fire underground (the world's, every tier)
    lights,
    iilLightFlats,   // IIL1
    /** X11: the Light effect's candle. The engine owns the candle (it
     *  is the player's, and every casting host builds one engine); the
     *  LIGHT has to be handed out because each host builds its own
     *  point-light array. BOTH hosts read it here (DISC19-B): the
     *  dungeon's casts are this context's engine's, and ?world's own
     *  engine is not updated underground - reading that one lit
     *  nothing, or a candle left at the street it was cast on. */
    candleLight: () => magic.candleLight(),
    /** X11 probe seams: the FOE cast door and the per-foe sinks. Both
     *  halves of a reflection live here - the spell going out and the
     *  caster's own vitals doors it comes back through. */
    castAtFoe: (spell, foe, caster = null) => magic.applySpellToFoe(spell, effectiveLevel(playerEntity), foe, caster),
    foeSinksFor: (foe, fromPlayer) => foeSinks(foe, fromPlayer),   // AUDIT 68 X4: the router hands the cast engine's provenance on
    flicker,
    waterQuads,
    /**
     * OH-D: THE ABYSS'S SEAMS - what There's a Hole in the Bottom of the
     * Ocean reads and writes of a DaggerfallDungeon (scenes/oceanHolesAbyss.js).
     * The summary is this context's location (DungeonSummary.LocationData:
     * the host's dungeonLoc is the same object); the flood is every block's
     * WaterLevel, its water plane and the automap's with it.
     */
    abyss: {
      location: () => ({ regionIndex: dfLocation.regionIndex ?? -1, locationIndex: dfLocation.locationIndex ?? -1 }),
      summaryName: () => dfLocation.name,
      summaryId: () => dfLocation.mapTableData?.mapId,
      /** RenameDungeon: the summary's LocationName and ID, the location's Name and MapTableData.MapId (a copy - the struct's). */
      rename(name, mapId) {
        dfLocation.name = name;
        dfLocation.mapTableData = { ...dfLocation.mapTableData, mapId };
      },
      /** dungeon.StartMarker.transform.position.y, or null with none. */
      startMarkerY: () => dungeon.startMarker?.y ?? null,
      /** The highest Renderer.bounds.max.y of the dungeon's DaggerfallMeshes (none: -Infinity). */
      maxMeshTopY: () => meshTopY,
      /** The DaggerfallDungeon's own transform.position.y: the dungeon frame's origin. */
      originY: () => 0,
      /** WaterizeDungeon's write: every block's WaterLevel, its DungeonWater plane moved or added, the automap's level. */
      setAllBlockWaterLevels(level) {
        for (const b of dungeon.blocks) b.layout.waterLevel = level;
        for (const blk of dfLocation.dungeon?.blocks ?? []) blk.waterLevel = level;   // the summary's copy - the clone's own records
        waterQuads.length = 0;
        if (level !== 10000) for (const b of dungeon.blocks) waterQuads.push({ x: b.originX, z: b.originZ, size: RDB_SIDE, y: -level * GLOBAL_SCALE });
        const amap = automapWaterLevel(level);
        for (const row of automapEntries) row.waterLevel = amap;
      },
      /** PlayerEnterExit.blockWaterLevel = level, for the block the player stands in. */
      setBlockWaterLevel(level) {
        const b = lastPlayerFeet ? blockAtXZ(lastPlayerFeet[0], lastPlayerFeet[2]) : null;
        _blockWaterOverride = b ? { block: b, level } : null;
      },
      /** OH-E: the dungeon's living enemies as ProcessAbyssEnemy reads them (GetComponentsInChildren<DaggerfallEntityBehaviour>:
       *  a dead one is a corpse by now, no entity) - AUDIT OH-F C6: in the hierarchy's order, which the quota's walk
       *  stops in: each block's "Fixed Enemies" node before its "Random Enemies" (RDBLayout.AddFixedEnemies, then
       *  AddRandomEnemies - GameObjectHelper.cs:632-633), marker order within each, the spawns (the dungeon's later
       *  children) after them all. The pool keeps its own order: saves and the room are keyed by its indices. */
      foes: () => enemyHierarchyOrder(foes, _layoutFoes).filter((f) => !f.dead && f.entity && !runByAnother(f)).map(abyssFoeView),   // AUDIT PRE-MERGE 0928 M1: the ones this player runs
      /** The same view of one record (GameManager.OnEnemySpawn hands the new enemy). */
      foeView: (rec) => abyssFoeView(rec),
      /** Object.Destroy(enemyObject): gone, with no body and no loot. */
      destroyFoe: (v) => { if (runByAnother(v.rec)) return; v.rec.abyssDestroyed = true; questPoolOps.removeFoe(v.rec); },   // AUDIT PRE-MERGE 0928 M1: never a live foe flagged gone that D1 refuses to remove
      /** ApplyEnemySettings(type, reaction, Unspecified, spawn distance, allied) + AlignToGround: the enemy IS the new
       *  type from here (MobileEnemy.ID); its body is rebuilt in place by settle(), once per slot, as its last type. */
      replaceFoe(v, type, { wasHumanoid = false } = {}) {
        if (runByAnother(v.rec)) return;   // AUDIT PRE-MERGE 0928 M1: its runner's abyss replaces it, and its stream says as what
        v.rec.retypedTo = type;
        v.rec.abyssWasHumanoid = !!v.rec.abyssWasHumanoid || wasHumanoid;   // OceanHoleEnemyReplacement.WasHumanoid
      },
      /** The replaced bodies stood - every record with a new type rebuilt where it is; resolves when they all have. */
      settle() {
        const jobs = [];
        for (let i = 0; i < foes.length; i++) {
          const f = foes[i];
          if (f.dead || f.retypedTo == null || f.retypedTo === f.mobileType) { if (f.retypedTo === f.mobileType) f.retypedTo = undefined; continue; }
          const type = f.retypedTo, was = !!f.abyssWasHumanoid;
          const feet = f.ai?.feet;
          jobs.push(retypeFoe(i, type, null, { anyFoe: true, at: feet ? { x: feet[0], y: feet[1] + 0.2, z: feet[2] } : null }).then((ok) => {
            const now = foes[i];
            if (ok && now) { now.abyssWasHumanoid = was; now.retypedTo = undefined; } else f.retypedTo = undefined;   // a body that would not stand keeps its own type
          }));
        }
        return Promise.all(jobs);
      },
      /** OH-E: the abyss's hold on PlayerEnterExit.UnderwaterFog - its waterFogColor and fogDensityMax overridden
       *  (`{color, densityMax}`), or null for the instance's own back (RestoreAbyssFog; the next UpdateFog is the dry). */
      setWaterFog(o) {
        if (o) {
          _abyssFogSaved ??= { color: _underwaterFog.waterFogColor, densityMax: _underwaterFog.fogDensityMax };
          _underwaterFog.waterFogColor = o.color;
          _underwaterFog.fogDensityMax = o.densityMax;
        } else if (_abyssFogSaved) {
          _underwaterFog.waterFogColor = _abyssFogSaved.color;
          _underwaterFog.fogDensityMax = _abyssFogSaved.densityMax;
          _abyssFogSaved = null;
        }
      },
      /** The water fog's own colour and ceiling (what the override replaces, read the first time it applies). */
      waterFog: () => _abyssFogSaved ?? { color: _underwaterFog.waterFogColor, densityMax: _underwaterFog.fogDensityMax },
      /** RemoveBorrowedQuestResources' foe half: every QuestResourceBehaviour enemy under the dungeon destroyed. */
      removeQuestFoes() { for (const f of foes) if (!f.dead && f.questBehaviour) questPoolOps.removeFoe(f); },
      /** RemoveDungeonLightFixtures: every Light destroyed (the blocks' light resources); every light-fixture flat's
       *  renderers off (its batch out of the draw, its animation stopped) and its AudioSources stopped (the torches'
       *  Burning loops). */
      removeLightFixtures(isFixture) {
        lights.length = 0;
        for (let i = billboardBatches.length - 1; i >= 0; i--) {
          const b = billboardBatches[i];
          if (!b || !isFixture(b.archive, b.record)) continue;
          billboardBatches.splice(i, 1);
          flatAnims.remove(b);
          renderer.destroyBatch(b);
        }
        for (const t of torches) { t.handle?.stop(); t.handle = null; }
        torches.length = 0;
      },
    },
    /** WATER-D1: the host names the climate ground archive whose record 0
     *  is the water tile; drawFoes draws the quads with it. */
    setWaterArchive: (archive) => { _waterArchive = archive; },
    startMarker: dungeon.startMarker,
    enterMarker: dungeon.enterMarker,
    blockCount: dungeon.blocks.length,
    /** A1: the 5 Hz reveal probes (CheckForNewlyDiscoveredMeshes'
     *  cadence, Automap.cs:172/:1289). Hosts call this every gameplay
     *  frame with the live eye + view direction; the interval gate
     *  lives here, and the eye is cached for the window's slice. */
    automapTick(dt, eye, fwd) {
      _automapEye = eye;
      // SPAWNED-DUNGEONS-TTL: "fully cleared" - every foe dead, every loot pile empty - on its own slow
      // throttle, piggybacked here because every host already calls this each gameplay frame; a new
      // per-frame call site would be one scenes/dungeon.js and scenes/worldModes.js both have to
      // remember. It sits AHEAD of the scan's early return below so it still runs on the frames the
      // automap scan itself skips. Empty lists count as cleared trivially - there is nothing to clear.
      if (!_clearedSent && opts.onDungeonCleared) {
        _clearedCheckT += dt;
        if (_clearedCheckT >= CLEARED_CHECK_INTERVAL_S) {
          _clearedCheckT = 0;
          if (foes.every((f) => f.dead) && lootPiles.every((p) => p.items.length === 0)) {
            _clearedSent = true;
            opts.onDungeonCleared();
          }
        }
      }
      automapScanT += dt;
      if (automapScanT < SCAN_INTERVAL_S) return;
      automapScanT = (automapScanT - SCAN_INTERVAL_S) % SCAN_INTERVAL_S;   // AUDIT-AMAP F12: keep the phase, no catch-up burst
      automapRevealTick(automapRec, {
        eye, fwd, collider, model: automapModel,
        // The three-ray scan's door blocker: an action door is its own
        // collider bucket, keyed by the action object (actionSystem
        // addDoor). THIS is what stops a closed door revealing the
        // hall behind it - see automap.js's scan. AUDIT-AMAP F3: a
        // SPECIAL door (DaggerfallActionDoorSpecial) is a plain model
        // to the automap copy - RDBLayout filters by description
        // (:751-765), not by action - so it reveals like any wall.
        isDoorBucket: (k) => { const o = actions.objects.get(k); return o?.kind === 'door' && !o.special; },
        // AUDIT-AMAP H7: a MOVED action model (a raised platform, a
        // swung special door) is where DFU's true-vs-copy test fails
        // outright - the copy holds it at rest - so a nearest hit on one
        // reveals nothing, instead of resolving to whichever at-rest box
        // happens to hold the hit point
        isMovedBucket: (k) => { const o = actions.objects.get(k); return !!o && o.state != null && o.state !== 'start' && (o.kind !== 'door' || !!o.special); },
      });
      // the entrance beacon sits on the START marker (Automap.cs:1447);
      // the LOS runs to the player CAPSULE's centre (:1216), not the eye
      const sm = dungeon.startMarker;
      const ms = opts.motorState?.() ?? null;
      automapEntranceTick(automapRec, sm ? [sm.x, sm.y, sm.z] : null, capsuleCentreFromEye(eye, ms?.eyeLevel, ms?.capsule), collider);
      automapTrailTick(automapRec, eye, ms?.eyeLevel);   // EM3-3D: where the player has stood, for the held map's solid sheet
    },
    automapRecord: () => automapRec,   // probe surface + the window's live view
    /** I3: the Escape window, same one-slot idiom. GATED ON THE DOOR,
     *  not on the art (U51): the CLASSIC window would close itself on
     *  first draw with no OPTN00I0 loaded, so an art-less classic boot
     *  still has no pause menu (stated, not silent - preloadPauseArt
     *  logs its own failure), but the ENHANCED screen reads no game
     *  data at all and opens either way. ui/pauseDoor.js owns which. */
    // PX26 (Mac: "the north option should be the new journal we
    // developed" / "the skill ui opens on the lefthand side when it
    // should be center"): ONE FIX FOR BOTH. The dial's north was the
    // F5 overlay - the last pre-PX surface, and the one that lays its
    // three columns against the left edge. The pause window's Stats
    // page IS that sheet, off the same sheetModel, and is centred by
    // construction. This host's own pause flow, landed on it.
    // LV2 FIX (2026-09-19, Mac: "when you close the levelup screen
    // without adding stat points you cant open it again"): THE DIAL'S
    // STATS ARM ASKS THE DOOR TOO. LV2's own records claim "every route
    // to the sheet - the key, the dial's Stats arm, the pause page - is
    // already this door", and that sentence was written without
    // checking two of the three. The KEY goes through
    // `createCharSheetWindow` and gets the Ascension; this arm and the
    // pause page went straight to the menu's Stats tab, which reads
    // `sheetModel` and has never heard of `readyToLevelUp`. So a player
    // whose level-up window was closed by anything (a pause, a map, a
    // peer's window) and who then reached for their sheet the way this
    // skin invites - the dial - got the ordinary sheet and no way back
    // to the level they were owed.
    //
    // `levelOwed` is ui/levelNotice.js's, which is the same live read
    // the HUD's own standing reminder uses: one answer to "is a level
    // waiting", not a second copy of the flag.
    openSheetPage() { if (levelOwed(playerEntity)) this.toggleCharSheet(); else this.togglePause({ at: 'stats' }); },
    // MAC-L1: ONE SIGNATURE ACROSS THE FOUR HOSTS. This was the odd one
    // out - `togglePause(setPlayerPos = null, opts = {})` against the
    // other three's `togglePause(opts = {})` - and `routeAction` spelt
    // it this context's way, so Escape threw on the other three. The
    // position applier rides INSIDE the options now, read by the one
    // reader (ui/pauseDoor.js's pauseOpts), which also means a caller
    // that hands over a hard `null` gets an empty door rather than a
    // TypeError.
    // ...and the parameter is `doorOpts`, NOT `opts`. MAC-L1 found a
    // second fault sitting inside the first: this method's parameter was
    // called `opts` and SHADOWED `buildDungeonContext`'s own `opts` bag
    // (:214) - the one carrying `questBridge` and `relock`. So the three
    // arms below that read `opts.questBridge` and `opts.relock` have
    // been reading THIS METHOD'S ARGUMENT for as long as it has had one:
    // the dungeon pause screen's Quests tab answered an empty list, and
    // the resume gesture's relock was a no-op. Both looked wired and
    // neither was. Exactly the shadow AUDIT-CHATR F1 found in
    // `ui/chatPanel.js` a day before, in a second file - which is the
    // whole argument for turning `no-shadow` on.
    togglePause(doorOpts = {}) {
      if (activeOverlay || !pauseDoorReady()) return;
      const { at, setPlayerPos } = pauseOpts(doorOpts);
      openPauseFlow((w) => { activeOverlay = w; }, {
        at,   // PX26: the page the door was pressed for
        ...this.pauseHooks(setPlayerPos),   // F5-QUESTS: the bag is its own arm now - F5's page is handed the same one
      });
    },
    /** F5-QUESTS (2026-09-26): THIS HOST'S PAUSE BAG, one arm for both doors that mount the pause window -
     *  togglePause above and the F5 page (makeCharSheet's `pause`, ui/charSheetDoor.js). `setPlayerPos` is the
     *  host's position applier, the Load arm's (routeKey hands it to both doors). */
    pauseHooks(setPlayerPos = null) {
      const ctx = this;   // the sibling save verbs on this same context
      return {
        // PX25: THE SHEET'S OWN DOORS, handed to the page that IS the
        // sheet. Each host passes the arms it already has; a host
        // without one passes nothing and the button never draws.
        // AUDIT 39 (#38): THIS context's own builders. These two used to
        // optional-chain off `api` for the world host's makers, which
        // this context has never exported - so both doors DREW (the
        // filter asks only that a function was handed over) and both
        // resumed the game and opened nothing.
        // AUDIT 27h A4: each answers whether it opened one (a door that opened nothing resumes, ui/pauseDoor.js), and
        // the Chronicle is withheld with no bridge to read - makeJournalWindow's null - rather than drawn to do nothing.
        openPack: () => { const w = openInventory(null); if (w) activeOverlay = w; return !!w; },
        openSpellbook: () => { const w = makeSpellbookWindow(); if (w) activeOverlay = w; return !!w; },
        openCharSheet: () => { const w = api.makeCharSheet(); if (w) activeOverlay = w; },   // MAC-C: the pack's other window key crosses over rather than doing nothing - the same door the sheet's own Items button takes back the other way
        openChronicle: opts.questBridge ? () => { const w = makeJournalWindow('notebook'); if (w) activeOverlay = w; return !!w; } : undefined,
        // ARENA3: the Arena window, once a banner is worn - the world host's maker (scenes/arenaGate.js), in this slot
        openArena: opts.makeArenaWindow ? () => { const w = opts.makeArenaWindow('team'); if (w) activeOverlay = w; return !!w; } : undefined,
        arenaJoined: () => !!opts.arenaJoined?.(),
        // PX17c: the dungeon HAS the bridge (opts.questBridge feeds
        // the F5 journal at :3449 and the notebook at :867) - the PX3
        // flag was too conservative, so it is paid with the same walk
        // the world's pause runs, off THIS host's own bridge.
        questMessages: () => opts.questBridge?.machine.getAllQuestLogMessages() ?? [],
        // MAC-K2: the walk is the BRIDGE's now - see questBridge.js.
        questLog: () => opts.questBridge?.questLog() ?? { active: [], finished: [] },
        repairQuests: () => opts.questBridge?.repair?.() ?? null,   // QREPAIR
        journalClean: () => opts.questBridge?.journalClean ?? null,   // JOURNAL-CLEAN: the Quests tab's remove / clear archive / hide / unhide (scenes/questBridge.js journalClean)
        // GUIDE2: the Quests tab's WHERE, the outer host's questions (no map here, so no way there)
        canFindPlace: opts.questCanFindPlace,
        currentLocationName: opts.questLocationName,
        quickSave: () => ctx.quickSave?.(),
        // MAC1 J: the pointer comes back INSIDE the resume gesture
        // (ui/pauseDoor.js:143-167). THIS CONTEXT OWNS NO CANVAS OF ITS
        // OWN (:4701), so the relock arrives from whichever dungeon host
        // mounted it - the way hudMessageSink is threaded (:1349) - and
        // both of them hand it in: dungeon.js's opts bag and
        // worldModes' (the world-hosted crawl, which is where the
        // classic start into Privateer's Hold lives, and which is the
        // pause door ui/input.js:847 reaches underground).
        relock: () => opts.relock?.(),
        // the LOAD arm needs the host's position applier, exactly as
        // routeKey's own QuickLoad case passes it
        quickLoad: () => ctx.quickLoad?.(setPlayerPos),
        // ONLINE-LOAD1: the world host's pause hooks (world.js) pass this
        // as `loadingPrevented: () => !!online` so the Load pane shows
        // WHY rather than silently no-opping; this host now reads the
        // same signal through opts.dungeonOnline (worldModes.js), which
        // the standalone ?dungeon probe never sets, so it stays open there.
        loadingPrevented: () => !!opts.dungeonOnline?.(),
        timers: (o) => opts.timers?.(o) ?? null,   // TIMERS1: the world host's source, through worldModes
        savingPrevented: () => isGateArena(dfLocation) || isArenaFloor(dfLocation),   // ARENA2: nor on the arena's sand   // WB3b: the pause's Save says why, in the court
        // SAV4: the slot window's seams over the same two verbs.
        playerName: () => playerEntity.name, playerId: () => playerEntity.characterId ?? null,
        saveAs: (saveName) => ctx.quickSave?.(saveName),
        loadKey: (key) => ctx.quickLoad?.(setPlayerPos, key),
        // ROAD-C C1: the slot window is PUSHED over the pause window
        // (DaggerfallPauseOptionsWindow.cs:302/:308) so Cancel pops
        // back onto it - pushDungeonWindow is this host's PushWindow.
        pushWindow: (w) => pushDungeonWindow(w),
        exitToMenu: exitToTitleMenu,
        textLines: (id) => rscLines(id),
        // (The PX3 note that used to close this literal - questMessages
        // pends on the dungeon quest mount, AUDIT 25 P0 - was paid by
        // PX17c at the top of it: the Quests tab reads THIS host's own
        // opts.questBridge machine, not a refusal.)
      };
    },
    /** A1: the M window, in the one overlay slot (toggleCharSheet's
     *  idiom - an occupied slot refuses, the window closes itself). */
    toggleAutomap() {
      if (activeOverlay) return;
      if (isGateArena(dfLocation)) { hudText.add(COURT_TEXT.noMap); return; }
      if (isArenaFloor(dfLocation)) { hudText.add(ARENA_TEXT.refuse.map); return; }   // ARENA2: a made level with nothing to chart   // WB3b: an empty level, and no place to chart
      // EM3: THE SKIN FORK, at the one place this host builds the map.
      // The classic arm answers null without its native art and the
      // slot stays empty, exactly as before; the enhanced arm reads no
      // ARENA2 raster at all, so it is always ready.
      if (!automapDoorReady()) return;
      mwViewFirstPerson();   // MW-MAP1: into the head before the window's first tick asks the arm
      activeOverlay = createAutomapWindow({
        holder: sheetHolderOf(() => weaponRig),   // MW-MAP1: the Morrowind hands lane on the dungeon's M
        record: () => automapRec,
        drawList, dynamicDraws, texRemap,
        player: () => ({ feet: lastPlayerFeet, eye: _automapEye, yaw: _motorYaw }),
        startMarker: dungeon.startMarker,
        // Math.round: (n * 51.2) / 51.2 drifts off the integer for
        // n = 3, 6, 12... and a fractional grid coordinate writes
        // NOTHING into the micro-map's typed array (a silent no-op).
        blocks: dungeon.blocks.map((b) => ({ x: Math.round(b.originX / RDB_SIDE), z: Math.round(b.originZ / RDB_SIDE), name: b.name })),
        arrowMesh: automapArrow,
        arrowBounds: automapArrowBounds,   // c2/S7: the picker's proxy for the player arrow
        dungeonName: dfLocation?.name ?? 'Dungeon',
        indexSize: automapModel.length,
        model: automapModel,   // c2/S1: the window's partition + explored-percentage source
        // IsPlayerInsideBuilding (:587-596): this host is never inside
        // one, so the reset arm's default render mode is TRANSPARENT.
        // The interior arm that flips it is c2/S9's.
        insideBuilding: false,
        // EM3: what the enhanced sheet needs beyond the classic bag -
        // where the player is standing (the tab context mapTabs derives
        // from) and what the strip calls this place.
        where: () => ({ insideDungeon: true }),
        title: dfLocation?.name ?? 'Dungeon',
        party: opts.party ?? null,   // DISC23-A: the party members standing in this dungeon, at their feet in its frame
        portals: automapPortals,   // TP-SEEN: every teleporter in the level, shown once its spot has been seen
        // ROAD-C c2/S8: the Ctrl+Shift debug-teleport click
        // (TryTeleportPlayerToDungeonSegmentAtScreenPosition, :858-870).
        // It goes through the SAME `onTeleport` door the Teleport action
        // uses, which each host has already installed with its own motor
        // warp - so the window never learns what a motor is.
        debugTeleport: (pos) => {
          actions.onTeleport?.({ pos, yawDeg: 0 });
          // AUDIT-AMAP H4: DFU moves the player AND both beacons in the
          // same call (Automap.cs:869-875); the window reads the player
          // through lastPlayerFeet/_automapEye, which only non-overlay
          // frames write - so the warp writes them here
          lastPlayerFeet = [pos[0], pos[1], pos[2]];
          _automapEye = [pos[0], pos[1] + (opts.motorState?.()?.eyeLevel ?? EYE_HEIGHT), pos[2]];
        },
      });
    },
    /** ROAD-C c2/S8: AutoMapConsoleCommands (Automap.cs:2596-2688).
     *  ROAD-E E3 put them on the real ConsoleCommandsDatabase, where C#
     *  registers them (systems/automap.js's registrar, above), so this
     *  is now the standalone host's probe DOOR onto that database and
     *  not a second copy of the three answers: an unknown name gets
     *  NoSuchCommandException's own "Command X not found." message, and
     *  both gates - IsPlayerInside and a null Automap.instance - are the
     *  database's. */
    automapCommand(name) { return executeConsoleCommand(name, []); },
    enemies,
    foes,
    corpseAt: (f) => corpseAt(f),   // AUDIT 32 H3: where a body lies (Hunting's bodies)
    /** AUDIT 32 H8: a body's loot key (`corpse:<i>`, the ladder's own) while it may be searched - its loot target's test -
     *  or null. */
    corpseKeyOf: (f) => { const i = foes.indexOf(f); return i >= 0 && lootableBody(f) && f.entity?.items?.length ? `corpse:${i}` : null; },
    isPuppetFoe: (f) => isPuppetFoe(f),   // AUDIT PRE-MERGE 0928 O6: the frame's own puppet test, for a host that would move a foe (Come Sail Away's hull)
    spawnQuestFoe,   // B1: CreateFoe's dungeon arm stands foes through the one build chain
    fateFor, chooseFate, companionFx,   // REVENANT-FATE: a kneeling revenant's choice; COMPANION-PORTAL: the place's portals
    removeLooseFoe,   // CREW-COMPANIONS: a companion out of the room with no corpse
    arenaPit: _undercroftHall?.pit ?? null,   // ARENA-FIX 4: the training pit's centre (scenes/worldModes.js arenaPitStage)
    arenaPitAxis: _undercroftHall?.pitAxis ?? null,   // ...and its passage's way
    arenaHall: _undercroftHall?.hall ?? null,   // ARENA5: the Hall of Champions' place - its plaque wall hangs about it (scenes/worldModes.js standArenaWall)
    spawnLooseFoe,   // SD1: the same chain with no quest behaviour bound - the enchant ctx's spawner
    questSpawnSpots: () => dungeonQuestSpawnSpots(dungeon.blocks),   // FIELD BUGS 29h (BOUNTY-LAIR): where DFU stands a quest's foe here
    replaceFoe: replaceFoeInPool,   // AUDIT 58 (review): the hosted route's enchant mount routes the Wabbajack here by pool membership
    drawFoes,
    playerAttackInput,
    spellArmed: () => magic.spellArmed(),   // A8: PlayerEffectManager.HasReadySpell, for the host's activate gate
    weaponRig: () => weaponRig,   // AUDIT WORLD C1: the rig the player's hands are in underground, for the pose's arm
    // PH1: the death screen's own release, for a respawn that stays INSIDE
    // this dungeon (Privateer's Hold) rather than exiting it - the exact
    // same clear the quickLoad path already does for a DeathScreen
    // (restoreSaved, above), just callable on its own for a respawn that
    // never calls quickLoad at all.
    clearDeathOverlay: () => { if (activeOverlay instanceof DeathScreen) { activeOverlay.restoreView(); activeOverlay = null; } },   // AUDIT CONTRIB A4: a rise in place hands the fall's pitch back, as the interior's own clear does
    castEngine: magic,   // CAST-USE: the engine whose click fires a ready here - the hosted enchant ctx readies an item's spell on it
    readiedSpell: () => magic.readied(),   // ROAD-Ar: PlayerEffectManager.ReadySpell - the gate needs its TargetType for the ByTouch exception (PlayerActivate.cs:250-258)
    allyInReach: (eye, dir, reach) => magic.allyInReach(eye, dir, reach),   // AUDIT ALLY-CAST A5: the plaque asks THIS engine, with its own collider
    toggleSheath: weaponRig.toggleSheath,
    // QS2: the diamond's three presses. This ctx is routeKey's, in BOTH hosts
    // that mount it - the standalone `?dungeon` page and the world's dungeon
    // mode - so the doors land on the ladder in each the moment they exist.
    quickUse: (n) => quickUse(n),
    quickSwap: () => quickSwap(),
    quickOffHand: () => quickOffHand(),
    quickSpell: () => quickSpell(),   // QS6: the spell slot's press
    tickQuickHold,                    // QS6: ...and the hold machine, for whichever host owns the frame
    switchHand: weaponRig.switchHand, readyWeapon: weaponRig.readyWeapon,   // a12: SwitchHand (H) - the same one door as the sheathe toggle; MAC-O1: and the ReadyWeapon KEY's own door (WeaponManager.Update:229-269), beside the panel's raw ToggleSheath above
    // S24 probe seam: drive a real spell record onto the player
    // through the host's own absorption path (the same function the
    // foe-cast and missile-impact sites call).
    applySpellToPlayer: magic.applySpellToPlayer,
    spellVisual: magic.spellVisual,   // SPELLFX1: a peer's cast, drawn in this dungeon's own engine
    peerCandles: (list, dt) => magic.peerCandles(list, dt),   // PEERLIGHT2: the others' Light spells, in this dungeon's own engine
    /** SPELLFX1: a peer's arrow, drawn: this pool's own shaft, flagged visual - it stops on a wall or a body and lands nothing. */
    visualArrow: (from, dir) => { missiles.push({ arrow: true, visual: true, flatArchive: null, weapon: null, fromPlayer: false, shooterFoe: null, aimFoe: null, pos: [...from], dir: [...dir], age: 0, batch: null, draw: null }); return true; },
    // V3 probe surface: the ONE foe damage door. Soul Trap's kill
    // intercept lives inside it, so a probe that killed a foe any
    // other way would be testing a path the game never takes.
    damageFoe,
    // C10: the rig's clickAttack carries the sheathed gate the inline
    // version missed - a touch tap while sheathed no longer swings
    // (WeaponManager: no attack processing while sheathed).
    playerClickAttack: weaponRig.clickAttack,
    /** Verbatim MovePlayerToMarker + FixStanding: the start marker
     *  + up * (height 1.8 * 0.6), then the instant floor snap. ONE
     *  source - both hosts spawn through this (the standalone's raw
     *  marker spawn put the EYE at the marker, feet under the floor:
     *  Mac spawned wedged in the under-geometry shaft). */
    startSpawn({ preferEnterMarker = true } = {}) {
      // DE1 (Mac: "entering a dungeon places you at the end of the
      // dungeon instead of the entrance") - THERE ARE TWO DFU MEMBERS
      // HERE AND THEY DO NOT AGREE, and this function was only one of
      // them:
      //
      //   StartDungeonInterior(location, preferEnterMarker = true)
      //     (:982-987) - starting INSIDE a dungeon with no exterior:
      //     a new game, a load, a respawn, a quest teleport. The
      //     ENTER marker wins and StartMarker is the fallback.
      //
      //   TransitionDungeonInterior(doorOwner, door, ...) (:923-934)
      //     - WALKING IN through the entrance, which is how a player
      //     actually gets into a dungeon. It uses dungeon.StartMarker
      //     UNCONDITIONALLY. It does not consult the enter marker at
      //     all, and where the marker is missing it ABORTS the
      //     transition rather than falling back.
      //
      // The port had one `enterMarker ?? startMarker` serving both, so
      // the walk-in landed on the enter marker - a different point,
      // and in a large starting block a long way from the door. The
      // sentence that stood here explained the switch to the enter
      // marker as a fix for a wedging bug in Privateer's Hold, and it
      // was: for the STANDALONE host, which is the StartDungeonInterior
      // case and was right to prefer it. Applying that host's answer to
      // the other member is what put the player across the dungeon.
      //
      // preferEnterMarker=false is therefore not "prefer the other
      // one" - it is the transition's law, start marker or nothing.
      const m = preferEnterMarker ? (this.enterMarker ?? this.startMarker) : this.startMarker;
      if (!m) return null;
      return floorLanding(collider, [m.x, m.y + 1.08, m.z]);
    },
    /** Verbatim TransitionDungeonInterior's orientation half
     *  (:936-952): the player faces the NORMAL of the nearest dungeon
     *  exit door, which points into the dungeon - so you come through
     *  the door looking at the room rather than keeping whatever
     *  bearing you had outside. StartDungeonInterior faces plain north
     *  instead (SetFacing(Vector3.forward), :1011-1013), because a
     *  load or a teleport did not come through a door.
     *
     *  Answers a yaw in the port's convention (0 = +z = north), or
     *  null when there is no door to read - the caller keeps its
     *  bearing rather than snapping to an invented one. */
    entryFacingYaw(feet, { preferEnterMarker = true } = {}) {
      if (preferEnterMarker) return 0;   // SetFacing(Vector3.forward)
      const near = feet ? closestDoorTo(feet, exitDoors) : null;
      if (!near) return null;
      return Math.atan2(near.normal[0], near.normal[2]);
    },
    get playerSlowFalling() { return hasActiveEffect(playerEntity, 'slowfall'); },   // S8: hosts feed their motor (P14: the -105 * dt constant-speed law lives in the motor)
    toggleDebugHud() { debugHud = !debugHud; },
    reportMotor(grounded, velY, yaw) { _grounded = grounded; _motorYaw = yaw; _motorState = `g:${grounded ? 1 : 0} vy:${velY.toFixed(1)} yaw:${yaw.toFixed(2)}`; },
    // U7: the rest key. Pre-rest gates (the classic order): enemies
    // nearby -> TEXT.RSC 354; swimming or airborne -> 355 "You
    // cannot rest now."; else the rest window opens. S40 struck the
    // sentence that followed, which said a second press "routes
    // through the overlay as 'back' (ends a running rest)": that route
    // was never real. ROAD-B B5 built the real one. With a window up,
    // overlayAction turns any single character into `char:<k>`, so
    // KeyR arrives as 'char:r', and ui/restWindow.js:307-309 runs A8's
    // normalizeCode inverse to turn it back into 'KeyR' - DFU's
    // toggleClosedBinding - so a second Rest press ends a running rest
    // or closes the selection page (:302-315), which is
    // DaggerfallRestWindow.Update :187-196 whole.
    /** CSA-J (the audit): a bed's click - Roleplay Realism's BedActivation, DaggerfallUI's gate less its offer rung. */
    restFromBed() { _restFromBed = true; try { this.toggleRest(); } finally { _restFromBed = false; } },
    toggleRest() {
      if (activeOverlay) return;
      if (isGateArena(dfLocation)) { hudText.add(COURT_TEXT.noRest); return; }
      if (isArenaFloor(dfLocation)) { hudText.add(ARENA_TEXT.refuse.rest); return; }   // ARENA2: no rest on the sand (the duel's law)   // WB3b: an enemy is always near - the boss
      // S40: the gate itself moved to systems/restSession.js. It was
      // written out here because this was the only host that could
      // rest; three more can now, and DFU raises it from ONE
      // message handler (DaggerfallUI.cs:651-687) with no scene test
      // at all. What stays here is what only this host knows.
      //
      // Audit 2026-08-16f: AreEnemiesNearby(true) is the RESTING
      // variant (an unaware foe blocks only within 12 units), same as
      // the hourly break check. The first cut used the strict variant
      // and refused rest with any unaware foe in the whole 1024-unit
      // spawn band.
      //
      // StartRestGroundedCheck moved to player/motor.js beside the
      // constant it derives from - three more hosts ask it now, and
      // they were passing the raw `grounded` flag, which refuses a
      // near-ground levitator DFU lets sleep (review 16f found the
      // drift risk; the S40 review found the divergence).
      const rb = racialRestBlock(playerEntity, classicMinutesRef.value);   // V2b: the vampire's rest gate
      const d = restDecision({
        enemiesNearby: _restDeps.enemiesNearby(),
        swimming: _activity.swimming,
        grounded: startRestGroundedCheck(_grounded, lastPlayerFeet, collider),
        // ROAD-B B5: the gate's third arm has a producer now. ROAD
        // review-p: the PRODUCER, not a poll - :667-669 fetches it
        // inside the third `else`, after the other two arms have
        // returned.
        preventedMessage: getPreventedRestMessage,
        // AUDIT 58: DaggerfallUI.cs:680's `else if (!GiveOffer())` -
        // a pending `give pc ... notify` offer takes this press and
        // the rest window stays shut (ui/pendingOffer.js).
        giveOffer,
        ...(_restFromBed ? { giveOffer: null } : null),
        racialOverrideBlocks: !!rb,
      });
      if (d.kind !== 'rest') {
        // E-slice: the ROUTED leg closes - DFU raises the alert on the
        // enemies arm (DaggerfallUI.cs:655, not the rest window's
        // :655), which is what arms this host's rest-encounter roll.
        if (d.kind === 'enemies') setEnemyAlert(playerEntity, true, classicMinutesRef.value);
        // AUDIT 58: the offer took the press - the item was handed
        // over inside GiveOffer() and there is nothing to say.
        if (d.kind === 'offer') return;
        if (d.kind === 'blocked') {
          const lines2 = rscLines(rb.textId);   // V2b: the unfed vampire's own box
          if (lines2) activeOverlay = new ActionTextBox(lines2);
          return;
        }
        const lines = d.message ? [d.message] : rscLines(d.textId);
        if (lines) activeOverlay = new ActionTextBox(lines);
        return;
      }
      // STRANGER-REST1: shared with world.js's own outdoor toggleRest and worldModes.js's interior - see
      // world.js's strangerRestGate doc comment (30m in a dungeon, its own radius). Checked FIRST, same order.
      const strangerRefusal = opts.strangerRestGate?.();
      if (strangerRefusal) { activeOverlay = new ActionTextBox([strangerRefusal]); return; }
      // PARTY-REST2: shared with world.js's own outdoor toggleRest and worldModes.js's interior - see world.js's
      // partyRestGate doc comment.
      const partyRefusal = opts.partyRestGate?.();
      if (partyRefusal) { activeOverlay = new ActionTextBox([partyRefusal]); return; }
      // PARTY-REST28: shared with world.js's own outdoor toggleRest and worldModes.js's interior - see
      // world.js's markPartyRestSpent doc comment for the bug this closes (a rest granted in a dungeon used
      // to leave the granting player's own ready flag stuck true forever, since nothing here ever reset it).
      opts.markPartyRestSpent?.();
      activeOverlay = createRestWindow(_restDeps);
    },
    // P11: the current block's water surface (world y) - the swim
    // toggle rule reads it (PlayerEnterExit blockWaterLevel).
    waterSurfaceYAt,
    blockWaterLevelAt,   // CSA-C: PlayerEnterExit.blockWaterLevel raw, for Come Sail Away's dungeon water plane (null off every block)
    // ROAD-B (b3): UnderwaterFog.UpdateFog, hosted. Hosts call it with
    // the camera Y, the player's feet and the fog they were about to
    // set, and apply what comes back.
    underwaterFogSettings,
    // P11: the motor-mode effect consumers (Levitate 14,255; the S8
    // waterWalking flag lands its swimmer).
    playerLevitating: () => hasActiveEffect(playerEntity, 'levitate') || staffFly(),   // STAFF1: /fly
    playerWaterWalking: () => isEntityWaterWalking(playerEntity),   // CSA-I: IsWaterWalking, either effect
    drainPlayerFatigue: (n) => drainFatigue(n),   // CSA-J (the audit): PlayerEntity.DecreaseFatigue underground - the dungeon's own collapse
    playerParalyzed: () => entityIsParalyzed(playerEntity),   // S19 gates + the S22 FreeAction fold

    // P11: per-frame activity feed - the splash on the swim edge, the
    // jump fatigue/tally (PlayerEntity: 11 x multiplier + Jumping
    // tally once per jump), and the state the per-minute fatigue
    // drain reads.
    reportActivity({ running = false, runningTally = false, swimming = false, climbing = false, standing = false, jumped = false, parkoured = null, movingLessThanHalfSpeed = true, grip = null, fell = 0, odometer = null } = {}) {
      // AUDIT 58: PlayLargeSplash is PlayOneShot(SplashLargeSound, 0,
      // FootstepVolumeScale) - PlayerFootsteps.cs:323-326.
      if (swimming && !_activity.swimming && !immersiveFootsteps.playLargeSplash()) audio.playOneShot(SOUND.SplashLarge, FOOTSTEP_VOLUME);   // PlayLargeSplash on entry; IF1: the mod's Water_Landing when it owns the stride
      _activity.running = running; _activity.runningTally = runningTally;   // AUDIT 64 F7: the tally's gate is PlayerEntity.cs:311 (IsRunning && !IsRiding, no standing test), the band's is :408
      _activity.swimming = swimming;
      _activity.climbing = climbing;   // AUDIT 26 F083: ClimbingFatigueLoss's live flag
      _activity.standing = standing;   // FATIGUE-IDLE: standing still on the ground pays no minute's band (worldTick.js); a host that says nothing is moving
      _activity.movingLessThanHalfSpeed = movingLessThanHalfSpeed;   // P13: IsMovingLessThanHalfSpeed (the motor computes it)
      // AUDIT 23 (C6): the jump drain+tally moved into tickPlayerMinutes
      // (PlayerEntity.cs:425-430 is the entity update) - the edge rides
      // the activity so every host shares the one law.
      _activity.jumped = jumped;
      _activity.parkoured = parkoured;   // CLIMB1: a mantle or a vault's edge, billed beside the jump's
      _activity.odometer = odometer;   // MOVE-REAL: the motor's live odometer - the movement skills past 100 count it
      _activity.grip = grip;   // CLIMB2: the enhanced climb's grip, for this context's HUD
      // P14 fall landing (CheckFallingDamage + PlayerHealth verbatim):
      // damage = trunc(5 * (distance - 5)) past the threshold with the
      // fall-damage sound; a 2.5..5 drop is the hard-fall alert only.
      // No water exemption HERE - DFU's is outdoor-tile-only
      // (StreamingWorld.PlayerTileMapIndex == 0), so a dungeon-water
      // landing that grounds bills like ground, bug-for-bug.
      // AUDIT 26 F206: the flash is NOT pending - PlayerHealth
      // .RemoveHealth opens with ShowPlayerDamage.Flash (:36-38,
      // :49-58) and ApplyPlayerFallDamage goes through it, so every
      // damaging fall flashes. This file already flashes for arrows
      // and melee, and shared.applyFallLanding - which the other
      // THREE hosts use - flashes for this exact reason; only a
      // dungeon fall was silent, behind a stale pending comment.
      if (fell > FALL_DAMAGE_THRESHOLD) {
        const _fallDmg = Math.trunc(FALL_HP_PER_METRE * (fell - FALL_DAMAGE_THRESHOLD));
        hurtPlayer(_fallDmg);
        flashPlayerDamage(_fallDmg);   // BA1: RemoveHealth carries the amount
        if (!immersiveFootsteps.applyPlayerFallDamage()) audio.playOneShot(SOUND.FallDamage, FOOTSTEP_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:307-311; IF1: the mod's Hard_Landing_2 when it owns the stride
      } else if (fell > FALL_DAMAGE_THRESHOLD / 2) {
        if (!immersiveFootsteps.hardFallAlert()) audio.playOneShot(SOUND.FallHard, FOOTSTEP_VOLUME);   // AUDIT 58: PlayerFootsteps.cs:315-319; IF1: the mod's Hard_Landing_1 when it owns the stride
      }
    },
    reportMouse(dx, dy, locked) { _mouseState = `dx:${dx} dy:${dy} lock:${locked ? 'Y' : 'N'}`; },
    reportInput(keys, pitch) { _inputState = `keys:${keys} pitch:${pitch.toFixed(2)}`; },
    quickSave(saveName = QUICK_SAVE_NAME, { quiet = false, sink = null } = {}) {   // REALM P0.5: a quiet checkpoint takes no shot and says only a failure; P1.3: a realm character's goes to the service
      // WB3b: a save made in the court would load into a place that no longer stands (the court is the day's alone)
      if (isGateArena(dfLocation)) { if (!quiet) hudText.add(COURT_TEXT.noSave); return false; }
      if (isArenaFloor(dfLocation)) { if (!quiet) hudText.add(ARENA_TEXT.refuse.save); return false; }   // ARENA2: a made level no save re-enters
      const snap = snapshotPlayer(playerEntity, {
        position: lastPlayerFeet, classicMinutes: classicMinutesRef.value,
        readiedSpellIndex: magic.readiedIndex(),
        // AUDIT 25 B4: DFU saves quest + conversation WHEREVER the
        // player stands (SaveLoadManager.cs:1113-1121); this context
        // saved neither, so a save made in a dungeon loaded back an
        // empty quest machine and rumor mill. The world host's bridge
        // and talk trio ride in as opts (null in the standalone
        // ?dungeon scene, which mounts no quest machine - the composer
        // writes nulls there, same as every pre-B4 save).
        ...composeSessionState({ questBridge: opts.questBridge, talk: opts.talkSave, spawnLedger: opts.spawnLedger?.() ?? null }),   // TTL1: the spawned-dungeon clocks, from the world host that owns them (null in the standalone ?dungeon scene)
        // AUDIT 26 F222/F223/F101: the pose. The HOST owns yaw/pitch/
        // crouch (opts.pose.read); this context owns the weapon, so
        // weaponDrawn lands here whichever host mounted it.
        // AUDIT 63 F25: ...and the HAND beside it. SerializablePlayer
        // .cs:175-176 writes weaponDrawn and usingLeftHand as one pair
        // and :420-421 restores them as one pair; this host owns the
        // weapon, so both halves land here.
        pose: { ...(opts.pose?.read?.() ?? {}), ...weaponPoseOf(playerWeapon) },
        locationKey: _locationKey,
        // MAC6 #1 (Mac, 2026-09-12: "it doesnt place you where you last
        // saved"): WHERE the dungeon stands - DFU's worldPosX/worldPosZ
        // beside insideDungeon (SerializablePlayer.cs:215-217), which is
        // what RespawnPlayer's dungeon arm teleports to before it
        // re-enters (PlayerEnterExit.cs:534-537). The world host's boot
        // load had no way home for a dungeon save without it.
        dungeon: dungeonHome(),
        // AUDIT 28 W4: SerializablePlayer.cs:224 - the layout the
        // position was saved in, so a load at the OTHER size can warp to
        // the start marker (:462-472) instead of standing in blocks that
        // no longer exist. FT1: the size BUILT, not the raw setting - the
        // departure and its reason are on the export.
        smallerDungeonsState: smallerDungeonsStamp(dfLocation),
        world: collectWorld(),
        // AUDIT HCC H3: DFU's per-mod save data rides a dungeon save too - Horse Cart and Cargo's record (the horse,
        // its name, the parked wagon, the entrance it waits at) from the world host that runs the mod
        // WA1: DFU's per-mod slot - HCC's record through its own seam (AUDIT HCC H3), every mod after it through the
        // host's registry (systems/modSaveData.js); null only when the host hands neither
        modData: opts.horseCartSave || opts.modSaveRecords ? { ...(opts.horseCartSave ? { 'horse-cart-and-cargo': opts.horseCartSave() } : {}), ...(opts.modSaveRecords?.() ?? {}) } : null,
      });
      const into = sink ?? realmSaveSink();   // REALM P1.3: a realm character's save is the service's checkpoint, never a local slot
      if (into) { const said = into(snap); if (!quiet) sayRealmSave(said, (t) => hudText.add(t)); return true; }   // AUDIT REALM2 C2: the realm's answer, not a hope
      const r = saveSlot(playerEntity.name, saveName, snap);
      // SS1: arm the deferred shot; the HOST's frame loop delivers it
      // (dungeon.js's tail) - this context owns no canvas of its own.
      if (r.ok && !quiet) requestScreenshot(r.key);
      if (r.ok && !quiet) hudText.add('Game saved.');
      else if (!r.ok) hudText.add('Save failed (storage full or disabled).');   // never silent - the write can fail on real browsers
      return r.ok;
    },
    quickLoad(setPlayerPos, key = null) {
      // ONLINE-LOAD1: guarded here, not only the pane's loadingPrevented - F9/F11 reach this directly.
      if (opts.dungeonOnline?.()) { hudText.add('Loading is disabled during online play.'); return; }
      const snap = key != null ? loadSlot(key) : quickLoadSlot(playerEntity.name, undefined, playerEntity.characterId ?? null);   // CHARID1
      if (!snap) { hudText.add('No saved game.'); return; }
      // CASTLE1 (DragynDance, 2026-09-22: "can't even load the game
      // anymore to escape, it pops this up: (different dungeon - world
      // state left as built)"): A SAVE FROM ANOTHER PLACE IS THE WORLD
      // HOST'S LOAD. F12 and the pause menu's Load reach THIS door
      // underground (ui/input.js routeKey, the pause door's loadKey),
      // and it restored the character, said the line below and left
      // the player standing where they were - which in a castle whose
      // start marker ate every click was no way out at all. DFU's
      // LoadGame is RespawnPlayer first (PlayerEnterExit.cs:453-459,
      // :534-537): the standing scene is destroyed and the save's own
      // place re-entered before the position lands. The world host's
      // load is that member (world.js worldQuickLoad: force-exit,
      // teleport to the save's pixel, StartDungeonInterior); handed the
      // slot's key it goes there. A microtask on, not inline: this door
      // is reached from inside the context's own overlay dispatch, and a
      // context must not tear itself down from there (worldModes' F-A5
      // deferral is the same law). The standalone ?dungeon scene has no
      // world to hand to and keeps the line (recorded: cross-location
      // travel-on-load pends there alone).
      // AUDIT OH-F B2: and a load the drowned dungeon stands in (the abyss shares its template's key) - DFU REBUILDS on
      // every load (PlayerEnterExit.cs:453-457); a patch in place cannot undo a flooding, a rename, a destroyed light
      if (opts.worldLoad && snap.locationKey != null && (snap.locationKey !== _locationKey || opts.loadRebuilds?.(snap))) {
        const k = key;
        Promise.resolve().then(() => opts.worldLoad(k));
        return;
      }
      opts.modStartLoad?.();   // CSA-J (the audit): SaveLoadManager.OnStartLoad ahead of the save's player (:1378)
      const extras = restorePlayer(playerEntity, snap, spellsByIndex);
      if (!extras) { hudText.add('Save version mismatch.'); return; }
      // AUDIT DISC28 (27h's DIAL-LOAD read, recorded there): SaveLoadManager's OnStartLoad reaches the HOST's hands too -
      // CameraRecoiler's own (ResetRecoil: the incoming character inherits no reel). The world's load resets the world's
      // reel and the standalone host wraps this door to reset its own, but a world-hosted dungeon's own load (F12, the
      // pause's Load underground) reached neither, and a hit's sway ran on over the loaded character.
      opts.onStartLoad?.();
      opts.modSaveLoad?.(extras.modData ?? null);   // WA1: the registered mods' records (or their NewSaveData), as a world load restores them
      opts.horseCartLoad?.(extras.modData?.['horse-cart-and-cargo'] ?? null);   // AUDIT HCC H3: OnStartLoad, then RestoreSaveData - the same-dungeon load is a load too
      this.restoreSaved(extras, setPlayerPos);
      opts.modLoaded?.();   // CSA-J (the audit): SaveLoadManager.OnLoad once the load has landed (:1554)
    },
    /** MAC6 #1: the load's second half - everything after restorePlayer
     *  - on its own, so the WORLD host's boot load can re-enter this
     *  dungeon and hand it the envelope it already restored (DFU's
     *  RespawnPlayer-then-RestorePosition order, PlayerEnterExit
     *  .cs:534-537 / SerializablePlayer.cs:441-454). `session: false`
     *  leaves the quest and conversation machines alone: that host
     *  restored them before it teleported, and a second restore would
     *  mount the quest resources twice. */
    restoreSaved(extras, setPlayerPos, { session = true, announce = session } = {}) {
      // DIAL-LOAD: a load whose door handed no applier lands by the HOST's own law (opts.placePlayer, given at build).
      // The context's own doors - the HUD dial's Skills arm, the F5 page and the pack's crossovers - open the pause
      // window with none, so a same-dungeon Load through them restored the character where they stood, latch and all.
      // A door's own applier still wins (the ?load boot's, which records the position before the motor exists).
      setPlayerPos ??= opts.placePlayer ?? null;
      // AUDIT-39r: CleanupUntrackedObjects' MISSILE half. Its trigger
      // is SaveLoadManager_OnStartLoad - a LOAD, in every host - and
      // DFU reaches a dungeon's flights the other way round: the load
      // runs RespawnPlayer, whose first act is Destroy(dungeon)
      // (PlayerEnterExit.cs:453-457, :622-630), and the missiles are
      // parented to that dungeon. This context is REUSED across its own
      // quickload, so nothing tears the flights down - a missile in the
      // air when F12 landed kept flying at the restored player. The
      // world host's teleport already sweeps its own (world.js).
      magic.clearMissiles();
      clearLocalMissiles();   // AUDIT 68 S19-restore-missiles-survive: and this context's own flights, for the same reason
      // BLOOD AUDIT 4: AND THE BLOOD, for the same reason. The world host
      // clears its pool on every teleport and the interior on every
      // door; this context is reused across its own quickload, so the
      // abandoned timeline's marks, its chunks in flight, its ceilings'
      // drips and the pool spreading under a corpse that is about to
      // stand back up all stayed on the floor of the restored one.
      hitEffects.clear();
      resetVitalsDetector();   // BLOOD AUDIT 5: the loaded health is not a blow (VitalsChangeDetector.cs:139-158)
      classicMinutesRef.value = extras.classicMinutes ?? classicMinutesRef.value;
      magic.setReadiedByIndex(extras.readiedSpellIndex ?? null, spellsByIndex);
      // B4: quest after entity, conversation after quest (the C#'s own
      // order, SaveLoadManager.cs:1433-1449). A restored quest
      // envelope must latch the world host's _questStarted so
      // initAtGameStart never re-runs over the restored machine.
      // AUDIT 63 F28: the orphaned-quest-item sweep rides the ONE
      // composer, so this host runs it too (SaveLoadManager.cs:1518).
      if (session && restoreSessionState(extras, { questBridge: opts.questBridge, talk: opts.talkSave, entity: playerEntity, spawnLedger: opts.spawnLedger?.() ?? null })) opts.onQuestRestored?.();
      if (session) opts.layoutPinsLoaded?.(extras);   // WD3: the save's towns in their layouts (world.js applyLayoutPins) - a world load does its own
      const settled = extras.world && extras.locationKey === _locationKey ? applyWorld(extras.world) : null;   // AUDIT OH-F B1: the rebuilds, handed back
      if (!settled && extras.world) hudText.add('(different dungeon - world state left as built)');   // cross-location travel-on-load pends in the STANDALONE scene alone - a world-hosted dungeon hands such a save up before this (quickLoad, CASTLE1)
      // A1: restorePlayer replaced the automap store, so the live
      // record reference is stale. Re-fetch on the LOAD arm
      // (initFromLoadingSave, Automap.cs:2492-2493): a bare
      // fetch-or-create - no visitedThisRun reset, no stamp, no
      // prune. DFU's load is a dictionary replacement; stamping and
      // pruning belong to save time, and a prune here could evict a
      // record the save itself carried (A1 review).
      automapRec = enterDungeonAutomap(automapKey, classicMinutesRef.value, { fromLoad: true });
      // AUDIT-AMAP F4: the bind is the RESTORE (RestoreStateAutomap
      // Dungeon, :2492-2493): it applies the layout guard to the loaded
      // record and points Automap.instance (the console verbs) at it
      bindAutomapLayout(automapRec, automapModel);
      signalAutomapReset();   // AUDIT-AMAP H3: InitWhenInInteriorOrDungeon raises it on the LOAD arm too (:2490, :2496, from :2548)
      // FALL-KEPT (FIELD BUGS 2026-09-30): the save's fall (the host's pose read) lands with the saved position, and
      // only with it - the start-marker warp below places the player again, carrying none.
      if (extras.position && extras.locationKey === _locationKey && setPlayerPos) setPlayerPos(extras.position, extras.pose?.fall);
      // AUDIT 28 W4 (SerializablePlayer.cs:462-472): saved in the OTHER
      // layout, the position may sit in blocks this build does not have -
      // warp to the start marker and say so. The law (story dungeons
      // never, old envelopes never, agreeing layouts never) is
      // needsStartWarp's; FT1 moved it there beside the stamp it reads.
      if (extras.locationKey === _locationKey && setPlayerPos && needsStartWarp(extras.smallerDungeonsState, dfLocation)) {
        // F-B1 (self-audit 2): the first cut set the RAW marker position;
        // every other spawn in this port goes through the entry law -
        // floorLanding over m.y + 1.08 - and a raw marker y can stand
        // the player in the floor. startSpawn({ preferEnterMarker:
        // false }) IS the start marker under that law, which is also
        // DFU's member here (:470 names StartMarker explicitly).
        const p = this.startSpawn({ preferEnterMarker: false });
        if (p) {
          setPlayerPos(p);
          hudText.add('Dungeon size setting changed - moved to dungeon start.');
        }
      }
      // F222/F101 + AUDIT 63 F25: Sheathed and UsingRightHand as ONE
      // pair (:420-421); the host takes the yaw/pitch/crouch half
      // through its own seam. HARD2c: the two lines used to sit six
      // apart here, which is how F25 lost one of them.
      if (extras.pose) {
        applyWeaponPose(playerWeapon, extras.pose);
        opts.pose?.apply?.(extras.pose);
      }
      surfacePlayer();
      // A loaded game supersedes whatever pre-game overlay is up.
      // AUDIT 19 F7 (critical): only DeathScreen was cleared, so the
      // menu's LOAD GAME restored the character and then left the
      // CHARGEN WIZARD sitting on top of it - and playing through the
      // wizard runs finishChargen, overwriting the character that was
      // just loaded. The context mounts chargen at build time
      // (dungeonContext.js:891) and dungeon.js calls quickLoad after,
      // so the wizard is ALWAYS up on this path.
      // NOTE: activeOverlay is cleared but chargenWindow is NOT nulled.
      // Later sites test `activeOverlay === chargenWindow`, and with
      // both null that comparison is TRUE - which would fire
      // finishChargen on the very character the load just restored.
      // AUDIT F2-I2: quickLoad drops the wizard by clearing the slot and
      // deliberately keeps chargenWindow, so the flow can never reach
      // its own exit arm again - a constellation still playing would
      // latch the module's active index and its texture for ever. The
      // host releases it, since the host is what tore the overlay down.
      if (activeOverlay === chargenWindow) stopConstellationAnim();
      if (activeOverlay instanceof DeathScreen || activeOverlay === chargenWindow) activeOverlay = null;
      if (announce) hudText.add('Game loaded.');   // AUDIT WORLD B10: the boot's arm (session false) says it once, from world.js
      slotLoaded(playerEntity.characterId ?? null);   // AUDIT ONLINE2 F3: the pack is the save's - the spoils' crash door asks again
      return settled ?? Promise.resolve();   // AUDIT OH-F B1: settled when the saved enemy set stands whole
    },
    /** WORLD1 (Mac: "True persistence"): this dungeon's SHARED world for the room's memory - the LAYOUT's foes
     *  alone (the run the markers placed, `_layoutFoes` long - AUDIT WORLD B2: the foes past it are this player's own,
     *  an encounter's, a summon's or a quest's, and a quest foe whose quest ended loses its mark), the piles and
     *  the actions; nothing of the player's own (the teleported-in latch and the dropped loot stay home - B3).
     *  Keyed by this dungeon and stamped by this context, so another dungeon's memory - or its own, back from a
     *  reconnect's welcome (B1) - is refused. */
    sharedWorld() {
      const w = collectWorld();
      w.foes = w.foes.slice(0, _layoutFoes);
      delete w.teleportedIntoDungeon;
      delete w.droppedLoot;
      delete w.droppedTorches;   // HT1
      // WORLD4: the memory carries EMPTIED, not contents - the piles' blanket list goes, and in its place the
      // containers the room has actually opened, each with what is left in it. A pile nobody has touched stays
      // every client's own roll, as it was before anyone arrived.
      // AUDIT WORLD4 D4/B3: and neither does a FOE's item list, which `corpse:<i>` reads - it rode the foes half of
      // the same envelope for every body, opened or not, so the law was false for half the container vocabulary and
      // an opened corpse was carried twice. The foes half keeps the foe (WORLD2's roster is the room's); its loot is
      // the room's only once somebody has been into it, like a pile's.
      delete w.piles;
      for (const f of w.foes) delete f.items;
      // AUDIT OH-F B1: the drowned dungeon's destroy rides the SAVE, not the room - the relay's door (net/wire.js
      // validSharedFoe) has no field for it, and one there is a relay deploy. Every client destroys the same flame
      // foes on its own build (PrepareAbyssDungeon), and the hour's respawn refuses a destroyed foe on each.
      for (const f of w.foes) delete f.abyssDestroyed;
      w.loot = lootRecords([..._lootSeen]);
      for (const f of w.foes) delete f.noBody;   // REVENANT-FATE: the room's door has no field for it either
      // AUDIT WORLD34 C2: the memory's action records are the SHARED half, as an act's are (AUDIT WORLD3 B1) - the
      // save record carried the picker's per-player latch, so one host's failed pick silenced every joiner's attempt
      w.actions = (w.actions ?? []).map(sharedRecord);
      w.camps = campMemory();   // SURV3: every camp standing, with its owner - the save's own rows never ride (they are this player's frame)
      return { locationKey: _locationKey, stamp: _sharedStamp, world: w };
    },
    /** WORLD1: the room's memory applied - the layout's foes patched in place, each its own species (B4), and every
     *  foe past the layout's run left standing (applyWorld without its cut), the piles and the actions as the room
     *  remembers them; once per context (B7), never its own (B1). */
    restoreSharedWorld(shared) {
      if (!shared || shared.locationKey !== _locationKey || !shared.world || typeof shared.world !== 'object') return false;
      if (shared.stamp === _sharedStamp || _sharedApplied) return false;
      // AUDIT WORLD4 D3: the memory stopped SENDING `piles` and went on APPLYING them - so a snapshot written before
      // WORLD4 (the relay keeps one for WORLD_TTL_MS) still blanket-replaced a joiner's own rolls, the very thing the
      // slice removed, and any host that sent the field could do it deliberately. What this client will not say, it
      // will not hear.
      // AUDIT WORLD34 C2: and projected on the way in, as applyRemote projects an act's (AUDIT WORLD3 A2) - the relay
      // serves the stored bytes back unparsed for WORLD_TTL_MS, so one bad tween in a memory bricked a door for
      // every joiner for thirty days
      const acts = Array.isArray(shared.world.actions) ? shared.world.actions.map(validActionRecord).filter(Boolean) : [];
      // AUDIT ONCRASH1 A3/B4b: and the FOES are projected too. The line above has done this for the actions since
      // AUDIT WORLD34 C2, for the reason written there - the relay serves a memory back unparsed for WORLD_TTL_MS -
      // and the foes went through raw into `patchFoe`, which writes feet, yaw and health with no check. A record
      // outside the law is DROPPED, as a bad action record is.
      // CORPSE-GOLD: dropped as a HOLE at its own index (applyWorld skips it). An action record is keyed by its name;
      // a foe record's key IS its index (`corpse:<i>` and the stream's `i` read it too), and `filter(Boolean)` closed
      // the gap - every record after a refused one landed on the next foe: deaths, feet and species on the wrong
      // bodies, and each body the room had emptied left with its own fresh roll.
      const sfoes = Array.isArray(shared.world.foes) ? shared.world.foes.slice(0, _layoutFoes).map(validSharedFoe) : [];
      // AUDIT ONCRASH1 A2: THE LATCH IS THE LAST THING, not the first.
      //
      // `_sharedApplied = true` used to be set BEFORE this apply. A throw half way through then left the latch up,
      // so `restoreSharedWorld` refused every later publish for the life of this context - and `applyLoot` never
      // ran, so every container the room had already emptied was still full for this player, who looted it into
      // their save. Before ONCRASH1 that throw was a crash and the player at least knew; contained, it was a silent
      // duplication. The interior twin already had the order right (worldModes.js applyInteriorShared); this arm
      // was the odd one out. A failed restore leaves the latch DOWN, and the host's next publish retries it.
      applyWorld({ ...shared.world, piles: undefined, actions: acts, foes: sfoes }, { truncate: false, wire: true });
      applyLoot(shared.world.loot);   // WORLD4: the containers the room has opened, through the live door
      applyCampMemory(shared.world.camps);   // SURV3: the room's fires, through validCampRecord; mine are refused by applyOwner (the save carries them)
      _sharedApplied = true;
      return true;
    },
    locationKey: () => _locationKey,
    /** WB4: a blow the Burning Court's boss landed on the player (scenes/gateCourt.js - the verdict is this machine's):
     *  through the one door any foe's blow takes (resolveFoeMelee) with its three signs - the hit's sound, the flash,
     *  the cry - and fire's burning in the hit's place, unflashed (DFU's spell damage does not flash, ui/damageFlash.js).
     *  WB8b: his aspect's frost, lightning and venom as his fire - unflashed, each in its element's own cast
     *  (systems/enemySpells.js SPELL_CAST_SOUND, by id). WB13d: and shaken as his physical blows are (his heaviest -
     *  the Hellfire, the Nova, the Meteor, the Spokes - landed with no camera's answer at all). */
    strikePlayer(dmg, { fire = false, el = fire ? 'fire' : null } = {}) {
      if (!(dmg > 0)) return;
      const cast = GATE_STRIKE_CAST[el];
      if (cast != null) audio.playOneShotId?.(cast, PLAYER_HIT_VOLUME);
      else audio.playOneShot(el === 'fire' ? SOUND.Burning : hitSoundFor(null), PLAYER_HIT_VOLUME);
      hurtPlayer(dmg);
      if (!el) flashPlayerDamage(dmg);
      else shakePlayerDamage(dmg);
      playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
    },
    // WORLD2: one simulation per room - the stream out and in, the hit in, the seat
    foesFrame,
    applyFoes,
    applyHit,
    setAuthority,
    // QUEST-PARTY phase 3c: the room's own lane - my shared quest's foes out, a party member's in, a blow on mine in,
    // the owners swept, the handover
    ownFrame, applyOwnFrame, applyOwnHit, pruneOwnOwners, clearOwnPuppets, ownHandOverFrame, dropOwnHanded,
    isAuthority: () => _authority,
    // WORLD3: the live world as events - another's doors in
    // WORLD4: and the room's loot - what a container the room has opened holds now
    // AUDIT 68 S19-dead-api-exports: retypeFoe, peerCandidates, lootSeen (and inSpecialArea, automapDebugTeleportMode,
    // enhancedNav) left this object - nothing outside the context read them
    applyActions,
    /** AUDIT WORLD3 A3: the CURRENT shared record of each named object, for an act the wire refused. The seam is a
     *  DELTA and nothing re-sends it, so a dropped frame is a permanent disagreement about where a door stands; the
     *  host holds the refused KEYS and re-reads them here, never re-sending the stale record the refusal carried. */
    actionRecords(keys) {
      if (!Array.isArray(keys) || !keys.length) return null;
      const want = new Set(keys);
      const a = actions.collectSaveData().filter((r) => want.has(r.key)).map(sharedRecord);
      const l = lootRecords(keys);   // WORLD4: a container's current list, re-read like a door's (AUDIT WORLD4 A2: lootRecords is the one home of what may be said, key and cap both)
      return a.length || l.length ? { k: _locationKey, ...(a.length ? { a } : {}), ...(l.length ? { l } : {}) } : null;
    },
    // U3: ONE overlay seam (chargen, level-up, char sheet) - hosts
    // pause gameplay while any overlay is active.
    // ROAD-B B1 asked the DEPTH here, for the same reason worldModes'
    // overlayHeld did - this is read from the hosts' event handlers,
    // between frames, and a window that closed itself since the last
    // reconcile still has one suspended under it that is about to be
    // painted. ROAD-tail: that is what the stack's own pause LATCH
    // answers, so the question is asked once, in `dungeonPaused`.
    get uiOverlayActive() { return dungeonPaused(); },
    /** AUDIT DW-F: the swimmer UnderwaterPresentationEffects.UpdateSwimSfx reads in a dungeon (it has no IsPlayerInside
     *  test) - the capsule the last frame carried, PlayerEnterExit.IsPlayerSwimming, the water walker; null before one. */
    swimmer() {
      return lastPlayerFeet ? { feet: lastPlayerFeet, height: lastPlayerHeight, swimming: !!_activity.swimming, waterWalking: isEntityWaterWalking(playerEntity) } : null;
    },
    hudLines() { return hudText.lines.map((l) => l.text); },   // CASTLE1 probe surface (tools/castleProbe.mjs reads the load's lines)
    /** STATUS-LIVE: ...AND THE OTHER HALF OF THAT QUESTION, which the
     *  two hosts that DRAW this context's slot need and could not ask.
     *  A window the game is NOT stopped for (the status readout,
     *  ui/statusBox.js) still has to be ticked and painted, and both
     *  hosts' overlay arm is `if (uiOverlayActive) { ...; return; }` -
     *  so below that return there was no way to know a slot was
     *  occupied at all. Published as its own word rather than left to
     *  the hosts to derive from `overlayWindow()`, because ROAD-tail's
     *  law is that a host asks the owning context for its pause and
     *  never reaches past it for the slot - and a probe surface is not
     *  a pause gate (test/roadb_host_pause.test.js sweeps for exactly
     *  that, and caught this line written the wrong way round). */
    get unpausedOverlay() { return !!activeOverlay && !dungeonPaused(); },
    /** AUDIT 64 F35 (review round): the HUD's own question, asked of
     *  the same stack - a window is up AND something on it cut the
     *  previousWindow chain (DaggerfallPopupWindow.cs:76-84). Published
     *  because worldModes' dungeon arm mounts this context and draws
     *  the HUD for it. */
    get hudCovered() { return dungeonPaused() && dungeonWindows.hudCovered(activeOverlay); },
    // DC1: PlayerDeath.Update's camera sink, read by the scene host's
    // one per-frame eye write; zero whenever no death runs.
    get deathDrop() { return activeOverlay instanceof DeathScreen ? activeOverlay.drop : 0; },
    deathTilt(cam) { if (activeOverlay instanceof DeathScreen) activeOverlay.tiltView(cam); },   // DEATH3: the enhanced fall's pitch
    deathUp: () => activeOverlay instanceof DeathScreen,   // AUDIT WORLD B6: the death screen stands in THIS slot underground - world.js's own gate never saw it
    overlayWindow: () => activeOverlay,   // U26 probe surface
    /** U43-ii: the way IN to that slot. The context has held an
     *  overlay since U3 and exposed only a getter, so the quest
     *  machine's popup - which the outer host raises, not this one -
     *  had nowhere to go and world.js warned to the console instead.
     *  The classic start runs _TUTOR__ and _BRISIEN inside
     *  Privateer's Hold, so a new game's opening text was among the
     *  things that never reached a screen.
     *
     *  It used to REFUSE rather than clobber - a window already up
     *  owned the slot, and the caller read the false to keep its own
     *  reference clean. ROAD-B B1 made it PushWindow
     *  (UserInterfaceManager.cs:79-91), which is what DFU does with a
     *  quest popup and what the refusal was standing in for: the box
     *  goes ON TOP, the window under it is suspended rather than lost,
     *  and the drain in tickOverlay hands the slot back when the box
     *  closes. The refusal cost the dungeon the quest text outright -
     *  a _TUTOR__ message that arrived while the automap or a rest
     *  window was up simply never appeared. */
    showOverlay(win) { return pushDungeonWindow(win); },
    /** ENH-NOTICE3 (AUDIT F1): the host has adopted this context - its
     *  stack is the live top window from here on, and the door may
     *  offer it boxes. */
    goLive() { _live = true; },
    dropped: () => droppedLoot._piles,
    /** AUDIT 18 F5: the overlay's own clock. DFU runs
     *  DaggerfallRestWindow.Update every frame the window is topmost
     *  (DaggerfallRestWindow.cs:185-229), and TickRest reads
     *  Time.realtimeSinceStartup, so PauseWhileOpen's timeScale = 0
     *  does not stop it. The port had the tick inside drawFoes, which
     *  the hosts SKIP whenever an overlay is up - so U7's rest never
     *  advanced an hour in either host that mounts a dungeon: the
     *  window sat on "Hours passed: 0" until Escape.
     *  The done-drain is not optional here: RestWindow._end() sets
     *  done on the death path and on a missing endLines, and until
     *  now only overlayInput/overlayClick cleared activeOverlay, so a
     *  rest that ended itself would latch a dead window on screen. */
    /** B1: GameManager.OnEncounter's rest-abort route - a CreateFoe
     *  wave placed while the rest window is up wakes the player
     *  (AbortRestForEnemySpawn; the session answers enemies-nearby on
     *  its next tick). */
    abortRestForEnemySpawn() {
      if (activeOverlay?.isRestWindow) activeOverlay.abortForEnemySpawn?.();
    },
    tickOverlay(dt) {
      // ROAD-B B1: the stack catches up with the slot FIRST. A window
      // that closed itself between frames (the ~15 `activeOverlay =
      // null` close paths) is a PopWindow, and the window it uncovers
      // is the one this frame ticks and draws - a rest resumes under a
      // dismissed quest box with no blank frame in between.
      dungeonWindows.reconcile(activeOverlay);
      if (!activeOverlay) return;
      // D1: the death sequence's clock - and, since the rest lanes,
      // the rest window's too. RestWindow.tick IS its Update, so the
      // explicit `if (isRestWindow) tickRest(dt)` that used to sit
      // here would now drive it TWICE and rest at double speed. The
      // generic call is the point: a host cannot forget a branch it
      // does not have to write. Two lanes found this independently.
      activeOverlay.tick?.(dt);
      // FS-slice (wave D): the race screen's back-out used to be
      // POLLED here off `chargenFlow.cancelled`. The window owns it
      // now and fires onCancel from the very input that sets the flag
      // (chargenSession.js:514), which is the shape the other hosts
      // have always had - and the enhanced skin, whose DOM view never
      // reaches this host's input seam at all, could never have been
      // cancelled by a poll on a flow the host was not driving.
      if (activeOverlay?.done) {   // S40: optional - a window may clear the slot from inside its own tick
        // FS-slice: the window already ran onDone - finishChargenHere
        // is ITS callback now, not this seam's. Calling it here too
        // applied the character twice.
        surfacePlayer();
        activeOverlay = null;
      }
      // ...and that drain is PopWindow too, reconciled in the same
      // frame so the uncovered window is what gets painted (ROAD-B B1).
      dungeonWindows.reconcile(activeOverlay);
    },
    chargenFlow: () => chargenFlow,   // AUDIT 17i probe surface
    /** U14: the POINTER half of the overlay seam. This host routed
     *  every click to requestPointerLock and nothing else, so chargen
     *  here was keyboard-only while the exterior hosts had been
     *  clickable since U8b. Takes NATIVE (320x200) coords like
     *  townTalk's seam does, and reports whether it consumed the
     *  click so the caller can withhold the pointer lock. */
    overlayClick(vx, vy, right = false, middle = false) {
      // U26: a native window exposes `click`, the keyed ones
      // `clickNative`. Both route here. I4: the right-button flag
      // rides along for the controls grid's remove gesture, G5's middle
      // flag for the drop-icon panel's third handler (:2104-2113).
      if (!activeOverlay?.clickNative && !activeOverlay?.click) return false;
      if (activeOverlay.clickNative) activeOverlay.clickNative(vx, vy);
      else activeOverlay.click(vx, vy, right, middle);
      // S40: optional. RestWindow grew a `click` and clears this slot
      // from inside it, so this seam reaches a null now - and it did
      // not before, which is why the unguarded read stood.
      if (activeOverlay?.done) {
        surfacePlayer();
        activeOverlay = null;
      }
      // ROAD-B B1: that drain is PopWindow - reconcile now, so the
      // window it uncovers is already in the slot for the next event
      // and not only from the next frame's tickOverlay.
      dungeonWindows.reconcile(activeOverlay);
      return true;
    },
    /** The wheel seam (U-scroll): scroll never closes a window, so no
     *  done check.
     *  AUDIT 65 UI-5: the NATIVE POINT rides the notch, the way it
     *  rides overlayHover below - BaseScreenComponent.Update's scroll
     *  block (:725-736) is guarded by `mouseOverComponent`, which :577-594
     *  recomputes from the live mouse, so a window may not route by the
     *  last hover it was given. The (-1,-1) default is the hosts' own
     *  pointer-leave sentinel: a caller with no point routes nothing. */
    overlayWheel(dir, vx = -1, vy = -1) { activeOverlay?.wheel?.(dir, vx, vy); },
    /**
     * ROAD-C c2/S4: THE POINTER SEAM, beside the click/hover/wheel
     * triple rather than folded into them. DFU's automap windows are
     * driven by press-HOLD (OnMouseDown raises a flag, Update() polls
     * it every frame) and by DRAGS on the render panel, neither of
     * which a click-only seam can carry.
     *
     * THE DOMINANT DEFECT CLASS HERE is a correct law whose caller
     * does not deliver it: a host that routes `down` but not `up`
     * latches a drag that spins the map forever, and nothing errors.
     * So the contract is all three phases or none, and the source
     * pins in test/roadc_automap_chrome.test.js COUNT the routes in
     * every host rather than trusting four edits.
     *
     * Hovering and dragging never close a window, so there is no
     * `done` drain here - but a window that ends itself from a
     * pointer up would still be reconciled by the next tickOverlay.
     */
    /** ROAD-C c2/S8: `mods` is the KEYBOARD STATE AT THE PRESS, and it
     *  exists because two of DFU's mouse handlers read the keyboard
     *  directly at the moment of the click rather than through a
     *  binding: the left panel double-click passes
     *  `!Input.GetKey(LeftControl)` as "open the note editor too"
     *  (window :1878), and the debug teleport wants Ctrl AND Shift
     *  (:723-728). The port has no per-frame keyboard poll behind the
     *  overlay seam, so the DOWN route carries the modifiers the DOM
     *  event already holds; every other phase leaves it null. */
    overlayPointer(phase, vx, vy, button = 0, mods = null) {
      activeOverlay?.pointer?.(phase, vx, vy, button, mods);
      // ROAD-E E1: THE RELEASE EDGE, on this slot's one pointer door.
      // A window with no `pointer` seam at all still has to hear the
      // button come up, because a press can LATCH: the list picker's
      // thumb drag is VerticalScrollBar.Update (:101-130), whose
      // `else` arm (:123-129) drops `draggingThumb` the frame
      // GetMouseButton(0) reads false. Unwired, the latch survived
      // until the next mouse move.
      if (phase === 'up') activeOverlay?.release?.();
    },
    /**
     * ROAD-E E1: THE KEY-UP SEAM, `overlayInput`'s mirror.
     *
     * DFU windows read `InputManager`'s held-key dictionary in their
     * own Update, so the release is an edge they can all see
     * (HotkeySequence.IsUpWith / IsPressedWith, HotkeySequence.cs
     * :174-183). The port's windows are handed events, and this slot
     * was handed presses only - so the dungeon automap's two-phase
     * toggle-close (DaggerfallAutomapWindow.cs:703-713) had no UP to
     * close on and its twenty-two IsPressedWith camera arms had no
     * held state to poll. `ui/input.js`'s `routeKeyUp` is the door the
     * two hosts that mount this context call.
     *
     * OPTIONAL on the window, like `keyup` in townTalk's slot: a
     * window that defines none is one whose buttons subscribe no
     * keyboard handler. A release that ENDS the window drains here
     * exactly as `overlayInput`'s does.
     */
    overlayKeyUp(code, e = null) {
      if (!activeOverlay) return;
      activeOverlay.keyup?.(code, e);
      if (activeOverlay?.done) {
        surfacePlayer();
        activeOverlay = null;
      }
      dungeonWindows.reconcile(activeOverlay);
    },
    /** U37: THE HOVER SEAM, flagged since U25 and unbuilt until the
     *  tooltip needed it. Native coords, no done check - hovering
     *  never closes anything. */
    // ROAD-A7: the DOM mousemove rides along. VerticalScrollBar.Update
    // (:105) polls InputManager.GetMouseButton(0) every frame, and
    // `e.buttons` is the port's only read of that - without it the
    // list picker's thumb could latch but never move.
    overlayHover(vx, vy, e = null) { activeOverlay?.hover?.(vx, vy, e); },
    /** U26: ui/input.js asks this before mapping a key to an action -
     *  a native window keys off raw codes. */
    get overlayIsNative() { return !!activeOverlay?.isChoiceWindow; },
    overlayInput(action, e = null) {
      if (!activeOverlay) return;
      activeOverlay.input(action, e);
      // S40: OPTIONAL. A window may now clear this slot from INSIDE
      // its own input - RestWindow does, because DFU pops to the HUD
      // before RaiseSkills and the level-up screen that raise can
      // mount needs the slot free. Re-reading `activeOverlay` after
      // input() and dereferencing it unguarded threw on the very key
      // that closes the rest window.
      if (activeOverlay?.done) {
        surfacePlayer();
        activeOverlay = null;
      }
      // ROAD-B B1: PopWindow, reconciled in the same event - a key
      // that closes the top window hands the screen straight back to
      // the one beneath it.
      dungeonWindows.reconcile(activeOverlay);
    },
    drawOverlay(canvas) {
      if (!activeOverlay) return;
      if (!hudFont) {
        // Font-less: overlays cannot render. Chargen falls back to
        // the headless roll; a pending level-up applies headlessly;
        // anything else just closes. All loud.
        if (activeOverlay === chargenWindow) { chargenInputFallback(); }
        // ORL1: the mod's window first, because its purse is not a DFU
        // bonus pool - spending it with spendPoolLowest would ignore
        // the mod's three-attribute cap, its +5 ceiling and Luck's
        // price. The window spends its own purse by its own rules and
        // commits through the same door a player's Enter uses.
        // LV1: THE ENHANCED WINDOW IS A DOM DIV, so this arm is not
        // only about the pool - `activeOverlay = null` below would
        // leave the window ON THE SCREEN with nothing owning it, over
        // a game that had already been handed back. It goes FIRST
        // because it wraps either of the two screens the arms beneath
        // test for, and it spends by that screen's own lane before it
        // takes its own DOM away (ui/charSheetDoor.js's
        // enhancedLevelUpOverlay).
        else if (activeOverlay?.isEnhancedLevelUp) {
          console.warn('[levelup] FONT art unavailable; applying headlessly');
          activeOverlay.spendRemainingHeadless();
          surfacePlayer();
        }
        else if (activeOverlay?.isVirtueLevelUp) {
          console.warn('[levelup] FONT art unavailable; applying headlessly');
          activeOverlay.spendRemainingHeadless();
          surfacePlayer();
        }
        else if (activeOverlay instanceof LevelUpScreen) {
          console.warn('[levelup] FONT art unavailable; applying headlessly');
          applyLevelUp(playerEntity, (st, pool) => spendPoolLowest(st, Object.keys(st), pool));
          surfacePlayer();
        }
        // AUDIT 44 (a11): the classic lane levels ON THE SHEET now, so
        // the font-less escape has to know that shape too - the sheet
        // has already taken the Level++ and the health roll at mount
        // and holds an UNSPENT pool. Dropping it silently would eat
        // the points, which is the defect this arm exists to prevent.
        else if (activeOverlay?.leveling) {
          console.warn('[levelup] FONT art unavailable; applying headlessly');
          spendPoolLowest(activeOverlay.working, Object.keys(activeOverlay.working), activeOverlay.pool);
          activeOverlay.pool = 0;
          activeOverlay.input('confirm');   // CheckIfDoneLeveling writes the working stats home
          surfacePlayer();
        }
        activeOverlay = null;
        return;
      }
      // U26: a NATIVE window letterboxes ITSELF - nativeMetrics reads
      // the real canvas and returns its own integer scale and offset,
      // which is how townTalk has driven these since U8b. Handing it
      // the virtual canvas AND a screen offset applies the letterbox
      // twice: its opaque backdrop then covers only the virtual rect
      // and the dimmed world shows through the bars, which is AUDIT
      // 19 F2's defect for the seventh time. So a native window gets
      // the real canvas and no offset.
      if (activeOverlay.isChoiceWindow) {
        activeOverlay.draw(renderer, canvas, hudFont, hudScaleFor(canvas.width, canvas.height));
        return;
      }
      // Letterbox seam (2026-08-14): overlays lay out on a virtual
      // 320x200*s screen, centered on the real canvas. Full-canvas
      // dim first (the overlay's own backdrop then panels the box);
      // the offset MUST reset even if an overlay draw throws.
      const s = hudScaleFor(canvas.width, canvas.height);
      const vw = 320 * s, vh = 200 * s;
      // STATUS-LIVE: THE DIM BELONGS TO A MODAL WINDOW. This backdrop
      // says "the game is stopped and this is the only thing that
      // matters", which is true of every window that raises
      // PauseWhileOpen and false of one that does not - a readout the
      // player is WALKING under cannot black out the corridor they are
      // walking down. Asked of the window, the way every other gate in
      // this file asks `dungeonPaused`.
      if (pauseWhileOpen(activeOverlay)) renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.02, 0.02, 0.02, 0.6]);
      renderer.setScreenOffset((canvas.width - vw) / 2, (canvas.height - vh) / 2);
      try {
        activeOverlay.draw(renderer, { width: vw, height: vh }, hudFont, s);
      } finally {
        renderer.setScreenOffset(0, 0);
      }
    },
    // BS1/F198 + ST1: the Status action's chain (the four-hosts
    // seam) - the record-22 status text, then the health box.
    // STATUS-LIVE: ui/statusBox.js has the law. The free-slot refusal
    // stays and it stays SECOND: the toggle's own close has to run
    // first, or the key that opened the readout could never shut it.
    showStatus() {
      if (statusReadoutUp() || !activeOverlay) {
        toggleStatusReadout({
          mount: (box) => { activeOverlay = box; },
          drop: (box) => { if (activeOverlay === box) { activeOverlay = null; dungeonWindows.reconcile(null); } },
          lines: rscLines,
          macroContext: opts.questBridge?.machine?.macroContext?.() ?? null,
          entity: playerEntity,
          survival: survivalOn() ? { minutes: Math.floor(ownMinutes()), vampire: !!liveVampirism(playerEntity), endurance: liveStat(playerEntity, 'endurance') } : null,   // SURV5
        });
      }
    },
    // FIX-F: routeKey's RecastSpell / AbortSpell arms (EntityEffectManager.cs:257-270) - the dungeon's ctx
    recastSpell() { magic.recastSpell(); },
    abortSpell() { magic.abortReadySpell(); },
    /** MAC-C: the sheet's ONE construction here, lifted out of
     *  `toggleCharSheet` so the pack's cross-over key can reach it
     *  without a second bag - U52's whole argument, applied to the
     *  host that had the builder inline. The free-slot GUARD stays on
     *  the toggle, because the toggle is the thing with a slot to
     *  guard; a cross-over has just freed one. */
    makeCharSheet(sheetOpts = {}) {
      preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: lazy - ready by the next open at worst
      warmLevelUpWindow();   // LV1's audit: and the level-up window's chunk with it, for the same reason and on the same terms
      return createCharSheetWindow({
        entity: playerEntity,
        artDeps: { renderer, fetchBytes, palette },
        rows: (id, pick) => textRsc?.variantLinesById(id, pick ?? Math.random) ?? [],   // AUDIT 58: the eight attribute popups' TEXT.RSC records 0..7
        inventory: () => openInventory(null),
        spellbook: makeSpellbookWindow,
        pause: () => api.pauseHooks(pauseOpts(sheetOpts).setPlayerPos),   // F5-QUESTS: the enhanced F5 page is the pause window - handed this host's own bag
        ...questJournalHooks(),
      });
    },
    toggleCharSheet(doorOpts = {}) {
      if (activeOverlay) return;
      // U32: the sheet's navigation buttons.
      //
      // U43: this used to read "this host has no quest bridge, so
      // charSheetHooks withholds the logbook and the sheet says so".
      // It has one whenever worldModes mounts it - the bridge rides in
      // through opts and the save seam has been reading it since B4
      // (:2658) - so the sheet was refusing a logbook to a player
      // standing in a quest dungeon with three active quests. The
      // STANDALONE ?dungeon page really has none, and there
      // charSheetHooks' refusal is still the honest answer, which is
      // why this passes the bridge's own null through rather than
      // substituting an empty list.
      activeOverlay = api.makeCharSheet(doorOpts);   // F5-QUESTS: routeKey's position applier, for the page's Load
    },
    /** U43: the two journal doors (GameManager.cs:541-548). ONE window
     *  either way - LogBook opens it as it stands, NoteBook on the
     *  Notebook page (DaggerfallUI.cs:704-711). A host with no bridge
     *  opens neither, the same refusal the sheet's button gives. */
    toggleLogbook() { this._openJournal('activeQuests'); },
    toggleNotebook() { this._openJournal('notebook'); },
    _openJournal(mode) {
      if (activeOverlay || !opts.questBridge) return;
      activeOverlay = makeJournalWindow(mode);
    },
    toggleInventory() {
      if (activeOverlay) return;
      const w = openInventory(null);
      if (w) activeOverlay = w;   // DISC10-E L3: a refused pack is null - and its box already holds the slot
    },
    /** AUDIT 28 F-C2: PlayerMouseLook's swing gate excludes a bow
     *  (:248, WeaponType != Bow) - the standalone host asks here. */
    get weaponIsBow() { return !!playerWeapon.machine?.isBow; },
    /** AUDIT 28 W2c: DungeonWagonAccess_OnButtonClick's Yes arm
     *  (PlayerActivate.cs:1139-1142) - AllowDungeonWagonAccess() then
     *  dfuiOpenInventoryWindow: the inventory opens showing the wagon
     *  in Remove mode, wherever the player stands. */
    openInventoryWithWagon() {
      if (activeOverlay) return false;
      const w = openInventory(null, null, { wagonPrompt: true });
      if (w) activeOverlay = w;   // DISC10-E L3: a refused pack is null - and its box already holds the slot
      return !!w;
    },
    /** The TEXT.RSC rows the exit prompt reads (record 38). */
    rscLines,
    // PX15b: THE DIAL - the dungeon ctx carries all four doors (the
    // PX15 flag's 'no native inventory' cited a ui/input.js header note that no longer stands;
    // toggleInventory above is the door it lacked then and has now).
    toggleDial() {
      // The host object is an anonymous returned literal, so the doors
      // are reached through `this` - routeKey calls ctx.toggleDial()
      // as a method, and the entry arrows inherit that binding.
      return openPixelDial([
        { id: 'skills', label: 'Skills', dir: 'n', open: () => this.openSheetPage() },
        { id: 'items', label: 'Items', dir: 'e', open: () => this.toggleInventory() },
        { id: 'map', label: 'Map', dir: 's', open: () => this.toggleAutomap() },
        { id: 'magic', label: 'Magic', dir: 'w', open: () => this.toggleSpellbook() },
      ]);
    },
    toggleSpellbook() {
      if (activeOverlay) return;
      const w = makeSpellbookWindow();
      if (w) activeOverlay = w;
    },
    /** TR5: dfuiOpenTransportWindow's INDOORS arm (:691-694) - a
     *  dungeon is inside, so the key refuses with a HUD line. */
    openTransport() { hudText.add(CANNOT_CHANGE_INDOORS); },
    /** UI1: the U key in a dungeon. Nothing usable, no window
     *  (DaggerfallUI :581-583); the use runs the host's seam. */
    openUseMagicItem() {
      if (activeOverlay) return;
      const win = createUseMagicItemWindow({
        items: playerEntity.items ?? [],
        onUse: (item) => opts.useMagicItem?.(item),
      });
      if (win) activeOverlay = win;
      else hudText.add(NO_ITEM_TO_ACTIVATE_TEXT);   // DISC12: DaggerfallUI.cs:584-585
    },
    /** AUDIT 64 F13: this dungeon's static NPCs, for the two dungeon
     *  rays. The ShowText / ShowTextWithInput exclusion is
     *  PlayerActivate.cs:745-751 - "Do not activate static NPCs
     *  carrying specific non-dialog actions as these usually have some
     *  bespoke task to perform ... Examples are guard at entrance of
     *  Daggerfall Castle and Benefactor and Sheogorath in Mantellan
     *  Crux". DFU still Receives that action off the same hit
     *  (:378-383), so the port leaves those flats as ACTION targets
     *  and never mints a person for them. */
    /** AUDIT 64 F11..F17 review round: THE RAW static-NPC list, for the
     *  two behaviour collectors worldModes owns. RDBLayout.cs:1228-1237
     *  adds StaticNPC to every NPC flat and then calls
     *  SetupIndividualStaticNPC on the same GameObject, so a dungeon
     *  static NPC's bootstrap QuestResourceBehaviour is a component in
     *  the scene like any other: it is in
     *  Resources.FindObjectsOfTypeAll<QuestResourceBehaviour>()
     *  (GameObjectHelper.cs:926 - the list IsAlreadyInjected reads; the
     *  guard is :978, called :950) and, because StaticNPC.cs:127
     *  registers the object with ActiveGameObjectDatabase, in
     *  GetActiveStaticNPCQuestResourceBehaviours too
     *  (ActiveGameObjectDatabase.cs:308-311). npcTargets() below is the
     *  RAY's filtered view and cannot serve either. */
    people,
    npcTargets() {
      return people.filter((pn) => pn.active !== false && pn.width
        && !(pn.action && (pn.action.actionFlag === ACTION_FLAGS.ShowText
          || pn.action.actionFlag === ACTION_FLAGS.ShowTextWithInput)));
    },
    /**
     * WORLD-HOVER: THE ONE CONSTRUCTION SEAM for this dungeon's
     * activation targets.
     *
     * The list was built inline in TWO places against this same
     * context - the modal host's dungeon arm (scenes/worldModes.js)
     * and the standalone dev door's (scenes/dungeon.js) - and the
     * hover would have been a third. That is the failure AUDIT 17i
     * names: a family added later is seen by whichever builder its
     * author happened to be looking at, and the other two go on
     * quietly answering an older world.
     *
     * The context composes what the context OWNS - the action objects
     * and `lootTargets` (piles, corpses, the player's own drops, the
     * dropped torches, the camps). Everything else a host stands - its
     * exit doors, its quest stands, its static NPCs - the host
     * REGISTERS, once, at mount.
     *
     * Registering rather than taking an options bag is the whole
     * point. A host that cannot ANSWER a family must not stand it:
     * the standalone `?dungeon` door has no world to exit to and no
     * `exit:` or `person:` arm in its ladder, so such a target would
     * win the pick and eat the press in silence. That difference
     * between the two hosts is real today and entirely invisible -
     * it IS the difference between two hand-copied lists. Here it is
     * one line at each mount, and the hover inherits it for free,
     * which is what stops the plaque naming something the button
     * ignores.
     */
    addActivationTargets(fn) {
      if (typeof fn !== 'function') return () => {};
      _hostTargets.push(fn);
      return () => { const i = _hostTargets.indexOf(fn); if (i >= 0) _hostTargets.splice(i, 1); };
    },
    /** WORLD-HOVER: the naming half of the same seam - the mod's own
     *  extension API (vendor .cs:228-257), insertion order, first
     *  answer with a title wins. A host registers a namer for each
     *  family it registered targets for, so the two halves cannot
     *  drift apart: a family nobody stands is a family nobody names. */
    addActivationNamer(fn) {
      if (typeof fn !== 'function') return () => {};
      _hostNamers.push(fn);
      return () => { const i = _hostNamers.indexOf(fn); if (i >= 0) _hostNamers.splice(i, 1); };
    },
    /**
     * WORLD-HOVER: THE DUNGEON'S OWN WORDS - World Tooltips' ladder
     * (systems/worldTooltips.js) over the families this context owns,
     * then the port-own objects through the mod's extension API, then
     * whatever the HOST registered. Insertion order is priority and
     * the first answer with a title wins, which is the mod's own law
     * (vendor .cs:228-257).
     *
     * Everything the mod names is gated on ITS switch; the loot rows
     * are PX21c's and are not, which is why `loot:`/`corpse:`/
     * `droppedLoot:` still answer with the switch off. That split is
     * recorded on the mod's Features row in as many words.
     */
    hoverName(key, hit) { return opts.profHoverName?.(key) ?? _namer(key, hit); },   // PROF-MENU: a profession node's acts first
    /** PROF2 (bible/06-Systems/Professions-Arc.md 23): this dungeon as the professions name it - DFU's own identity
     *  (MapTableData.MapId & 0xfffff), its climate and region - or null for one a client's hash made, which grows no
     *  vein (nothing any other client, or the witnesses, could stand behind). */
    profIdentity() {
      // AUDIT 29 D5: nor the Burning Court - every court is "dungeon 0" by its own record (gateArena.js), no dungeon's
      if (dfLocation?.spawned || isGateArena(dfLocation) || isArenaFloor(dfLocation) || !Number.isSafeInteger(dfLocation?.mapTableData?.mapId)) return null;
      return { id: dfLocation.mapTableData.mapId & 0xfffff, climate: dfLocation.climate?.worldClimate ?? null, region: dfLocation.regionIndex ?? null };
    },
    /** PROF2: A DUNGEON VEIN'S WALL - from one of this dungeon's foe markers (the layout's own list, the same on every
     *  client, so every client stands the vein in one place), a ray at chest height along `bearing` through the collider
     *  to the first near-vertical face within PROF_VEIN_WALL_M, the vein a third of a metre off it and half a metre up
     *  from the floor under it; the next eighths of a turn, then the next markers, where nothing is found. The elite
     *  foes' clearance rays are the precedent (expandEliteEnemies, above). Null when no wall answers. */
    veinWall(marker, bearing) { return profVeinWall(marker, bearing); },
    /** PROF2: flats the professions stand here (a vein's ore), owned with the dungeon's own - freed by destroy() with the
     *  rest, or dropped first when the host re-stands them. */
    async standProfFlats(archive, record, scale, centers) {
      const t = await getTexture(archive);
      if (!t || record >= t.recordCount) return null;
      uploadRecord(archive, record);
      const base = billboardSize(t, record);
      const batch = renderer.createBillboardBatch(archive, record, { w: base.w * scale, h: base.h * scale }, centers);
      billboardBatches.push(batch);
      return batch;
    },
    dropProfFlats(batch) {
      const i = billboardBatches.indexOf(batch);
      if (i < 0) return;
      billboardBatches.splice(i, 1);
      renderer.destroyBatch(batch);
    },
    dungeonActivationTargets() {
      // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
      return composeActivationTargets([...activationTargets(actions.objects), ...lootTargets()], _hostTargets);
    },
    lootTargets,
    /** PX21c: what a loot key HOLDS, without opening it - the same
     *  three kinds takeLoot resolves, read-only, for the hover plaque.
     *  It shares takeLoot's own key vocabulary rather than inventing a
     *  second one, so what the plaque names is what the button opens. */
    lootContents(key) {
      const [kind, iStr] = key.split(':');
      const i = Number(iStr);
      if (kind === 'loot') return lootPiles[i]?.batch ? (lootPiles[i].items ?? []) : null;
      if (kind === 'corpse') { const f = foes[i]; return lootableBody(f) ? (f.entity?.items ?? []) : null; }   // AUDIT 68 S19-removed-foe-lootable
      if (kind === 'droppedLoot') return droppedLoot.contents?.(key) ?? null;
      if (kind === 'spoil') return opts.spoilContents?.(key) ?? null;   // WB9f: a piece of the Burning Court's spoils (the outer host's pool)
      return null;
    },
    /** U26: PlayerActivate's loot handling, verbatim in shape - the
     *  container becomes the inventory window's REMOTE TARGET and the
     *  player takes what they want, rather than the whole pile
     *  teleporting into the pack on one keypress. Returns the number
     *  of items the target holds, so the caller's "did anything
     *  happen" test still reads.
     *
     *  LOOT-STACK: `pileKeys` is the pile a loot window's tab carries
     *  back here (player/lootStack.js lootPile) - a tab's open, which
     *  quick loot does not take on. */
    takeLoot(key, mode = 'grab', pileKeys = null) {
      const [kind, iStr] = key.split(':');
      const i = Number(iStr);
      if (kind === 'droppedTorch') return droppedTorches.activate(key, mode) ? 1 : 0;   // HT1: PickUpLightSource
      // SURV3: the fire's menu, or its name. AUDIT-WH2 L2-F1: and a
      // `hearth:` beside it - HEARTH1 says all FOUR HOSTS collect the
      // world fires and stand a ray target that opens the cooking list,
      // and the dungeon collected them (dungeonHearths, off the RDB
      // flats), stood them (camps.targets()) and named them ('Fire')
      // without ever growing the arm that answers. `camps.activate`
      // already routes both keys; only this line was missing, so E on a
      // brazier fell through to the ActionSystem, matched no object,
      // and was CONSUMED - no cooking list, no Info line, and nothing
      // behind it activated either. The same object opens the list
      // outdoors and indoors.
      if (kind === 'camp' || kind === 'hearth') return camps.activate(key, mode) ? 1 : 0;
      let source = null;
      let onEmptied = null;
      let lootHooks = null;   // G5: DaggerfallLoot's identity, per kind
      if (kind === 'loot') {
        const p = lootPiles[i];
        if (!p || !p.batch) return 0;
        source = p.items;
        // The RDB treasure flat IS the remote panel's picture
        // (:880-884) - archive 216 with the marker's own record - but
        // it is not playerOwned, so its icon cannot be cycled.
        lootHooks = { textureArchive: RANDOM_TREASURE_ARCHIVE, textureRecord: p.record };
        // The RDB pile's flat leaves when the window CLOSES on an
        // emptied container, not the instant the last item moves -
        // the same law droppedLoot.releaseEmptied ports.
        // AUDIT WORLD4 C3/D2: through the one home, which the room's word and the save's restore also call.
        onEmptied = () => settleLootFlat(i);
      } else if (kind === 'corpse') {
        const f = foes[i];
        if (!lootableBody(f)) return 0;   // AUDIT 68 S19-removed-foe-lootable
        source = f.entity.items;
        // CreateLootableCorpseMarker hands ReverseCorpseTexture's
        // archive/record straight to CreateLootContainer
        // (GameObjectHelper.cs:812-828), which writes them onto the
        // container (:697-698) - so a corpse marker ALWAYS has
        // TextureArchive > 0 and UpdateRemoteTargetIcon draws the
        // body's OWN world flat (:880-884), never the Ground picture.
        // The archive is the same struct-copy-then-row read spawnCorpse
        // takes (EnemyDeath.cs:86-92), and the pair arrives without
        // playerOwned because :833 sets it false - so CanChangeDropIcon
        // refuses to cycle a body's icon.
        const ct = f.mobile?.basics?.corpseTexture ?? ENEMY_BASICS[f.mobileType]?.corpseTexture;
        if (ct) lootHooks = { textureArchive: ct.archive, textureRecord: ct.record };
      } else if (kind.startsWith('droppedLoot')) {
        const p = droppedLoot.pileFor(key);
        source = p?.items ?? null;
        if (p) lootHooks = droppedLootHooks(p);   // G5: playerOwned - the icon cycles
      }
      if (!source) return 0;
      { const _u = roomLootKey(key); if (_u && _lootUnreadable.has(lootKeyOf(_u))) { setMidScreenText(LOOT_NEWER_TEXT); return 0; } }   // AUDIT SETS M2: not opened here
      // LOOT-STACK: a window that has CLOSED is no window - a tab closes
      // its body's window and opens the next through here in one click,
      // before the frame's drain empties the slot (openBookHook's law).
      if (activeOverlay && !activeOverlay.done) return source.length;
      // WORLD4: opening one of the room's containers CLAIMS it - the room hears this client's list before a single
      // item moves, so a second reader opening the same pile a moment later reads the room's and not their own roll.
      // AUDIT WORLD4 C6: after the mount, never before it - openInventory REFUSES a transformed lycanthrope
      // (GetSuppressInventory), and a claim for a container nobody opened is not what the law says.
      // QUICK-LOOT B4: the same door, one layer in. This host does not
      // build a hooks object for the window - it hands `openInventory`
      // the SOURCE ARRAY itself, and that array is what the window
      // mutates - so the hooks shape is put around that same handle
      // rather than a second one. Null opens the window as before.
      //
      // LOOT-REGEN (2026-09-22, a player on Discord, online: "I get
      // killed and go back into the dungeon, and all the guys I killed
      // before have loot again"): B4 read the claim as a WINDOW's act
      // and made none for a take that opened nothing - so a corpse
      // emptied by the quick door never reached `_lootSeen`, the memory
      // carried no `corpse:<i>` record for it, and on re-entry
      // `patchFoe` stood the remembered death over the fresh build's
      // OWN roll. A take is the room's word exactly as an open-and-close
      // is: what is left is said and stamped the moment the take lands
      // (WORLD4's close law, WORLD8's stamp - the open's claim and the
      // close's word are one word here, since nothing stands open
      // between them), and an emptied pile's flat is settled as the
      // window's onEmptied would settle it. C6's order below stands:
      // the window's claim follows its mount.
      if (!pileKeys && quickLootTake(key, { items: () => source }, playerEntity, setMidScreenText, { getQuest: (uid) => opts.questBridge?.machine?.getQuest?.(uid) ?? null, took: showPickups })) {   // AUDIT QL-WEIGHT1: the window's own resolver (openInventory's, :1512); PICKUP-FEED: the cards
        const _q = roomLootKey(key);   // REST-SYNC: the room's name for it
        if (_q) publishLoot(_q);
        if (!source.length) onEmptied?.();
        return source.length;
      }
      const pile = kind === 'corpse' ? lootPile(key, {
        keys: pileKeys,
        describe: (k) => { const b = foes[Number(k.split(':')[1])]; return lootableBody(b) ? pileBody(b) : null; },   // AUDIT 68 S19-removed-foe-lootable
        open: (k, keys) => { this.takeLoot(k, 'grab', keys); },
      }) : null;
      if (pile) lootHooks = { ...(lootHooks ?? {}), pile };
      const _k = roomLootKey(key);   // REST-SYNC: the room's name for it
      const _w = openInventory(source, onEmptied, { lootHooks, lootKey: _k });
      if (_w) activeOverlay = _w;   // DISC10-E L3: a refused pack is null - and its box already holds the slot
      if (_w && _k) { _lootOpenKey = _k; publishLoot(_k, { claim: true }); }
      return source.length;
    },
    /** RW1: GivePc's reward container (GivePc.cs:167-171) - a dropped
     *  pile at the player's feet, "CreateDroppedLootContainer(
     *  PlayerObject, ...)" in this host's own vocabulary. Answers the
     *  OPEN thunk the caller fires when the QuestComplete box closes
     *  (the messageBox.OnClose law, :189-196), or null with no ground
     *  position yet - the same no-feet-no-pile arm onDrop carries. */
    offerRewardLoot(dfItem) {
      if (!lastPlayerFeet) { console.warn('[loot] reward before the first frame; no ground position yet'); return null; }
      const pile = droppedLoot.dropPile([dfItem], [...lastPlayerFeet]);
      return pile ? () => { this.takeLoot(`droppedLoot:${pile.id}`); } : null;
    },
    textureTable: dungeon.textureTable,
    exitDoors,
    castleShelves,   // AUDIT-SEATS: a castle's shelves, a crown's Hall of Records
    colliderTris,
    destroy() {
      _ctxDead = true;   // NT1 (F213): before anything frees - the warm-window continuations read it
      _unregisterPresenter();   // ENH-NOTICE3: the registration leaves with the context (the dead latch above is what REFUSES a box in the meantime - pushDungeonWindow reads it, AUDIT ENH-NOTICE3 F2)
      // PX21c: the plaque leaves with the host that raised it - AFTER
      // the latch, which NT1 pins as the first act of this function.
      destroyWorldPlaque();
      // A1: OnTransitionToDungeonExterior's automap half - marks the
      // player outside and, at AutomapNumberOfDungeons = 0, forgets
      // the map the moment you leave (Automap.cs:2530-2534).
      exitDungeonAutomap(classicMinutesRef.value);   // AUDIT-AMAP F11: stamped with the EXIT time (:2155)
      bloodMarks.dispose();   // BLOOD1a (HARD1): the ring is OURS - a vertex buffer and a VAO handed to nobody - so it ends here, by its own name and not through the hand-off pool
      // ROAD-B B1: RemoveWindow runs OnPop on every window it removes
      // (UserInterfaceManager.cs:189-196) and ChangeWindow removes them
      // all (:125-126). The outer host disposes the TOP before calling
      // here; with a stack there can be windows under it - a rest
      // suspended beneath a quest box still holds IsResting - so the
      // whole stack drains with the context. dispose() is idempotent
      // (A2), which is what makes the outer host's call harmless.
      dungeonWindows.reconcile(activeOverlay);
      dungeonWindows.clear((w) => w.dispose?.());
      // B1: OnDestroy for every quest foe standing in this dungeon -
      // the resource uncouples exactly as Unity's scene teardown does.
      for (const f of foes) f.questBehaviour?.notifyDestroyed();
      // AUDIT 59 F2: the nav worker leaves with the context. Every
      // dungeon entry made a new NavClient (one worker) and nothing
      // terminated it, so each visit left a live worker behind once
      // F1 let one exist. A bake still in flight resolves onto a dead
      // context's `chf`, which nothing reads - harmless by NT1's latch.
      enhancedNav.client?.dispose();
      enhancedNav.client = null;
      // AUDIT 68 S19-restore-missiles-survive: this context's flights end with it, each retired (spliced, freed, dead)
      // BEFORE the batch loop below - a missile whose archive is still warming then mints nothing onto the orphan.
      clearLocalMissiles();
      // billboardBatches is the static layout art AND every batch a
      // hand-off pool pushed into it (hitEffects' splashes since HE1,
      // :2418) - which is why nothing below may end those pools again.
      // HARD1 (the generative lifetime gate's first catch) / BLOOD1
      // AUDIT 3: the blood splashes own a billboard batch each while
      // they animate (hitEffects.js mints one per spawn and frees it on
      // retire), and THIS POOL HANDS EVERY BATCH AWAY AS IT IS BORN -
      // `onSpawn` pushes it into billboardBatches and `onRetire` splices
      // it back out (:2616-2617). HARD1's first pass put a clear() BELOW
      // the loop that frees that list and it was a double free; the
      // note that replaced it said "nothing to do here", and that left
      // the one hole this pool has: a splash whose archive is still
      // WARMING when the dungeon goes (the first blood of a session,
      // the player dead or quickloading or recalled before TEXTURE.380
      // resolves) had nothing to tell its continuation the room was
      // gone - `entry.dead` is set by retire() alone - so it minted a
      // batch into the orphaned list and nothing ever freed it. The
      // clear goes ABOVE the loop: retire() splices each live batch out
      // of the list before it frees it, so every batch is freed exactly
      // once, by whichever of the two reaches it first, and every
      // warming entry is dead before the room is.
      hitEffects.clear();
      for (const b of billboardBatches) renderer.destroyBatch(b);
      if (staticBatch) { renderer.destroyMesh(staticBatch); staticBatch = null; }   // PERF5
      // AUDIT 17e F29 / EVERY ALLOCATION HAS AN OWNER: a foe's LIVE
      // billboard batch is NOT in billboardBatches, so every dungeon
      // enter/exit cycle leaked one VAO + buffers per sprite.
      // AUDIT 68 S19-corpses-array-dead: corpses and missiles ride
      // billboardBatches (freed above), so their second free is gone.
      for (const f of foes) if (f.batch) renderer.destroyBillboardBatch(f.batch);
      for (const t of torches) { t.handle?.stop(); t.handle = null; }   // A2: free looping sources
      // AUDIT 66 F5 / EVERY ALLOCATION HAS AN OWNER: the DROPPED
      // torches own one billboard batch and one 3D burning loop each
      // (HT1), and this teardown - which frees the foes', the corpses'
      // and the missiles' batches two lines up, and the static wall
      // torches' loops one line up - walked straight past them. Every
      // dungeon exit leaked a batch and a loop per torch on the floor,
      // and the loop kept burning in the player's ear above ground.
      // The rig's own component goes with it: it holds the burning
      // loop of the torch in the player's HAND and PlayerTorch's
      // position override (AUDIT 66 F8).
      uninstallSurvivalGate(_survivalGate, unregisterPreventRestCondition);   // AUDIT SURV B/C: a dead dungeon's handler was refusing the outdoor fire
      camps.destroyAll();   // SURV3: a fire's batch is this context's too
      droppedTorches.destroyAll();
      weaponRig.dispose?.();
      // AUDIT 64 F41: the scene ambience leaves with the scene too -
      // it holds the dungeon loop handles AND a row in the module's
      // live-instance registry (the port's stand-in for DFU's static
      // OnVideoStart/OnVideoEnd subscription, AmbientEffectsPlayer.cs
      // :92-93), which OnDisable/OnDestroy drops in Unity.
      sceneAmbience.dispose();
      // U26 / EVERY ALLOCATION HAS AN OWNER: the dropped piles own a
      // billboard batch each and leave with the dungeon. NT1 (F213):
      // dead FIRST - the documented removal protocol (droppedLoot.js
      // mount reads it) - so a pile dropped at the exit whose texture
      // is still warming cannot mint onto the orphan.
      for (const p of droppedLoot._piles) { p.dead = true; if (p.batch) renderer.destroyBillboardBatch(p.batch); }
      droppedLoot._piles.length = 0;
      portals.clear();   // COMPANION-PORTAL: the portals standing own a batch each and leave with the dungeon
      // NT1 (F214): the context minted its own cast engine; a spell in
      // flight at the exit owned a batch nothing else can reach.
      magic.handReadyTo(opts.outerCastEngine?.() ?? null);   // CAST-USE (AUDIT part five CU1): a ready held at the way out (the door, a Recall, a load) goes with the player
      magic.destroy();
      // V2c: hand the sunlight seam back to whoever held it (the town
      // page's worldModes registration) - a latched dungeon answer
      // would keep the sun off the player forever after the exit.
      setPassiveSpecialsHost(_prevPassiveHost);
      // AUDIT 39 (#35, #37): the other three process-global seams this
      // context borrowed leave with it. Nothing above ground takes them
      // back on the exit path, so a seam left pointed here presents,
      // consults and turns the player INTO a torn-down context.
      setDeathPresenter(_prevDeathPresenter);
      setAvoidDeathHook(_prevAvoidDeath);
      setInfectionHost(_prevInfectionHost);
      // ...and the one HUD label this context borrowed off the module
      // singleton (:1366). A dungeon left behind must not keep a dead
      // context's opts closure installed on it.
      midScreenText.onMessage = _prevMidScreenSink;
      // ...and this context's OWN popup column (AUDIT FONT F1) - EVERY
      // ALLOCATION HAS AN OWNER, and a torn-down context's DOM column
      // would otherwise outlive it on the page.
      hudText.dispose();
    },
  };
  return api;
}
