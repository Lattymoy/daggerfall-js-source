// Interior/dungeon mode machine (P3-P6, extracted at the P7
// consolidation): a HOST scene stays in 'exterior' mode until an E on a
// static door swaps the whole frame pipeline - draws, lighting, fog,
// collider - to a built context, and back on exit. The host keeps
// streaming/exterior rendering; the machine owns everything modal.
// Hosts: the streaming world (?world) and the exterior location scene.
//
// Host contract:
//   canvas, renderer, player, cam, keys - the live scene objects;
//   latch {use, crouch} - shared edge-detect state (a held key must
//     not re-trigger across a mode switch; jump is HELD since P14);
//   blocks - BlocksFile (dungeon layout);
//   pipeline - {getGpuMesh, cpuModels, getTexture, uploadRecord} plus
//     arch for the dungeon pre-pass (dataPipeline.js);
//   doorTargets() - LIVE world-space static-door entries
//     {door, dfBlock, recordIndex, climateBase, season, dfLocation,
//      group}; group scopes dungeon-entrance candidates (the world's
//      pixelKey; a single location's constant key). Translations must
//      be frozen while a mode is active (both hosts early-return past
//      their streaming/recenter step), so entries captured at enter
//      stay valid for the exit landing math.
//   baseCollider() - the collider to restore on exit.

import { doorWorldAabb, doorWorldPosition, doorWorldNormal, interiorLanding, exteriorLanding, dungeonEntranceLanding, climbLadder, floorLanding, repositionFeetY } from '../player/enterExit.js';
import { startRestGroundedCheck, TELEPORT_FREEZE_S } from '../player/motor.js';   // S40: the rest gate's grounded input; A6: DaggerfallAction.Teleport's physics settle
import { AutomapWindow, preloadAutomapArt, signalAutomapReset } from '../ui/automapWindow.js';   // ROAD-C c2/S9: the M window inside a building
import { automapDungeonKey, getDungeonAutomap } from '../systems/automap.js';   // ROAD-C c2/S9: Automap.cs:2362-2379's read of the dungeon dictionary
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { pickActivatable, worldAabb, activationTargets, pickQuestFoe, rayAabb } from '../player/activate.js';   // QG1: the foe-click door
import { removeOne, addItem, isEnchanted, totalWeight, letterOfCredit, LETTER_OF_CREDIT_TEMPLATE, spendArrow } from '../systems/inventory.js';   // U40: the sell filter, the encumbrance gate and the letter
import { isEquipped, unequipSlot } from '../systems/equip.js';   // AUDIT 17e F4: worn gear is not merchandise
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { createPlayerTicker , wireInfectionVideos, endRunToTitleMenu, exitToTitleMenu, doorSpellFor, consumeDoorSpell, wireDoorSpells, createDetectFeed, createRestDeps, foeNearbyRecord, nearbyLootRecords} from './shared.js';   // AUDIT 18: the interior host's world clock; S40: its rest deps
import { triggerExteriorOpen, DOOR_SPELL_TEXT } from '../systems/mysticism.js';   // X3: the Open spell's EXTERIOR-door arm
import { buildInteriorContext } from './interiorContext.js';
import { advanceMachinery, mountMachineryChild, machineryChildPos, MILL_SOUND } from '../world/windmills.js';   // WM4b: the machinery's moving parts; WM4c: its hum
import { buildDungeonContext } from './dungeonContext.js';
import { DOOR_TYPE } from '../world/meshReader.js';
import { getGroundArchive } from '../world/climateSwaps.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR, DUNGEON_LIGHT_BLOCK_RANGE } from '../world/dungeonLights.js';   // A10: the block-range cut
import { INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { isNight } from '../world/worldClock.js';   // AUDIT 23 (C12)
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C12): the one clock; G4's probe moves it
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5)
import { healthStatusRows, statusInfoRows } from '../systems/healthStatus.js';   // BS1/F198: the Status health box
import { makeOpenBookHook } from '../ui/bookReader.js';   // BS1: the shelf pick opens the reader
import { populateBookshelf, bookshelfAccess, bookshelfTitles } from '../systems/bookshelf.js';   // BS1
import { maxFatigue, liveStat } from '../systems/statMods.js';   // AUDIT 23 (C5); U40: strength for MaxEncumbrance
import { entityMaxEncumbrance } from '../combat/formulas.js';   // U40: the letter-of-credit gate
import { nearestLights } from '../world/cityLights.js';
import { withPlayerLights } from './magicCandle.js';   // X11/T1: the lights the PLAYER carries ride every host's light array
import { playerTorchLight } from '../systems/playerTorch.js';   // T1
import { lookAt, perspective, mirrorProjectionX, trs, multiply, UP_Y } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law); H4: the preview's model matrix
import { routeKey, actionOf, held, moveHeld, anyMove, swallowBrowserKey } from '../ui/input.js';
import { makeWindowStack } from '../ui/windowStack.js';   // ROAD-B B1: UserInterfaceManager's stack, under this host's one slot
import { createActivateGate, activateFrame } from '../systems/activateGate.js';   // A8: PlayerActivate's ActivateCenterObject frame
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { applyFog, DUNGEON_FOG } from '../render/underwaterFog.js';   // ROAD-B (b3): UnderwaterFog + WeatherManager.DungeonFogSettings
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';
import { ArrowFlight, playerArrowHitFoe } from '../combat/arrowFlight.js';   // C13: visible interior arrows; AUDIT 39 (#64): and the shaft that LANDS
import { calculateAttackDamage, dice100 } from '../combat/formulas.js';   // AUDIT 39 (#64/#65): the interior arrow's damage, both ways   // ROAD-B: the two exterior-door bash rolls
import { WEAPON_REACH } from '../combat/playerWeapon.js';   // ROAD-B: AttemptExteriorDoorBash rides the SWING's reach, not the click's
import { inflictPoison } from '../systems/poisons.js';   // AUDIT 39 (#64/#65): a poisoned shaft doses its mark
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS, playPlayerVoice, playerPainVoice, makeEnemiesHostile } from './hostCombat.js';   // AUDIT 21 hosts F8: the swing law, shared with the dungeon and the guards; IF: the pain cry   // ROAD-B: GameManager.MakeEnemiesHostile
import { createExteriorFoes } from './exteriorFoes.js';   // IF: the ONE foe-pool factory - see interiorFoes below
import { createCityGuards } from './cityGuards.js';   // ROAD-B: SpawnCityGuards' INDOOR arm needs a watch pool in the building
import { createDroppedLoot } from './droppedLoot.js';   // ID1: the interior's own ground pile
import { createHitEffects } from './hitEffects.js';   // HE1: EnemyBlood.ShowBloodSplash, the fourth host
import { hitSoundFor } from '../systems/soundClips.js';   // IF: the blow that lands on the player indoors
import { entityIsParalyzed } from '../systems/effects.js';   // AUDIT 39r: the S19 gate is host-agnostic in DFU - the interior arm owes it too
import { flashPlayerDamage } from '../ui/damageFlash.js';   // AUDIT 39r: ShowPlayerDamage - an arrow indoors comes through the same door as a blow
import { sensesContext } from './shared.js';   // IF: the one senses builder every pool is handed
import { makeInView } from '../player/cameraView.js';   // IF: the swing's in-view test, the guards' own
import { mwViewFrame, mwViewDrawBody } from '../player/mwView.js';   // MW-D25: the Morrowind camera
import { MOBILE_TYPES } from '../characters/mobileTypes.js';   // IF: the daedric punishment's name->id door
import { areEnemiesNearby } from '../systems/encounters.js';   // IF: GameManager.AreEnemiesNearby, one method over this host's database
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { audio } from '../systems/audio.js';
import { lycanthropeMoveSound } from '../systems/lycanthropy.js';   // LM1: the 4-20s transformed move-sound loop
import { SpellbookWindow, preloadSpellbookArt, spellbookArtLoaded } from '../ui/spellbookWindow.js';   // U42: the classic art window (retires M2's keyed stand-in), and the guilds' BUY mode
import { createSpellbookWindow } from '../ui/spellbookDoor.js';   // PX23: the book's one door
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { SOUND, swingSoundFor } from '../systems/soundClips.js';   // AUDIT 23: the bow loose + no-enemy swing sounds
import { fetchBytes, applyMotorEffectFlags, applyFallLanding, ridePlatform } from './shared.js';
import { setDeathPresenter, setAvoidDeathHook, hurtPlayer } from '../characters/playerEntity.js';   // AUDIT 21 hosts F6; AUDIT 23 C5 fatal collapse
import { DeathScreen } from '../ui/deathScreen.js';   // AUDIT 21 hosts F6: dying in a building
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the HUD vanished inside buildings
import { largeHudOptions, routeLargeHudClick, activeMouseOverLargeHUD, trackLargeHudPointer } from '../ui/hudLarge.js';   // U45: the classic bottom bar and its eleven panels; ROAD-Ar: and the guard that stops them being world clicks too
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
// E2: the shop shelf browse/buy layer (node-pure laws in shopStock.js)
import { ChoiceWindow } from '../ui/talkWindow.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { hudScale } from '../ui/hud.js';
import { isShop, isRepairShop, stockShopShelf, stockHouseContainer, PRIVATE_PROPERTY_TEXT_ID, calculateCost, calculateTradePrice, regionPriceAdjustment, SHOP_BUYS_GROUPS, shopBuysItem, stockSoulGems, stockGuildMagicItems, stockGuildPotions, createStockedDate, needsRestock } from '../systems/shopStock.js';   // X6: the soul-gem shelf; G4: the two guild shelves; A2: the daily restock
import { identifySpellPass, identifiedTallyText, NOT_ENOUGH_SPELL_POINTS_TEXT } from '../systems/tradeModes.js';   // X7: the Identify SPELL's per-item roll; F067: its magicka refusal
import { liveBundles, dispelBundle, dispellableBundles, DISPEL_MAGIC_TEXT } from '../systems/mysticism.js';   // X10: the Dispel Magic picker
import { ListPickerWindow, listPickerArtLoaded } from '../ui/listPicker.js';   // X10
import { createItemLabels, grantCreatedItem, lastCreateItemIndex, setLastCreateItemIndex } from '../systems/createItem.js';   // X11b
import { LevelUpScreen } from '../ui/charsheet.js';   // AUDIT 21 hosts F3: levelling in a building
import { NativeTradeWindow, preloadTradeArt, tradeArtLoaded, TRADE_RECTS } from '../ui/nativeTrade.js';   // U8c
// U23: the static-NPC seam and the guild service popup.
import { STATIC_NPC_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE, RAY_DISTANCE } from '../systems/talk.js';
// PlayerActivate.ActivateBulletinBoard (:706-739) - the town sign's arm
import { BULLETIN_BOARD_ACTIVATION_DISTANCE, TOO_FAR_AWAY_TEXT, bulletinBoardRows } from '../systems/bulletinBoard.js';
import { tokenRows } from '../ui/messageBox.js';
import { staticNpcRoute, showsJoinButton, serviceAccess, onPushEffects, NO_POTION_INGREDIENTS } from '../systems/guildServiceFlow.js';
import { isIngredient } from '../systems/potions.js';   // F201: MakePotionService's scan
import { canAccessService } from '../systems/guildServices.js';   // G4: does THIS guild also sell soul gems?
import {
  receiveArmorDecision, claimArmor, SPYMASTER_GREETING_TEXT_ID,
  receiveHouseDecision, claimHouse, ALREADY_GIVEN_HOUSE,   // H1
} from '../systems/knightlyGifts.js';   // G6
import { mintCondition } from '../systems/itemTemplates.js';   // G6: the gift's pieces mint like any other item
import { npcServiceKind, freeHealing, freeMagickaRecharge, avoidDeath, AVOID_DEATH_TEXT } from '../systems/guildServices.js';
import { createGuildForGroup, ORDERS } from '../systems/guildVariants.js';
import { membershipOf, joinGuild, joinDecision, activeMemberships } from '../systems/guilds.js';   // V2e: GuildManager.Memberships, the per-read vampire book pick
import { ensureFactionRep } from '../systems/factionRep.js';
import { dateFromClassicMinutes, dateString, dayOfYearFromMinutes, MINUTES_PER_DAY, DAYS_PER_MONTH } from '../systems/gameDate.js';   // B2: the loan due date   // H1: the month the houses-for-sale list turns over on
import { serviceDestination } from '../systems/guildServiceFlow.js';
import { buildTrainingFlow, buildDonationFlow, buildCureDiseaseFlow } from '../ui/guildServiceWindows.js';
import { preloadListPickerArt } from '../ui/listPicker.js';
import { getTitle } from '../systems/guilds.js';
import { getDivine, DIVINES } from '../systems/guildVariants.js';
import { BUILDING_TYPES, isResidence, isTavern } from '../world/buildingNames.js';   // ROAD-B B4: IsTavern joins IsResidence at the door latch
import { getInteractionMode, setInteractionMode } from '../player/interactionMode.js';   // R1: PlayerActivate.currentMode, the one home
import { bindCursorToggle } from '../player/pointerLock.js';   // U45: PlayerMouseLook.cursorActive
import { buildingIsUnlocked, buildingLockValue, isBuildingOpen, LOCKED_EXTERIOR_DOOR_TEXT } from '../systems/buildingLocks.js';   // R1: opening hours + the unlocked ladder   // P1: the people gate reads the same hours
import { peopleAreVisible, updateNpcPresence } from '../characters/interiorPeople.js';   // P1: AddPeople's visibility tail   // ROAD-B B5: OnPop's presence re-roll
import { exteriorLockpickingChance, lookAtLockText, LOCKPICKING_SUCCESS_TEXT, LOCKPICKING_FAILURE_TEXT } from '../world/actionSystem.js';
import { tallyCrimeGuildRequirements } from '../systems/crimeGuilds.js';   // CG2: the break-in tally
import { theftBasket, privatePropertyTheft, shopShelfTheft } from '../systems/theft.js';   // PT1: the two stealing laws
import { buildingGreeting, shopQualityPresentation } from '../systems/buildingGreeting.js';   // BG1: the shop quality + the householder's greeting
import { discoverBuilding, undiscoverBuilding, getLastLockpickAttempt, setLastLockpickAttempt } from '../systems/discovery.js';   // H3: selling a house takes its name back off the map
import { BUILDING_KEY_0 } from '../systems/talkTopics.js';   // H3: the no-key key both ship interiors are filed under
import { getHolidayId } from '../systems/holidays.js';
import { guildOfFaction, isMember } from '../systems/guilds.js';
// V5: rest above ground. The window and the session have been finished
// since U7; what was missing was a host outside the dungeon that opens
// one, and CanRest's whole town half.
import { RestWindow, preloadRestArt } from '../ui/restWindow.js';   // D3: REST00I0/01I0/02I0
import { canRest, HAVE_NOT_RENTED_ROOM, REST_TEXT } from '../systems/restSession.js';
import { isPlayerInTown } from '../systems/nearbyObjects.js';
import { plainLines } from './shared.js';   // V5b: TEXT.RSC answers ROWS, and these windows iterate strings
import { hallAccessAnytime } from '../systems/guildServices.js';
import { resolveVariantGuild } from '../systems/guildVariants.js';
import { getBool, getInt } from '../systems/settings.js';   // R1: InstantRepairs / AllowMagicRepairs go LIVE
import { reducedRepairCost } from '../systems/guildServices.js';   // R1: FightersGuild.ReducedRepairCost finds its caller
import {
  calculateItemRepairCost, updateRepairTimes, repairJobsAt, repairRefusal, repairStatusLabel,
  isBeingRepaired, isRepairFinished, collectRepaired, calculateItemRepairTime, leaveForRepair,
  MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID, DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID, CANNOT_BE_REPAIRED_TEXT,
} from '../systems/repairService.js';
import { GuildServiceWindow, preloadGuildServiceArt, guildServiceArtLoaded } from '../ui/guildServiceWindow.js';
import { MerchantServiceWindow, preloadMerchantServiceArt, merchantServiceArtLoaded } from '../ui/merchantServiceWindow.js';   // UI2: the merchant's own panel
import { CovenWindow, preloadCovenArt, covenArtLoaded } from '../ui/covenWindow.js';   // CW1: DaggerfallWitchesCovenPopupWindow
import { openPauseFlow, preloadPauseFlowArt, pauseDoorReady } from '../ui/pauseDoor.js';   // I3/I4; U51 picks the skin
import { openPixelDial } from '../ui/pixelDial.js';   // PX15b: the Tab compass rose
import { preloadMessageBoxArt } from '../ui/messageBox.js';
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';
import { templateByIndex, itemBaseValue } from '../systems/itemTemplates.js';
import { questLetterName } from '../systems/itemInfo.js';   // ResolveItemLongName's quest-letter arm
import { goldAmount, totalGoldAmount, deductGold, addGold, setCrimeCommitted, CRIMES } from '../systems/court.js';   // PT1: the ONE crime write (V4's SuppressCrime gate rides it)
// Q4-v: the quest layer's host wiring. The BRIDGE (scenes/questBridge.js)
// is created by the outer host (world.js) and rides in; this machine owns
// the interior half - the click stamp, the Quests service arm, the scene
// mount adapter and the modal tick.
import { getReputation, getFlag, setFlag, FACTION_FLAGS } from '../systems/factionRep.js';
// G7: the last unbuilt guild service - the summoning calendar, the
// cost, Sheogorath's hijack and the roll.
import { daedraForSummoner, attemptSummoning, SUMMON_TEXT, DAEDRIC_FOES } from '../systems/daedraSummoning.js';   // IF: the punishment table
import { currentWeatherEnum, WEATHER_ENUM } from '../systems/weatherSim.js';
import { ServiceFlowWindow } from '../ui/guildServiceWindows.js';
import { hasCart } from '../systems/inventorySession.js';   // AUDIT 28 W2c: the exit-door wagon prompt's cart test
import { dungeonLocationFor } from '../world/smallerDungeons.js';   // AUDIT 28 W4: the size the dungeon is built at
import { dismountOnTransition } from '../systems/transport.js';   // TR5: the interior dismount
import { CANNOT_CHANGE_INDOORS } from '../ui/transportWindow.js';   // TR5: the indoors refusal
import { createUseMagicItemWindow } from '../ui/useMagicItemWindow.js';   // UI1: the U key's window
import { MoveAxes } from '../player/moveAxes.js';   // AUDIT 28 W8: MovementAcceleration
// U39: the tavern - the window, the knightly free-room perk and the
// two guild readers that recover the player's own order.
import {
  TavernWindow, preloadTavernArt, tavernArtLoaded,
  TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y,
} from '../ui/tavernWindow.js';
import { freeTavernRooms } from '../systems/guildServices.js';
// B2: the bank - the window, the per-region accounts and the purse seam.
import { BankWindow, preloadBankArt, bankArtLoaded, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../ui/bankWindow.js';
import { BankPurchaseWindow, preloadPurchaseArt, purchaseArtLoaded } from '../ui/bankPurchaseWindow.js';   // H2
import { createBankAccounts, createHouses, BANK_REGION_COUNT, TRANSACTION_RESULT, ownsHouse, isHouseOwned, ownedHouseKey, houseSellPrice, housesForSale, allocateHouseToPlayer, purchaseHouse, ownsShip, ownedShipType, purchaseShip, sellShip, sellHouse, SHIP_COORDS, SHIP_INTERIOR_MAP_IDS } from '../systems/banking.js';   // H1/H2   // H3: the two leaves - the sell price and the ship
// P1: the scene cache - what an interior remembers across a visit.
import {
  createSceneCache, cacheScene, restoreCachedScene,
  interiorSceneName, worldSceneName, LOOT_CONTAINER_TYPES, containsPermanentScene, addPermanentScene, removePermanentScene,
} from '../systems/sceneCache.js';
import { WORLD_CONTEXT } from '../systems/teleportAnchor.js';   // A10: SetAnchor's world context, one enum for the three hosts
// S40: resting where the player has a claim - the rented-room finder
// the tavern rents through, and FightersGuild.CanRest.
import { findRentedRoom, removeExpiredRooms } from '../systems/tavern.js';
import { canRest as guildCanRest } from '../systems/guildServices.js';
import { interiorRestPlace, restDecision, getPreventedRestMessage } from '../systems/restSession.js';   // CanRest's inside-a-building bag + the scene-free open gate above it   // ROAD-B B5: GetPreventedRestMessage
import { racialRestBlock } from '../systems/vampirism.js';   // V2b: the vampire's rest gate
import { setPassiveSpecialsHost, FIGHTER_TRAINERS_FACTION } from '../systems/passiveSpecials.js';   // V2c: the sunlight/holy-place seam
import { DaedraSummonedWindow, REFUSAL_FOE_COUNT, COVEN_FAIL_FOE_COUNT } from '../ui/daedraSummonedWindow.js';   // G7b: the summoning's own film window
import { orderOf } from '../systems/guildVariants.js';
import { joinedGuildOfGroup } from '../systems/guilds.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';
import { SpellMakerWindow } from '../ui/spellMakerWindow.js';   // S1: the Mages Guild / Kynareth spell maker
// M2: the potion maker - the other half of the guild's magic economy.
import { PotionMakerWindow, preloadPotionArt, potionArtLoaded } from '../ui/potionMakerWindow.js';
import { ItemMakerWindow, preloadItemMakerArt, itemMakerArtLoaded, ITEM_RECTS, rowLayout as itemMakerRowLayout } from '../ui/itemMakerWindow.js';
import { createPotion, getMagicItemTemplates } from '../systems/loot.js';   // M2: ItemBuilder.CreatePotion, one minter; G4: the MAGIC.DEF registry
import { SITE_TYPES } from '../systems/quest/place.js';
import { placeFoeFreely } from '../systems/quest/sceneMount.js';   // B1: CreateFoe's raycast ring, finally called
import { placeFoeEnv, entityOccupancy, questFoeGender } from './questFoeHost.js';   // B1 (PlaceFoeFreely reads the fieldOfView import below)
import { ENEMY_BASICS } from '../characters/enemyBasics.js';   // MERGE: FinalizeFoe's Flying lift reads the behaviour flag
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { positionHash, staticNpcData } from './questBridge.js';   // B7: the guild popup's TALK builds display data without re-registering the click
import { staticNpcName, getNameBankOfRegion, isChildNPCData } from '../characters/staticNpc.js';   // wave 24: StaticNPC.DisplayName
import { GENDERS } from '../characters/nameHelper.js';
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
import { windowEmissionRGB } from '../render/windowEmission.js';   // AUDIT 26 F001/F002: WindowStyle per host (DaggerfallInterior.cs:473/:517/:1270 vs GetMaterial's Day default)
let _charT0 = (typeof performance !== 'undefined' ? performance.now() : 0);
let _charAnimMode = 'idle'; // in-engine character animation: idle | walk | off (window.__anim)

// Dungeon water surface (R11 values, mirroring the dungeon scene).
// AUDIT EV F-R1: the modal frames' explicit "no exterior light in
// here" - hoisted, not minted per frame (the EV2 law).
const NO_INDIRECT_POS = [0, 0, 0];
const NO_INDIRECT_COLOR = new Float32Array(3);
const DUNGEON_WATER_COLOR = [1, 1, 1, 0.82];
const DUNGEON_WATER_SCROLL = 0.05;

// AUDIT 26 F079: CreateItem.lastSelectedIndex is ONE static shared by
// every cast in a run (CreateItem.cs:29, :75, :121). This host kept
// its own module copy and the dungeon host kept another, so casting
// in a dungeon and again outdoors opened at the OTHER host's row. The
// single static now lives with the law, in systems/createItem.js.

export function createWorldModes(host) {
  const _footsteps = new FootstepMachine();   // FS-slice: the modal stride (interior wood / dungeon stone + water)
  // AUDIT 18: the interior host's share of the player world clock.
  //
  // AUDIT 21 (hosts lane, F3): onLevelUp, through this host's own overlay
  // slot. Without it advancement.js took its headless arm and dumped every
  // attribute point into the LOWEST stats - standing in a shop when you
  // crossed a threshold built a different character than standing in a
  // dungeon. `interiorOverlay` is declared below and the closure only runs
  // once time has passed, so it is initialised by then.
  // AUDIT 21 (hosts lane, F6): the INTERIOR death presenter. Fall damage in a
  // building and the ticker's disease/poison sink both reach the one shared
  // damage door; without a presenter registered here the door had nothing to
  // call and you kept walking at 0 HP.
  //
  // dungeonContext registers its own on mount, which REPLACES this one - which
  // is right, since the dungeon owns the screen while it is up. The interior
  // arm re-registers below whenever it takes a frame, so leaving a dungeon
  // hands the presenter back.
  /** AUDIT 21 (hosts lane, F8): the swing-fatigue sink, matching the dungeon's
   *  (DecreaseFatigue with the x64 assign multiplier already inside the
   *  constant's home). AUDIT 23 (C5): every fatigue write runs the
   *  exhaustion law (DaggerfallEntity.cs:360-366) - the old comment
   *  claimed the ticker owned the collapse; nothing did. */
  let _inExhaustion = false;
  function onExhaustedInterior() {
    if (_inExhaustion) return;
    _inExhaustion = true;
    try {
      const out = exhaustionOutcome({
        enemiesNearby: interiorEnemiesNearby(), swimming: false, entity: playerEntity,
        day: false, inside: true,   // IF: a building interior CAN hold foes now; the feet stay dry
      });
      // ROAD-B B5: a PUSH. PlayerEntity's OnExhausted handler is a plain
      // DaggerfallUI.MessageBox, and DaggerfallUI.MessageBox is
      // `new DaggerfallMessageBox(...); mb.Show()` -> uiManager
      // .PushWindow (DaggerfallUI.cs:1330-1360) - it has never asked
      // whether something else is open. Collapsing from exhaustion
      // WITH A WINDOW UP is not exotic: the fatigue drain runs through
      // the inventory, the map and the spellbook alike, and the
      // refusal meant the one message that explains the lost hour (or
      // the drowning) was dropped.
      mountInterior(new ActionTextBox(out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.']));
      if (out.kind === 'rest') {
        interiorTicker.advance(60);
        playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
        playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
        playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
        tallySkill(playerEntity, SKILLS.Medical);
      } else {
        hurtPlayer(playerEntity, playerEntity.health, { bypassShield: true });   // SetHealth(0): no shield stands against the collapse
      }
    } finally { _inExhaustion = false; }
  }
  const drainInteriorFatigue = (n) => {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0) onExhaustedInterior();
  };
  const presentInteriorDeath = () => {
    // DC1: the LIVE eye and capsule, as PlayerEntity_OnDeath reads them
    // (`player` is the host destructure below; this runs at death, long
    // after it binds - the U45 TDZ shape only bites immediate reads).
    if (!(interiorOverlay instanceof DeathScreen)) interiorOverlay = new DeathScreen({ eyeHeight: player.eye[1] - player.pos[1], capsuleHeight: player.height, onReset: () => endRunToTitleMenu(renderer) });   // D1
  };
  // AUDIT 23 (hosts-1): this constructor runs AFTER the exterior host
  // registered its presenter, and used to overwrite it for good - a
  // death above ground presented nothing (the interior overlay only
  // draws in interior mode). The one registration now routes by LIVE
  // mode and hands exterior deaths back to the captured presenter.
  const prevDeathPresenter = setDeathPresenter(() => {
    if (mode === 'exterior' && prevDeathPresenter) return prevDeathPresenter();
    presentInteriorDeath();
  });
  // U45 - A LIVE BOOT CRASH, fixed by moving two declarations up.
  // `say` was READ here, in createPlayerTicker's options object, and
  // declared with `const` forty lines below - a temporal dead zone,
  // so createWorldModes threw `Cannot access 'say' before
  // initialization` on its first statement and bootExterior died with
  // it. The exterior host did not boot AT ALL. This is the third
  // instance of AUDIT 24 wave 37's shape (a reference above its own
  // declaration) and the first that was not merely latent, so the
  // wave-37 gate now covers this host too.
  //
  // The host destructure moves with it, because `say` closes over
  // `townTalk`. It reads only the function's own argument, so it is
  // safe anywhere inside the body.
  const { canvas, renderer, player, cam, keys, latch, blocks, pipeline, doorTargets, npcTargets = null, boardTargets = null, bulletinBoardNews = null, baseCollider, voxelfolk = false, piece = 0, paint = false, buildingDataForDoor = null, townTalk = null, magic = null, spellsByIndex = null, questBridge = null, questSceneCtx = null, npcSession = null, talkSave = null, onQuestRestored = null, discoveryLocationId = null, gps = null, buildingDirectory = null } = host;   // H1: the location's whole building list, for the houses-for-sale roll   // V5: gps = PlayerGPS's location reads, for CanRest   // R1: the discovery store's location key (the anti-grind record's namespace)   // B4: the quicksave composer's trio + the world host's _questStarted latch   // Q4-v: the quest bridge + the host's scene-context closure ({mapId, locationIndex})   // M2: the host's cast engine + SPELLS.STD getter ride in   // host.foes: C8 E1 rigged class enemies in dungeons; buildingDataForDoor: E2's shop identity closure; townTalk: U23's static-NPC seam
  const moveAxes = new MoveAxes();   // AUDIT 28 W8: MovementAcceleration - the modal frames' own axes
  // U43-ii: the interior HUD-text layer is the OUTER host's, and
  // always was - townTalk's hud draws above the modal render. The
  // "pends its arc" flag was a line of plumbing: a broken weapon, a
  // fatigue warning and a level-up all spoke to devtools while the
  // player stood in a shop with a HUD on screen.
  //
  // V4 found this one LIVE, which is the part worth keeping: the
  // first-hour probe started a new game and sat at `mode null` for
  // 420 seconds. Lint, the vite build and all 3005 tests were green
  // on it - a TDZ is legal syntax, the identifier IS bound, and
  // nothing in the suite executes a host constructor. test/tdz.test.js
  // is the gate for the whole class now: it parses src/ with rollup's
  // own parseAst and reports any const or let read in the SAME
  // execution scope as, and before, its declaration.
  const say = (l) => { if (townTalk?.say) townTalk.say(l); else console.warn('[interior]', l); };
  // V5's interiorRestDeps retired into the fuller one below (search
  // `place: interiorRestPlaceHere`), which carries the same two
  // host-only halves plus the place bag, MoveToBed, the quest tick and
  // the expired-room sweep. Its one note is RETIRED at IF: this host
  // mounts a foe pool now (see `interiorFoes`), so `enemiesNearby`
  // scans it through the one shared areEnemiesNearby instead of
  // answering a literal false.
  const interiorTicker = createPlayerTicker(playerEntity, {
    // CG2: this ticker IS the interior one - inside by construction, so
    // the crime-guild letter never arrives while the player is indoors
    // (HandleStartingCrimeGuildQuests' !IsPlayerInside gate). Written
    // rather than left to the default, because a default that happens
    // to be right is not the same as a law that is stated.
    isInside: () => true,
    onExhausted: onExhaustedInterior,   // AUDIT 23 (C5)
    say,
    onLevelUp: () => {
      say('You have gained a level!');
      // dfuiOpenCharacterSheetWindow (RaiseSkills :1414): the SHEET
      // levels the player in classic. This host builds no windows -
      // host.makeCharSheet is the outer host's own builder, the same
      // one toggleCharSheet mounts.
      if (!interiorOverlay) interiorOverlay = host.makeCharSheet?.() ?? new LevelUpScreen(playerEntity);
    },
  });

  // V1: the infection's host seam (THE FOUR HOSTS RULE). The interior
  // host borrows the exterior's townTalk for FACTION.TXT and TEXT.RSC,
  // exactly as U23's static-NPC seam does, and re-registers on entry
  // so a player who catches vampirism in a shop still dreams.
  wireInfectionVideos(renderer, {
    textAt: (id) => townTalk?.lines?.(id) ?? null,
    // ROAD-B B5: VampirismInfection's own DaggerfallUI.MessageBox - a
    // PUSH, the same conversion its dungeon twin took. A player who
    // turned with a shop's trade window open was never told.
    showText: (lines) => mountInterior(new ChoiceWindow({ lines })),
    factionDict: () => townTalk?.factionDict ?? null,
    // V2e: the outer host's cemetery arm rides through, or this
    // re-registration would silently drop it (world.js passes it;
    // exterior.js cannot arrive at another location and passes none).
    transferToCemetery: host.transferToCemetery ?? null,
  });

  // X4: the interior arm's Detect scan (see the frame body).
  //
  // DT1: BOTH pools were left empty here on the claim that this host
  // has nothing to put in them. It has had both for slices. The
  // entities are `interiorFoes` - a real foe pool since IF, carrying
  // quest foes and the Daedric punishment wave - and the loot is what
  // DaggerfallInterior.AddFurnitureAction (:780-841) hangs a
  // DaggerfallLoot on: shop shelves (:796-801, E2) and house
  // containers (:829-838, S2b), plus the corpse markers this pool
  // mints like any other. `GetActiveLoot()` (PlayerGPS.cs:765-776)
  // walks every one of them with no scene gate, so all three Detect
  // spells were blind inside a building.
  //
  // An UNBROWSED shelf contributes NOTHING, and that is DFU's answer
  // too rather than a port limit: AddFurnitureAction adds the empty
  // component and PlayerActivate.cs:881-886 stocks it on FIRST ACCESS,
  // so `Items.Count > 0` is false until the player has opened it and
  // GetLootFlags (:822-836) withholds the Treasure bit. `items: null`
  // is that same un-stocked state, and maps to a count of zero.
  //
  // ID1 closed the gap DT1 recorded here: the player's own dropped
  // piles are this host's now, so `piles` carries them exactly as the
  // other three hosts do.
  //
  // The thunks are lazy - `interiorCtx` and `interiorFoes` are
  // declared below and only read at tick time.
  const detectFeed = createDetectFeed(playerEntity, {
    entities: () => (interiorFoes?.foes ?? []).filter((f) => !f.dead && f.ai).map(foeNearbyRecord),
    loot: () => nearbyLootRecords({
      piles: interiorDropped._piles,
      containers: [...(interiorCtx?.shelves ?? []), ...(interiorCtx?.containers ?? [])],
      foes: interiorFoes?.foes ?? [],
    }),
    feet: () => player.pos,
  });
  // X7: set while an IDENTIFY SPELL's window is open ({chance, cost}),
  // null for the paid guild service. The trade window is one window
  // serving both, exactly as DFU's is.
  const { getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, arch, palette, getMachineryParts } = pipeline;

  /** ID1: THE INTERIOR'S OWN GROUND PILE.
   *
   *  `CreateDroppedLootContainer` (GameObjectHelper.cs:716-775) picks
   *  its parent BY CONTEXT - the Dungeon transform, the Interior
   *  transform, or the streaming target - and only the outdoor arm
   *  calls `TrackLooseObject` (:769-772). The port had two of the
   *  three: dungeonContext mounts its own pool, world.js and
   *  exterior.js mount the streaming one, and this host mounted
   *  none. So an item dropped inside a building fell through
   *  `host.makeInventory`'s onDrop to the WORLD pool, at the world
   *  host's `dropFeet()` - the EXTERIOR player, on the EXTERIOR
   *  collider - and was stamped with the map pixel that only the
   *  outdoor arm should carry, which enrols it in P2's out-of-range
   *  collection sweep. The item did not land where it was dropped,
   *  could not be picked back up indoors, and could be destroyed by
   *  a sweep DFU never runs on it.
   *
   *  Same factory as the other two hosts, this host's collider, and
   *  NO pixel key - that argument is `TrackLooseObject`, and DFU puts
   *  it behind `!IsPlayerInside`. */
  const interiorDropped = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });
  /** HE1: EnemyBlood.ShowBloodSplash, in the fourth host. The other
   *  three have mounted this pool since AUDIT 24 wave 39 and this one
   *  passed `hitEffects: null` into its foe pool with the absence
   *  RECORDED - so a blow landed inside a building drew no blood,
   *  while the identical blow one step outside the door did. Nothing
   *  new was needed: the factory takes the three handles this scope
   *  already destructures from the pipeline.
   *
   *  ONE pool for every building, not one per interior context, so it
   *  survives a door - which is why it needs the clear() below. */
  const interiorHitEffects = createHitEffects({ renderer, getTexture, uploadRecordFrame });
  /** PlayerMotor.FindGroundPosition, on the interior's own collider -
   *  the world host's `dropFeet` in this host's frame. */
  const interiorDropFeet = () => {
    const p0 = [...player.pos];
    const d = interiorCtx?.collider ? interiorCtx.collider.raycast(p0, [0, -1, 0], 10) : NaN;
    if (Number.isFinite(d)) p0[1] -= d;
    return p0;
  };
  /** ID1: EVERY inventory window this host opens, through one door,
   *  so a drop cannot fall back into the world pool from whichever
   *  call site the next slice adds. Two laws ride it: the drop mints
   *  HERE (with no pixel key - TrackLooseObject is the outdoor arm),
   *  and the close frees emptied containers, which is DFU's own
   *  moment (DaggerfallInventoryWindow.cs:697-722 mints and removes
   *  at the window, not at the last item). A caller's own onClose is
   *  COMPOSED rather than overwritten - `...extra` last would have
   *  silently dropped the free. */
  const interiorInventory = ({ onClose, ...extra } = {}) => host.makeInventory?.({
    onDrop: (items) => interiorDropped.dropPile(items, interiorDropFeet()),
    ...extra,
    onClose: () => { interiorDropped.releaseEmptied(); onClose?.(); },
  });
  // AUDIT 21 (hosts lane, F7): the HUD art for interior mode. A missing file
  // answers null and drawHud no-ops, so this host draws no HUD rather than
  // failing to mount.
  let hudArt = null;
  loadHud({ fetchBytes, ImgFile, palette, renderer }).then((a) => { hudArt = a; })
    .catch((e) => console.error('[hud]', e));


  let mode = 'exterior';
  let zPrev = false;   // ReadyWeapon (Z) edge state
  let hPrev = false;   // a12: SwitchHand (H) edge - RELEASED, not pressed (WeaponManager.cs:272)
  // C9: the INTERIOR mode's FP weapon (the dungeon context owns its
  // own audited copy; the host rule wants the weapon in every mode).
  const interiorWeapon = createWeaponRig({
    activateHeld: () => held(keys, 'ActivateCenterObject'),   // AUDIT 28 W12: the drawn bow's un-draw key
    spellArmed: () => magic?.spellArmed() ?? false,   // M2
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    // MW-D8: see world.js's twin note - the arm rides the eye, and the
    // dep is required so a missing one is a reason, never a wrong place.
    // MW-D10: rule 54's neck pitch; MW-D15: rule 32(a)'s sneak sink.
    camera: () => ({ pos: player.eyeAt(), yaw: cam.yaw, pitch: cam.pitch, sneaking: !!player.isSneaking,
      bob: [0, player.bobOffset ? player.bobOffset[1] : 0],   // IG1: the bob's vertical feeds the first-person offset
      move: { forward: player.moveForward || 0, strafe: player.moveStrafe || 0, running: !!player.isRunning, speed: player.moveSpeed || 0,
        grounded: player.grounded !== false, jumping: !!player.jumping, swimming: !!player.swimming, levitating: !!player.levitating } }),   // MW-D26: the movement-settings vector, the reference's own selection source; MW-D39 added the jump-state inputs (grounded/jumping/swimming/levitating)
    say,
  });
  // C13: the interior arrow flights (collider late-resolved - each
  // building brings its own).
  const interiorArrows = new ArrowFlight({ getGpuMesh: pipeline.getGpuMesh, collider: () => interiorCtx?.collider });
  let _arrowsCtx = null;
  let interiorCtx = null;
  /**
   * IF - THE INTERIOR FOE POOL. A building interior carries NO STATIC
   * ENEMIES in DFU: DaggerfallInterior's whole marker vocabulary is
   * `Rest, Enter, Treasure, LadderBottom, LadderTop`
   * (DaggerfallInterior.cs:63-70) - there is no enemy marker to read,
   * and no interior layout call that mints one. So this pool is not a
   * spawner; it is a HOME, for the two things that DO put an enemy
   * inside a building:
   *   - a quest's CreateFoe (PlaceFoeBuildingInterior, CreateFoe.cs:
   *     220-234, which is PlaceFoeFreely with the interior as parent -
   *     DFU's own comment rejects spawn points, "Feel just placing
   *     freely will yield best results overall")
   *   - the Daedra summoning window's refusal (G7b)
   *
   * It is the SAME pool factory the exterior encounter host mounts,
   * with this host's collider: that module never spawned encounters
   * of its own (every spawn is host-driven) and already takes its
   * collider as a parameter, so a fourth copy of the damage door, the
   * death chain and the corpse walk would have been exactly the
   * duplication the port's ONE HOME law forbids. Its one
   * exterior-shaped behaviour, the 120-unit relevance cull, is inert
   * inside a building - nothing indoors is ever that far from the
   * player - and `currentPixelKey` answers null, which is the same
   * arm exterior.js takes: a host whose corpses are never streamed
   * out of range never hands them to TrackLooseObject.
   *
   * LIFETIME: minted with the interior context and destroyed with it.
   * DFU's OnTransitionExterior tears the interior's enemies down the
   * same way, which is also why a quest wave pending inside a
   * building is invalidated by leaving.
   */
  let interiorFoes = null;
  /**
   * IF: CreateFoeSpawner's punishment wave - the summoning window's
   * refusal (DaggerfallDaedraSummonedWindow.cs:125) and the coven
   * failure's (DaggerfallQuestPopupWindow.cs:257) are the SAME call
   * with different numbers:
   *   refusal: daedricFoes[Range(0,5)], Range(3,6) foes, 8..64
   *   coven:   daedricFoes[Range(0,5)], Range(1,4) foes, 4..64
   * so one door takes them both. Placement is PlaceFoeFreely's ring,
   * which is what CreateFoeSpawner ends in.
   */
  function spawnDaedricPunishment({ count, minDistance, maxDistance, rolls = Math.random }) {
    if (!interiorCtx || !interiorFoes) return 0;
    const type = MOBILE_TYPES[DAEDRIC_FOES[Math.floor(rolls() * DAEDRIC_FOES.length)]];
    const feet = player.pos;
    let stood = 0;
    for (let i = 0; i < count; i++) {
      const env = placeFoeEnv({
        collider: interiorCtx.collider,
        playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
        playerYawRad: cam.yaw,
        fovDegrees: fieldOfView() * 180 / Math.PI,
        isOccupied: entityOccupancy((f) => f.ai?.feet, () => interiorFoes.foes, feet),
        rolls,
      });
      const spot = placeFoeFreely(env, { minDistance, maxDistance });
      if (!spot) continue;   // no room: this one simply does not stand, as DFU's spawner gives up
      interiorFoes.spawnFoe(type, [spot.x, spot.y, spot.z], {
        yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),
      }).catch((e) => console.error('[summon] daedra stand failed:', e?.message ?? e));
      stood++;
    }
    return stood;
  }

  /** IF: this host's enemies-nearby scan, which used to be the
   *  literal `false` three consumers each carried. GameManager
   *  .AreEnemiesNearby is one method over one database; the interior's
   *  database is its pool. An interior with no pool minted (no
   *  building entered) answers false because there is genuinely
   *  nothing there - not because the host cannot look. */
  const interiorEnemiesNearby = (opts = {}) => (interiorFoes ? areEnemiesNearby(interiorFoes.foes, opts) : false);

  /**
   * IF: CreateFoe's INTERIOR arm - PlaceFoeBuildingInterior
   * (CreateFoe.cs:220-234), which is PlaceFoeFreely over this
   * building's collider. The dungeon arm's twin, to the term.
   */
  function tryPlaceInteriorQuestFoe(handle) {
    if (!interiorCtx || !interiorFoes) return false;   // retry next machine tick, verbatim
    const feet = player.pos;
    const env = placeFoeEnv({
      collider: interiorCtx.collider,
      playerFeet: [feet[0], feet[1] + 0.9, feet[2]],   // the controller centre, not the feet
      playerYawRad: cam.yaw,
      fovDegrees: fieldOfView() * 180 / Math.PI,       // the law speaks DEGREES
      isOccupied: entityOccupancy((f) => f.ai?.feet, () => interiorFoes.foes, feet),
    });
    const spot = placeFoeFreely(env);
    if (!spot) return false;
    const foe = handle.foe;
    // FinalizeFoe (:341-359): a FLYING foe is lifted 1.5 off the test
    // point; a walker keeps the floor the probe found.
    const _fly = (ENEMY_BASICS[foe.foeType]?.behaviour ?? 'General') === 'Flying';
    interiorFoes.spawnFoe(foe.foeType, [spot.x, _fly ? spot.y + 1.5 : spot.y, spot.z], {
      gender: questFoeGender(foe),
      yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player (:328)
      questBehaviour: handle.behaviour,
    }).catch((e) => console.error('[quest] interior foe stand failed:', e?.message ?? e));
    return true;
  }

  /** Mint the pool over THIS interior's collider. Called at the mount,
   *  torn down with the context. */
  function makeInteriorFoes(ctx) {
    return createExteriorFoes({
      renderer, collider: ctx.collider, fetchBytes, getTexture, uploadRecordFrame,
      playerEntity, audio,
      // HE1: and the blood it draws. This was `null` with the absence
      // recorded; the pool is mounted now, so the whole payload -
      // sound, knockback, death, corpse, loot AND the splash - runs
      // indoors exactly as it does in the other three hosts.
      hitEffects: interiorHitEffects,
      playerWeaponSheathed: () => !!interiorWeapon.playerWeapon.sheathed,
      currentMinute: () => Math.floor(interiorTicker.classicMinutes),
      // exterior.js's arm, and for the same reason: a host whose
      // corpses never leave streaming range hands nothing to
      // TrackLooseObject (GameObjectHelper.cs:836-839).
      currentPixelKey: () => null,
      playerSinks: interiorTicker.sinks,
      // ROAD-B: DaggerfallEntityBehaviour.cs:255-258 - striking a
      // non-hostile foe turns the whole area. Inside a building the
      // area IS this pool (the street's two pools are a different
      // scene, and the exterior host does not tick them while the
      // player is indoors), so the walk is the pool's own list.
      makeAreaHostile: () => makeEnemiesHostile(interiorFoes?.foes ?? []),
      say: (l) => say(l),
      onPlayerHurt: (dmg, wpn) => {
        if (dmg <= 0) return;
        hurtPlayer(playerEntity, dmg);
        audio.playOneShot(hitSoundFor(wpn), 1.1);
        playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
        surfacePlayer();
      },
      // C13: the interior's own arrow flight, the seam this host
      // already owns for the player's bow.
      onArrow: (from, dir, f) => {
        interiorArrows.fire(from, dir, { enemy: true, shooterFoe: f, weapon: f.entity.weapon });
        audio.play3d(SOUND.ArrowShoot, from, 1, { maxDistance: 16 });
      },
      // AUDIT 39 (#39): the MAGIC half of the same payload. SetEnemySpells
      // runs inside SetEnemyCareer on every construction (EnemyEntity
      // .cs:453-461) with no scene test, so a foe standing in a shop
      // owes its spell lists and its EnemyCaster exactly as one in the
      // street does - and without the lists the S19 monster paralyze
      // rider had no Spider Touch to free-cast either. Both deps were
      // in scope at the host destructure the whole time.
      spellsByIndex,
      magicHooks: magic ? {
        explodeAt: (...a) => magic.explodeAt(...a),
        // world.js's arm, minus its walk-mode gate: the interior frame
        // runs magic.update itself, so a missile loosed here flies.
        fireMissile: (from, spell, casterLevel, foe) => {
          const d = [player.pos[0] - from[0], player.pos[1] + 0.9 - from[1], player.pos[2] - from[2]];
          const l = Math.hypot(...d) || 1;
          magic.fireEnemyMissile(from, [d[0] / l, d[1] / l, d[2] / l], spell, casterLevel, foe);
        },
      } : null,
    });
  }
  /** ROAD-B: THE WATCH, INDOORS. PlayerEntity.SpawnCityGuards' FIRST
   *  arm (:628-642) stands 2-5 Knight_CityWatch at the interior's
   *  lowest outer door when the crime happened in an open shop, a
   *  tavern or a residence - and RETURNS, so the street arm never
   *  runs for those buildings. world.js flagged this as unreachable
   *  because "this host's pool is the exterior street, so the watch is
   *  waiting outside"; the pool it needed is this one. Same lifetime
   *  and same teardown as interiorFoes - PlayerEnterExit's
   *  OnTransitionExterior takes the interior's enemies with it, and
   *  the watch are enemies. */
  let interiorGuards = null;
  /** IF/ROAD-B: the interior's senses context, built once per frame
   *  and handed to BOTH pools. `candidates` is this host's whole
   *  active-enemy database (MT's join): a watchman called into a shop
   *  and a summoned daedra standing in it are one database, exactly as
   *  the street's two pools are one for the exterior host. */
  const _interiorSenses = () => sensesContext(playerEntity, interiorTicker.classicMinutes, {
    movingLessThanHalfSpeed: player.movingLessThanHalfSpeed ?? true,
    candidates: () => [...(interiorFoes?.foes ?? []), ...(interiorGuards?.guards ?? [])].filter((f) => !f.dead),
    playerEntity,
  });
  function makeInteriorGuards(ctx) {
    return createCityGuards({
      renderer, collider: ctx.collider, fetchBytes, getTexture, uploadRecordFrame,
      playerEntity, audio,
      hitEffects: interiorHitEffects,
      playerWeaponSheathed: () => !!interiorWeapon.playerWeapon.sheathed,
      currentMinute: () => Math.floor(interiorTicker.classicMinutes),
      // interiorFoes' arm, for the same reason: a host whose corpses
      // never leave streaming range hands nothing to TrackLooseObject.
      currentPixelKey: () => null,
      say: (l) => say(l),
      onPlayerHurt: (dmg, wpn) => {
        if (dmg <= 0) return;
        const apply = () => {
          hurtPlayer(playerEntity, dmg);
          audio.playOneShot(hitSoundFor(wpn), 1.1);
          playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
          surfacePlayer();
        };
        // G2: the arrest interception is the WORLD host's (it owns the
        // court flow and the overlay it opens), so the indoor watch
        // asks for it through the host seam rather than growing a
        // second copy. A host that does not offer one just deals the
        // damage, which is the pre-arrest shape.
        if (!(host.onGuardHit?.(dmg, apply) ?? false)) apply();
      },
    });
  }
  // E2: the entered building's identity + the shop browse overlay.
  let interiorBuilding = null;
  /** ROAD-B B4: PlayerEnterExit.IsPlayerInsideTavern / IsPlayerInsideResidence
   *  (PlayerEnterExit.cs:160-170). Plain auto-properties, "set upon entry"
   *  by PlayerActivate.TransitionInterior (:1121-1122) - NOT live reads of
   *  the current building, which is why they live beside the mode's own
   *  state rather than being derived at every call.
   *
   *  VERBATIM QUIRK, preserved: DFU clears IsPlayerInsideTavern at BOTH
   *  exits (:874 on the exterior transition, :1112 on the dungeon one) and
   *  never clears IsPlayerInsideResidence at either - the residence latch
   *  is only ever overwritten by the next TransitionInterior. It is benign
   *  in DFU because its one consumer (PlayerEntity.cs:630) is gated on
   *  IsPlayerInside first, but it is the behaviour, so it is the port. */
  let _insideTavern = false;
  let _insideResidence = false;
  // IS1: the entered exterior door - SetExteriorDoors (PlayerEnterExit
  // .cs:469) latches it through RespawnPlayer and TransitionInterior
  // so the save can carry the way back in (SerializablePlayer
  // .cs:183-187). Cleared with interiorBuilding at every exit.
  let exteriorDoor = null;
  /** GetNameBankOfCurrentRegion (PlayerGPS.cs:421-427) - F016. An
   *  unknown region answers Breton, which is DFU's own fallback. */
  const currentNameBank = () => getNameBankOfRegion(
    interiorBuilding?.regionIndex ?? buildingDirectory?.()?.regionIndex ?? -1);

  let interiorOverlay = null;
  /** ROAD-B B1: ...and the DEPTH under it. `interiorOverlay` stays the
   *  live slot every draw, click and drain in this file already reads;
   *  the stack (UserInterfaceManager.cs, ported in ui/windowStack.js)
   *  carries what is SUSPENDED beneath it and writes the slot back
   *  through `onTop` whenever the top changes. mountInterior pushes,
   *  the ~30 `interiorOverlay = null` close paths keep working
   *  untouched, and `interiorWindows.reconcile` reads the slot back
   *  once a frame and turns "the slot went empty" into PopWindow - so
   *  the window the box was laid over comes back. */
  const interiorWindows = makeWindowStack({ onTop: (w) => { interiorOverlay = w; } });
  // V2c: THE SUNLIGHT SEAM (THE FOUR HOSTS RULE). This host owns the
  // mode machine for BOTH town pages - world.js and exterior.js each
  // build it at boot - so the one registration here answers
  // IsPlayerInside/holy-place/dungeon for all three modes, routed by
  // LIVE mode (the death-presenter lesson: never latch a mode).
  // The dungeon branch's own dungeonContext re-registers on build and
  // restores this one on destroy.
  setPassiveSpecialsHost({
    now: () => Math.floor(interiorTicker.classicMinutes),   // a VIEW on the one world clock
    isInside: () => mode !== 'exterior',
    inDungeon: () => mode === 'dungeon',
    // PlayerEnterExit.cs:371 - `IsDay && !IsPlayerInside &&
    // !PlayerEntity.InPrison`. This seam used to be left absent with
    // the note that "the port serves a sentence as a clock move, never
    // as a live scene the sun could reach into"; the sentence is a
    // live screen now (DaggerfallCourtWindow's state 3, ui/prisonScreen
    // .js) and the flag it sets is real, so the read is real too - a
    // vampire does not burn in a cell.
    inPrison: () => !!playerEntity.inPrison,
    // PlayerEnterExit.cs:1424-1431: a Temple-type building, or the
    // Fighter Trainers' faction - DFU's own quirky pair.
    isHolyPlace: () => mode === 'interior' && !!interiorBuilding
      && (interiorBuilding.buildingType === BUILDING_TYPES.Temple
        || interiorBuilding.factionId === FIGHTER_TRAINERS_FACTION),
    isSwimming: () => !!player?.swimming,
  });
  /** X11b: mount a modal into whichever slot the CURRENT mode draws.
   *  See the note on openCreateItemPicker for what this fixed. */
  function mountSpellWindow(win) {
    if (mode === 'dungeon') return dungeonCtx?.showOverlay ? dungeonCtx.showOverlay(win) : false;
    if (mode === 'interior') {
      if (interiorOverlay) return false;
      interiorOverlay = win;
      return true;
    }
    if (townTalk?.overlayActive) return false;
    townTalk?.showOverlay?.(win);
    return true;
  }
  /** ...and clear whichever slot that window went into. A window's own
   *  onPick/onCancel calls this rather than nulling interiorOverlay,
   *  which was only ever right in one of the three modes.
   *
   *  The DUNGEON arm is deliberately a no-op: that context drains its
   *  own slot when a window raises `done` (dungeonContext.tickOverlay),
   *  and ListPickerWindow raises it inside _pick - so clearing here as
   *  well would only race its own drain. */
  function closeSpellWindow(win) {
    if (interiorOverlay === win) { interiorOverlay = null; return; }
    if (mode !== 'dungeon') townTalk?.closeOverlay?.(win);
  }
  let _shopFont = null;
  const ensureShopFont = () => {
    preloadTradeArt({ renderer, fetchBytes, palette });   // U8c: the trade screen art rides shop entry too
    if (_shopFont) return;
    fetchBytes('FONT0003.FNT')
      .then((b) => { _shopFont = makeFont(renderer, new FntFile().load(b), 'FONT0003'); })
      .catch(() => console.warn('[shop] FONT0003.FNT unavailable; the shelf browse is disabled'));
  };
  // U23: the guild popup's own art. It rides EVERY interior entry, not
  // just a shop's - a guild hall, a temple and a knightly order are
  // none of them shops, and the popup is the only window they open.
  const ensureInteriorWindowArt = () => {
    ensureShopFont();                                       // FONT0003 + the trade art
    preloadGuildServiceArt({ renderer, fetchBytes, palette });
    preloadMerchantServiceArt({ renderer, fetchBytes, palette });   // UI2: GNRC01I0, beside its guild sibling
    preloadCovenArt({ renderer, fetchBytes, palette });   // CW1: DAED00I0 for the witches' panel
    preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));   // I3/I4
    preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11 parchment for its boxes
    preloadListPickerArt({ renderer, fetchBytes, palette });   // U24: PICK00I0 for the training skill list
    preloadTavernArt({ renderer, fetchBytes, palette });   // U39: TVRN00I0 for the innkeeper's panel
    preloadRestArt({ renderer, fetchBytes, palette });   // D3: REST00I0/01I0/02I0 for the rest window's two pages
    preloadBankArt({ renderer, fetchBytes, palette });   // B2: BANK00I0 for the teller's screen
    preloadPurchaseArt({ renderer, fetchBytes, palette });   // H2: BANK01I0 for the house market
    preloadPotionArt({ renderer, fetchBytes, palette });   // M2: MASK00I0 for the cauldron
    preloadItemMakerArt({ renderer, fetchBytes, palette });   // M4: ITEM00I0 + the gold tab strip
    preloadSpellbookArt({ renderer, fetchBytes, palette })   // U42: SPBK00I0 (cast) + SPBK01I0 (the guilds' buy mode)
      .catch((e) => console.warn('[spellbook] classic spellbook art unavailable:', e?.message ?? e));
    preloadAutomapArt({ renderer, fetchBytes, palette })   // ROAD-C c2/S9: AMAP00I0 + AMAP01I0 - the map opens inside a building too
      .catch((e) => console.warn('[automap] native map art unavailable; keyed fallback:', e?.message ?? e));
  };

  // X11c: WARM THE WINDOW ART AT BOOT, not only on interior entry.
  // These windows used to belong to buildings - a shop's trade screen,
  // a guild's service list - so warming them when the player walked
  // through a door was exactly right. Then spells started opening
  // them: Identify's window is a SPELL's, castable in the street or in
  // a dungeon by a character who has never been indoors, and
  // `tradeArtLoaded()` answered false for that player and the cast was
  // refused. Same silently-dead shape the Create Item picker's art was
  // guarded against one lane earlier, at the other end of the same
  // seam. The loaders are all idempotent, so interior entry still
  // calls this and still costs nothing the second time.
  ensureInteriorWindowArt();

  // ---- Q4-v: THE QUEST LAYER'S INTERIOR MOUNT -----------------------
  // Q4-iii's addQuestResourceObjects walk runs over this adapter when a
  // building interior is entered (and again on the machine's hot-place
  // callback), standing quest Persons and Items as billboard batches in
  // the LIVE interior context - the flats idiom, async-filled off the
  // texture cache. Each stand carries its QuestResourceBehaviour: the
  // behaviours drive every modal frame (Unity Update), an E-click
  // routes DoClick, and the interior teardown notifies destruction
  // exactly as Unity's OnDestroy does on a scene transition.
  // IF: quest FOES stand inside a building too now. This adapter's
  // standFoe was absent for one stated reason - "the INTERIOR enemy
  // host" - and that host exists (see `interiorFoes`), so the walk no
  // longer skips the stand. It is the SECOND of DFU's two quest-foe
  // paths into a building: this one is AddQuestResourceObjects at
  // LAYOUT time (PlayerEnterExit.cs:797-800) and on Place.cs's
  // hot-place (:508-521), where CreateFoe's TryPlacement is the
  // other. The dungeon mount (B2 below) is its twin.
  let questFlats = [];          // interior stands (the click sites index this list)
  let interiorFoeStands = [];   // IF: behaviours standFoe accepted, listed before the async build lands
  let dungeonQuestFlats = [];   // B2: dungeon stands, same record shape
  /** `inDungeon` is not decoration - it selects the ANCHOR.
   *  AddQuestNPC raises the billboard by half its height
   *  `if (!inDungeon)` (GameObjectHelper.cs:1032-1036), and DFU's
   *  billboard is CENTRE-anchored, so the base ends up ON the marker
   *  inside a building and half a height BELOW it inside a dungeon.
   *  This port's billboard shader is BOTTOM-anchored (position = base,
   *  the C11 law dungeonContext.js:1325 states), so the same visual
   *  result needs the shift on the DUNGEON side - which is exactly the
   *  shift the dungeon's own RDB flats already take
   *  (dungeonContext.js:1243, `y - size.h / 2`), and which a building's
   *  flats correctly do not (interiorContext.js passes its centers
   *  straight through).
   *
   *  Without it every quest NPC and item in a dungeon hangs half a
   *  sprite too high - and a distant screenshot passes that, exactly
   *  as it passed a vertically flipped billboard for six milestones. */
  /** AddQuestItem's dungeon shift (GameObjectHelper.cs:1135-1136):
   *  `-DaggerfallLoot.randomTreasureMarkerDim / 2 * MeshReader
   *  .GlobalScale` = -(40 / 2) * 0.025 = -0.5, a CONSTANT and not a
   *  function of the sprite. RDBLayout.cs:1584 applies the same one to
   *  the loot piles. */
  const QUEST_ITEM_MARKER_SHIFT = 0.5;

  function standQuestFlatIn(list, getCtx, toScene, inDungeon, archive, record, position, behaviour, staticNpcFactionId = null, hashPosition = null, isItem = false) {
    const ctx = getCtx();   // capture: an async fill must not cross scenes
    if (!ctx) return null;
    // flatPosition is already scene units with -y (the Place marker
    // law); the interior parents it exactly as its own flats are, the
    // dungeon's marker position IS scene space (dungeonX/Z * RDBSide
    // + flatPosition, markerScenePosition's law).
    const [x, y, z] = toScene(ctx, position);
    // AUDIT 24 (wave 22): `hashPosition` is marker.flatPosition, which
    // is what GameObjectHelper.cs:1062 hands SetLayoutData - NOT the
    // target position it stood the billboard at. The two are the same
    // inside a building (dungeonX/dungeonZ are 0), and differ by a
    // whole RDB block once the dungeon mount lands, which would have
    // given the NPC a different hash - and therefore a different
    // nameSeed fallback and a different generated NAME - than DFU.
    const stand = { ctx, archive, record, x, y, z, marker: hashPosition ?? position, width: 0, height: 0, batch: null, active: true, dead: false, behaviour };
    (async () => {
      const t = await getTexture(archive);
      if (!t || record >= t.recordCount || stand.dead || getCtx() !== ctx) return;
      uploadRecord(archive, record);
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      stand.width = size.w; stand.height = size.h;
      // AUDIT 26 F068: an ITEM and an NPC are stood by DIFFERENT laws.
      // The old comment here said AddQuestNPC and AddQuestItem "both
      // call" the align; only AddQuestNPC does (:1040).
      //
      // AddQuestItem (GameObjectHelper.cs:1128-1141) NEVER rays. Its
      // dungeon shift is the CONSTANT
      // `-randomTreasureMarkerDim / 2 * GlobalScale` (:1135-1136) -
      // the treasure marker's centre origin, -0.5 flat, nothing to do
      // with the sprite's own height - and then `+= Size.y / 2` lifts
      // the CENTRE, which in this port's base-anchored terms cancels
      // out. So the item's base sits at the marker, half a unit down
      // in a dungeon, and an item on a table, cage or ledge STAYS UP
      // where the port's ray snapped it to the floor below.
      let by;
      if (isItem) {
        by = inDungeon ? y - QUEST_ITEM_MARKER_SHIFT : y;
      } else {
        // AlignBillboardToGround (:335-345) with distance 4: a ray
        // from 0.2 above the billboard's CENTRE, and on a hit the
        // centre goes to hit + size.y * 0.52 - so a bottom-anchored
        // base sits size.y * 0.02 off the floor, the 2% lift that
        // keeps it out of the ground plane. No floor within 4 and the
        // marker position stands as-is (C# returns without moving).
        //
        // F069: the ray starts at the CENTRE, not the base. The port
        // rayed from `by + 0.2` - half a sprite lower - so a tall
        // dungeon NPC could start its ray below a surface DFU clears
        // and miss the snap entirely, standing embedded.
        by = inDungeon ? y - size.h / 2 : y;
        const origin = by + size.h / 2 + 0.2;
        const drop = ctx.collider?.raycast?.([x, origin, z], [0, -1, 0], 4);
        if (Number.isFinite(drop)) by = (origin - drop) + size.h * 0.02;
      }
      stand.y = by;
      stand.batch = renderer.createBillboardBatch(archive, record, size, [[x, by, z]]);
      if (stand.active) ctx.billboardBatches.push(stand.batch);
    })().catch((e) => console.error('[quest] stand fill failed:', e));
    const unhook = () => {
      if (!stand.batch) return;
      const i = ctx.billboardBatches.indexOf(stand.batch);
      if (i >= 0) ctx.billboardBatches.splice(i, 1);
    };
    stand.host = {
      staticNpcFactionId,   // DoClick's individual broadcast reads this
      setActive(active) {
        active = !!active;
        if (stand.active === active || stand.dead) return;
        stand.active = active;
        if (!active) unhook();
        else if (stand.batch && getCtx() === ctx) ctx.billboardBatches.push(stand.batch);
      },
      destroy() {
        if (stand.dead) return;
        stand.dead = true;
        unhook();
        if (stand.batch) { renderer.destroyBatch(stand.batch); stand.batch = null; }
        const i = list.indexOf(stand);
        if (i >= 0) list.splice(i, 1);
      },
    };
    list.push(stand);
    return stand.host;
  }
  const standQuestFlat = (...args) =>
    standQuestFlatIn(questFlats, () => interiorCtx, (ctx, p) => ctx.parentPt(p.x, p.y, p.z), false, ...args);
  const standDungeonQuestFlat = (...args) =>
    standQuestFlatIn(dungeonQuestFlats, () => dungeonCtx, (_ctx, p) => [p.x, p.y, p.z], true, ...args);
  /** DQ1: a quest stand's activation target, for whichever list the
   *  host keeps. Extracted at DQ1 because the DUNGEON ray needed the
   *  same walk and the alternative was a second copy of it - the shape
   *  of the stand record is identical in both lists by construction
   *  (standQuestFlatIn builds both). */
  const questFlatTargets = (list) => {
    const out = [];
    list.forEach((s, i) => {
      if (!s.width || !s.active || s.dead) return;
      const isPerson = s.behaviour?.targetResource?.isPerson === true;
      out.push({
        key: `questflat:${i}`,
        aabb: { min: [s.x - s.width / 2, s.y, s.z - s.width / 2], max: [s.x + s.width / 2, s.y + s.height, s.z + s.width / 2] },
        distance: isPerson ? STATIC_NPC_ACTIVATION_DISTANCE : DEFAULT_ACTIVATION_DISTANCE,
      });
    });
    return out;
  };
  /** DQ1: and the click itself. `buildingKey` is the one thing that
   *  differs between the hosts - StaticNPC reads it from the runtime
   *  data (:299-306), and a dungeon has no building, so it is 0 there
   *  exactly as mapID is 0 in both. */
  const clickQuestFlat = (s, buildingKey) => {
    if (!s) return;
    // PlayerActivate.StaticNPCClick:1521 stamps LastNPCClicked BEFORE
    // the behaviour click - the quest NPC's StaticNPC peer carries
    // SetLayoutData(marker position, person) (GameObjectHelper:1062 ->
    // StaticNPC.cs:245-255): the hash from the SCALED marker ints
    // truncated, flags/nameSeed from the Person (-1 falls back to the
    // hash), buildingKey from the runtime data, mapID never written.
    const person = s.behaviour?.targetResource;
    if (questBridge && person?.isPerson) {
      const hash = positionHash(Math.trunc(s.marker.x), Math.trunc(s.marker.y), Math.trunc(s.marker.z));
      // AUDIT 24 (the seven-slice sweep): through the bridge's
      // SetLayoutData, not a hand-rolled literal. The literal carried
      // eight of NPCData's thirteen fields - no race (so QuestMCP.Oath's
      // clicked-NPC arm, the one the main quests lean on before a
      // questor is set, read undefined every time) and no context.
      questBridge.machine.setLastNPCClicked(questBridge.layoutNpcData({
        hash,
        gender: person.gender,
        factionID: person.factionId ?? 0,
        nameSeed: person.nameSeed ?? -1,
        buildingKey,
        mapID: 0,
      }));
    }
    // AUDIT 24 (wave 25): PlayerActivate keeps DoClick's bool. The
    // quest-resource arm (:326-339) calls it and FALLS THROUGH to the
    // building/door/NPC checks either way, and StaticNPCClick
    // (:1525-1528) returns only when it answered TRUE. Here the stand
    // is the only thing under the ray, so there is nothing to fall
    // through to - recorded rather than silently dropped, because the
    // value is what says whether any live quest owned the click.
    const foundInActiveQuest = s.behaviour?.doClick() ?? false;
    if (!foundInActiveQuest) {
      console.log('[quest] clicked a stand no active quest claims (DFU would fall through to the world here)');
    }
  };
  const questAdapter = {
    // PlayerGPS.CurrentMapID through the host's scene-context closure.
    currentMapId: () => questSceneCtx?.()?.mapId ?? 0,
    findBehaviours: () => sceneBehaviours(),
    loadInProgress: () => false,   // the modal host builds after a restore completes
    standNPC: ({ marker, person, flatData, position, behaviour }) =>
      standQuestFlat(flatData.archive, flatData.record, position, behaviour, person?.factionId ?? null, marker?.flatPosition ?? null),
    standItem: ({ item, position, behaviour }) => {
      // AddQuestItem draws the item's WORLD texture (the ground sprite).
      const t = templateByIndex(item.daggerfallUnityItem?.templateIndex);
      if (!t) return null;
      // F068: an item is placed, not aligned - no ray.
      return standQuestFlat(t.worldTextureArchive, t.worldTextureRecord, position, behaviour, null, null, true);
    },
    // IF: the marker-time stand, the dungeon adapter's twin.
    standFoe: ({ foe, gender, position, behaviour }) => {
      if (!interiorCtx || !interiorFoes) return null;
      interiorFoeStands.push(behaviour);
      interiorFoes.spawnFoe(foe.foeType, interiorCtx.parentPt(position.x, position.y, position.z), {
        gender, questBehaviour: behaviour,
      }).catch((e) => console.error('[quest] interior marker foe failed:', e?.message ?? e));
      return null;   // the async build binds the host; addQuestFoe's start() runs either way
    },
  };
  /** SetupIndividualStaticNPC's call site (DaggerfallInterior.cs:1224),
   *  handed to buildInteriorContext so it runs at AddPeople's own
   *  moment - per person, at the GameObject, before the quest walk.
   *  An individual the quest moved elsewhere is deactivated (the away
   *  arm's SetActive(false)); an individual at home ALWAYS gets a
   *  behaviour, which is what makes the follow-up-quest bootstrap
   *  click land. A machine-less host answers nothing and every person
   *  stays as it was. */
  const setupStaticNpc = (pn, host) =>
    questBridge?.machine.setupIndividualStaticNPC(host, pn.factionID) ?? true;
  /** Every QuestResourceBehaviour standing in this scene:
   *  Resources.FindObjectsOfTypeAll<QuestResourceBehaviour>()
   *  (GameObjectHelper.cs:917) sees the ones on static NPCs too, and
   *  IsAlreadyPlaced reads exactly this list - miss them and a Person
   *  the bootstrap behaviour already holds gets stood a SECOND time by
   *  the marker walk. */
  const sceneBehaviours = () => {
    const out = questFlats.map((s) => s.behaviour);
    for (const pn of interiorCtx?.people ?? []) if (pn.questBehaviour) out.push(pn.questBehaviour);
    for (const b of interiorFoeStands) out.push(b);   // IF: the marker-stood foes, as the dungeon walk does
    return out;
  };
  /** The building-interior mount; also the machine's hot-place callback
   *  (deps.world.mountCurrentSiteQuestResources - Place.AssignQuest-
   *  Resource's isPlayerHere tail re-runs the walk mid-scene). */
  function mountQuestResources() {
    if (!questBridge) return;
    // B2: the machine's hot-place callback is mode-aware - Place.
    // AssignQuestResource's isPlayerHere tail re-runs the walk for
    // whichever site the player stands in.
    if (dungeonCtx && mode === 'dungeon') {
      questBridge.mountScene(dungeonQuestAdapter, SITE_TYPES.Dungeon, 0);
      return;
    }
    if (!interiorCtx || !interiorBuilding?.buildingKey) return;
    questBridge.mountScene(questAdapter, SITE_TYPES.Building, interiorBuilding.buildingKey);
  }

  // ---- B2 (AUDIT 25 blocker 2): THE DUNGEON HALF OF THE SCENE MOUNT.
  // AddQuestResourceObjects(SiteTypes.Dungeon) (Place.cs:511-533): the
  // same walk as the building mount over a dungeon-space adapter -
  // markerScenePosition already spans blocks (dungeonX/Z * RDBSide),
  // so the stand parents nowhere and the point IS scene space. Foes
  // stand as REAL enemies through the context's one build chain (B1's
  // spawnQuestFoe); the async build binds the behaviour host, and
  // addQuestFoe's own start() covers the window before it lands.
  // DQ1 closed the note that stood here: the dungeon E-ray routes
  // quest stands now, through the same two helpers the interior arm
  // uses, so "clicked npc" and "clicked item" fire underground.
  let dungeonFoeStands = [];   // behaviours standFoe accepted, listed before the async build lands
  const dungeonSceneBehaviours = () => {
    const out = dungeonQuestFlats.map((s) => s.behaviour);
    for (const b of dungeonFoeStands) out.push(b);
    return out;
  };
  const dungeonQuestAdapter = {
    currentMapId: () => questSceneCtx?.()?.mapId ?? 0,
    findBehaviours: () => dungeonSceneBehaviours(),
    loadInProgress: () => false,
    standNPC: ({ marker, person, flatData, position, behaviour }) =>
      standDungeonQuestFlat(flatData.archive, flatData.record, position, behaviour, person?.factionId ?? null, marker?.flatPosition ?? null),
    standItem: ({ item, position, behaviour }) => {
      const t = templateByIndex(item.daggerfallUnityItem?.templateIndex);
      if (!t) return null;
      // F068: an item is placed, not aligned - no ray.
      return standDungeonQuestFlat(t.worldTextureArchive, t.worldTextureRecord, position, behaviour, null, null, true);
    },
    standFoe: ({ foe, gender, position, behaviour }) => {
      if (!dungeonCtx) return null;
      dungeonFoeStands.push(behaviour);
      dungeonCtx.spawnQuestFoe({
        mobileType: foe.foeType, gender,
        position: [position.x, position.y, position.z], behaviour,
      }).catch((e) => console.error('[quest] dungeon marker foe failed:', e?.message ?? e));
      return null;   // the async build binds the host; addQuestFoe's start() runs either way
    },
  };
  function teardownDungeonQuestFlats() {
    for (const s of [...dungeonQuestFlats]) s.behaviour?.notifyDestroyed?.();
    for (const s of dungeonQuestFlats) {
      s.dead = true;
      if (!s.batch) continue;
      const i = s.ctx.billboardBatches.indexOf(s.batch);
      if (i >= 0) s.ctx.billboardBatches.splice(i, 1);
      renderer.destroyBatch(s.batch);
      s.batch = null;
    }
    dungeonQuestFlats = [];
    dungeonFoeStands = [];
  }
  function teardownQuestFlats() {
    // Unity's OnDestroy on scene transition: notify each behaviour (the
    // resource-side handler decouples), then free the batches - pulled
    // out of the context's list FIRST so ctx.destroy() cannot free them
    // a second time.
    for (const s of [...questFlats]) s.behaviour?.notifyDestroyed?.();
    // the bootstrap behaviours ride their StaticNPC's GameObject, so
    // the scene transition destroys them on the same frame
    for (const pn of interiorCtx?.people ?? []) {
      if (!pn.questBehaviour) continue;
      pn.questBehaviour.notifyDestroyed?.();
      pn.questBehaviour = null;
    }
    for (const s of questFlats) {
      s.dead = true;
      if (!s.batch) continue;
      const i = s.ctx.billboardBatches.indexOf(s.batch);
      if (i >= 0) s.ctx.billboardBatches.splice(i, 1);
      renderer.destroyBatch(s.batch);
      s.batch = null;
    }
    questFlats = [];
    interiorFoeStands = [];   // IF
  }

  // E2: the shelf browse/buy chain (DFU's trade window collapsed to
  // our keyed-window idiom; haggling is the fixed CalculateTradePrice
  // buy price - the offer/counteroffer UI pends). Stock is lazy per
  // shelf (StockShopShelf on first activation); buying deducts gold
  // and moves the item into the player entity.
  // ItemHelper.ResolveItemLongName (:335-348): a quest Parchment reads
  // as its used-message signoff, not as "Parchment" - two letters from
  // two quests are otherwise the same word in every list.
  const _itemLabel = (it) => questLetterName(it, (uid) => questBridge?.machine.getQuest(uid) ?? null)
    ?? it.name ?? templateByIndex(it.templateIndex)?.name ?? it.group;
  /** BS1: the book reader on a bare id - the bookshelf picks by id,
   *  and makeOpenBookHook reads item.message, so a `{ message }`
   *  wrapper IS the item. Mounts into this host's own overlay slot
   *  (bookshelves are interior-only, one host). */
  const _openBookById = makeOpenBookHook({ fetchBytes, showReader: (w) => { interiorOverlay = w; } });
  /** BS1: DaggerfallBookshelf.ReadBook (:66-89) on the shelf the click
   *  hit. The guild is the BUILDING faction's, resolved the way
   *  GetGuild(factionID) resolves DFU's; only a GuildHall or Temple
   *  consults it (a Library is public). The book list is Start()'s
   *  ten draws, minted lazily per shelf - the same lazy-per-activation
   *  idiom the shop shelves stock by - and a pick opens the reader on
   *  the id (BookShelf_OnItemPicked, :91-96). */
  function openBookshelf(shelf, b) {
    const dict = townTalk?.factionDict ?? null;
    const bf = b.factionId ? (dict?.get(b.factionId) ?? null) : null;
    const guild = bf ? createGuildForGroup(bf.ggroup, b.factionId, dict) : null;
    const membership = guild ? membershipOf(activeMemberships(playerEntity), guild) : null;
    const access = bookshelfAccess({ buildingType: b.buildingType, guild, membership });
    if (!access.allowed) {
      interiorOverlay = new ActionTextBox([access.text]);   // DaggerfallUI.MessageBox(accessMembersOnly)
      return;
    }
    shelf.books ??= populateBookshelf();
    if (!listPickerArtLoaded()) return;   // no art, no window (the U8 idiom)
    let picker = null;
    picker = new ListPickerWindow({
      items: bookshelfTitles(shelf.books),
      onPick: (i) => {
        // PopWindow then OpenBook + the reader push (:93-95): the
        // picker yields, the reader arrives on the fetch.
        if (interiorOverlay === picker) interiorOverlay = null;
        _openBookById({ message: shelf.books[i] });
      },
      onCancel: () => { if (interiorOverlay === picker) interiorOverlay = null; },
    });
    interiorOverlay = picker;
  }
  function openShelf(i) {
    const b = interiorBuilding;
    const shelf = interiorCtx?.shelves[i];
    if (!b || !shelf) return;
    if (!isShop(b.buildingType)) {
      // BS1: a shelf model inside a LIBRARY, GUILDHALL or TEMPLE is a
      // BOOKSHELF (DaggerfallInterior.cs:808-814) - the same model a
      // shop makes loot shelves of. (An OWNED house's shelf never
      // reaches here - HC1 births it a container at build.)
      if (b.buildingType === BUILDING_TYPES.Library || b.buildingType === BUILDING_TYPES.GuildHall
        || b.buildingType === BUILDING_TYPES.Temple) openBookshelf(shelf, b);
      return;
    }
    // A2: PlayerActivate.ActivateLootContainer's ShopShelves arm
    // (:881-886) - "Stock shop shelf on first access" is DFU's own
    // comment and DFU's own understatement, because the test is a DAY
    // comparison and not a null latch. StockShopShelf CLEARS the
    // collection before it mints (:153), so a shelf picked bare
    // yesterday is full again this morning and a shelf opened twice in
    // one afternoon does not reroll. The `??=` that stood here stocked
    // once per interior BUILD, which made the whole economy static:
    // every shop in the world held whatever it rolled the first time
    // the player walked in, for ever.
    const today = stockedToday();
    if (needsRestock(shelf, today)) {
      shelf.stockedDate = today;
      shelf.items = stockShopShelf({ buildingType: b.buildingType, quality: b.quality }, playerEntity);
    }
    // AUDIT 26 F066: DFU NEVER opens a paying trade window in a
    // closed shop. PlayerActivate gates shelf activation on
    // IsPlayerInsideOpenShop (:887-899) - open opens Buy, CLOSED
    // opens the inventory in shelf-STEALING mode
    // (SetShopShelfStealing): the shelf is the Remove-mode remote and
    // taking is stealing. The port's inventory-with-loot shape IS
    // that window, and PT1 gave it the consequence below.
    if (b.insideOpenShop === false) {
      // PT1: SetShopShelfStealing's other half, at the window's own
      // teardown (:681-687). No roll, no guards, no crime record - a
      // COUNT comparison against the shelf as it stood when the window
      // opened, and a Thieves Guild tally if it shrank. The flag that
      // used to sit here promised "the shoplifting ROLL and its crime
      // tally"; the roll belongs to the house-container arm and never
      // to this one.
      const shelfBefore = shelf.items.length;
      const win = interiorInventory({
        loot: { items: () => shelf.items },
        onClose: () => {
          if (shopShelfTheft(shelfBefore, shelf.items.length)) tallyCrimeGuildRequirements(playerEntity, true, 1);
        },
      });
      if (win) interiorOverlay = win;
      return;
    }
    // U8c: the native trade screen when the art is up (the E2/E3
    // loop on INVE00I0 + TRAD00I0 + SHOP00I0; keyed fallback stays)
    if (tradeArtLoaded()) {
      interiorOverlay = openTradeWindow(shelf, b, 'Buy');
      return;
    }
    showShelfList(shelf, 0);
  }

  /** U40: the merchant's own Sell screen. DFU's merchant popup sells
   *  into the SHOP rather than into a shelf, so the goods land on the
   *  building's own collection - the same place the shelf flow puts
   *  them, which is what makes a sold item buyable back. A building
   *  with no shelf yet gets one lazily, exactly as openShelf does. */
  function openMerchantSell() {
    const b = interiorBuilding;
    if (!b || !tradeArtLoaded() || !_shopFont) return false;
    const shelf = (interiorCtx?.shelves ?? [])[0] ?? (interiorCtx ? (interiorCtx.shelves ??= [])[0] : null);
    const target = shelf ?? { items: null };
    // A2: the same stockedDate gate the shelf arm takes - this IS that
    // shelf, and a merchant screen opened on a new day must find the
    // new day's stock rather than yesterday's leavings.
    const today = stockedToday();
    if (needsRestock(target, today)) {
      target.stockedDate = today;
      target.items = isShop(b.buildingType)
        ? stockShopShelf({ buildingType: b.buildingType, quality: b.quality }, playerEntity)
        : [];
    }
    let win = null;
    win = openTradeWindow(target, b, 'Sell');
    // NOTE (found wiring X6): this assignment is INERT. NativeTradeWindow
    // never calls hooks.onClose - it sets `done` on Escape/E and the
    // frame's sweep at :2450/:2517 frees the slot. Left in place because
    // it is harmless and the sweep already does the job, but do not copy
    // it expecting a callback: a trade window that needs cleanup on
    // close has to hang it off the sweep, not off this hook.
    win.hooks.onClose = () => { if (interiorOverlay === win) interiorOverlay = null; };
    interiorOverlay = win;
    return true;
  }

  /** U40: ONE opener for all five modes. The window owns the staging;
   *  the host owns the collections it stages BETWEEN and the
   *  transaction that concludes. `shelf.items` is DFU's remoteItems in
   *  Buy mode and the place sold goods land in Sell mode - the same
   *  shelf either way, which is what makes buy-backs work. */
  /** X11c: `identifySpell` is the Identify SPELL's per-cast latch
   *  ({ chance, cost }), or null for the PAID service and for every
   *  other mode. It used to be MODULE state (`_identifySpell`) cleared
   *  by four separate `interiorOverlay?.done` drains - which is what
   *  chained the Identify window to the interior slot and made this
   *  lane's routed half. The commit closure below is already built per
   *  window, so the latch simply lives in it: its lifetime IS the
   *  window's, by construction, and no drain has to remember it. */
  function openTradeWindow(shelf, b, mode, { guildFactionId = null, identifySpell = null } = {}) {
    const skills = () => ({
      mercantile: skillValue(playerEntity, SKILLS.Mercantile),
      personality: playerEntity.stats?.personality ?? 50,
    });
    return new NativeTradeWindow({
      mode,
      shelfItems: () => shelf.items,
      // AUDIT 17e F4: an EQUIPPED item never reaches either list -
      // selling a worn item left equip.slots pointing at it.
      // DFU hands the window the LIVE collection (DaggerfallTradeWindow
      // .cs:389 `localItems = PlayerEntity.Items`) and TransferItem
      // (:795) moves a clicked item OUT of it there and then. A
      // filtered view cannot be spliced, so on this side the staged lot
      // is a SELECTION over the pack and commitTrade owns the removal
      // at the concluded deal (:1036-1051). FLAGGED: the equipped test
      // is the WINDOW's in DFU (FilterLocalItems :693 `!item.IsEquipped`
      // in every mode); moving it there is what would let this hand
      // over the live array and transfer at the click. Until that
      // happens the WINDOW owes the selection its own guard, and has
      // one: localList drops what is already staged (AUDIT 39 F102),
      // which is what DFU's splice does for FilterLocalItems.
      packItems: () => (playerEntity.items ??= []).filter((it) => !isEquipped(it)),
      accepts: (it) => shopBuysItem(b.buildingType, it),
      enchanted: (it) => isEnchanted(it),
      isBeingRepaired: (it) => isBeingRepaired(it),
      allowMagicRepairs: getBool('Controls', 'AllowMagicRepairs'),
      priceCtx: () => ({
        quality: b.quality ?? 0,
        priceAdjustment: regionPriceAdjustment(playerEntity, b.regionIndex ?? 0),
        // UNLIKE the tavern's meal, this one reads the player's REAL
        // region (:437), so a regional holiday actually lands.
        holidayId: getHolidayId(Math.floor(worldMinutes()), b.regionIndex ?? 0),
        // G4 SHIPPED THE GUILD STORE ARM. It had stood null since U40,
        // which meant buyHolidayHalvesPrice's Mages Guild clause -
        // Tales and Tallow halving the price of anything bought AT the
        // Mages Guild - had never had a caller able to satisfy it.
        // `guildFactionId` is a real parameter of openTradeWindow now
        // and every guild service that opens the window supplies the
        // guild's own id (Identify, Buy, SellMagic below); a
        // high-street shop still passes null, because a shop belongs
        // to no guild.
        guildFactionId,
        skills: skills(),
      }),
      gold: () => goldAmount(playerEntity),
      rows: (id, pick) => townTalk?.lines?.(id, pick) ?? [],
      cityName: () => townTalk?.cityName?.() ?? (interiorBuilding?.name ?? ''),
      weight: () => ({
        carriedWeightKg: totalWeight(playerEntity.items ?? []),
        maxEncumbranceKg: entityMaxEncumbrance(playerEntity),   // DaggerfallTradeWindow.cs:1039 reads PlayerEntity.MaxEncumbrance
      }),
      commit: (m, staged, price, proceeds) => commitTrade(shelf, m, staged, price, proceeds, identifySpell),
      icons: { getTexture, uploadRecord, textures: renderer.textures },
      entity: playerEntity,   // AUDIT 17f: icons address for the wearer's morphology
      shopName: b.name ?? '',
    });
  }

  /** ConfirmTrade_OnButtonClick's Yes arm (:1027-1092), host side.
   *  One Mercantile tally per CONCLUDED DEAL, not per item - DFU
   *  raises OnTrade once and tallies once, however many goods moved. */
  function commitTrade(shelf, mode, staged, price, proceeds, identifySpell = null) {
    if (mode === 'Buy') {
      deductGold(playerEntity, price);
      for (const it of staged) {
        const i = shelf.items.indexOf(it);
        if (i >= 0) shelf.items.splice(i, 1);
        addItem(playerEntity.items, it);
      }
    } else if (mode === 'Sell' || mode === 'SellMagic') {
      // The proceeds were weighed before they were paid: a purse that
      // would push the player past MaxEncumbrance becomes a letter of
      // credit instead. B2 gave it its destination - DepositAll_LOC
      // (banking.js:461, DaggerfallBankingWindow :377-389) takes EVERY
      // letter in the pack at face value - so the note that once stood
      // here saying there was nowhere to cash one is retired.
      if (proceeds?.kind === 'letterOfCredit') {
        playerEntity.items.unshift(letterOfCredit(proceeds.amount));
      } else {
        addGold(playerEntity, price);
      }
      // TransferItem(item, localItems, remoteItems) (:795) takes the
      // goods OUT of the player's collection when they are staged, and
      // the confirm then clears the remote lot (:1051). The staging
      // list here is a selection over the live pack (see packItems), so
      // both halves land at the deal - without the removal the player
      // was paid full price and kept the item, over and over.
      for (const it of staged) {
        const i = playerEntity.items.indexOf(it);
        if (i >= 0) playerEntity.items.splice(i, 1);
        shelf.items.push(it);   // sold goods land on the open shelf
      }
    } else if (mode === 'Repair') {
      deductGold(playerEntity, price);
      const now = Math.floor(worldMinutes());
      for (const it of staged) {
        // ClearSelectedItems (:601-610) returns everything NOT actively
        // being repaired, so an instant repair is the item back in the
        // player's hands and a booked one stays with the shop. The
        // staged item never left the pack here (see packItems), so the
        // instant arm mends it in place: the addItem that stood for
        // that return aliased it into the pack a second time.
        if (getBool('Controls', 'InstantRepairs')) { it.currentCondition = it.maxCondition; continue; }
        leaveForRepair(it, interiorBuilding?.buildingKey ?? 0,
          calculateItemRepairTime(it.currentCondition ?? 0, it.maxCondition ?? 0), now);
        // AUDIT 26 F070: ConfirmTrade's Repair arm runs
        // UpdateRepairTimes(true) over remoteItemsFiltered - EVERY job
        // at this shop plus the new one (:1060-1072 -> :514-568), which
        // is what makes the longest-job queue stretch and the
        // never-decrease clamp real laws rather than dead arms of a
        // one-item list. This arm booked each item on its own time and
        // would have diverged the day the native window is opened in
        // Repair mode; the keyed choice flow has applied the queue law
        // since R1 and is the only live path today.
        const bk = interiorBuilding?.buildingKey ?? 0;
        updateRepairTimes([...repairJobsAt(playerEntity, bk, now), it], { commit: true, nowMinutes: now, buildingKey: bk });
      }
    } else if (mode === 'Identify') {
      // X7: two Identify paths through one arm, as DFU has them. The
      // SERVICE charges gold and identifies everything staged; the
      // SPELL rolls per item against its own chance and spends
      // magicka ONCE for the whole list, whatever the outcome
      // (DaggerfallTradeWindow.cs:966-991).
      if (identifySpell) {
        // AUDIT 26 F067: the SPELL runs DoModeAction (:954-995), a
        // path that never reaches ConfirmTrade at all. Two laws come
        // with that. First its magicka refusal (:960-963) turns back
        // the WHOLE pass - nothing identified, nothing spent - and
        // AUDIT 39 F144 answers it FALSE to the window, because DFU
        // returns before ClearSelectedItems: the lot stays staged for
        // a caster who steps out and comes back with the points.
        if (identifySpell.cost > (playerEntity.magicka ?? 0)) {
          townTalk?.say?.(NOT_ENOUGH_SPELL_POINTS_TEXT);
          surfacePlayer();
          return false;
        }
        const pass = identifySpellPass(staged, identifySpell.chance, Math.random);
        for (const it of pass.identified) it.isIdentified = true;
        if (pass.spendMagicka) {
          playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - identifySpell.cost);
        }
        townTalk?.say?.(identifiedTallyText(pass.successCount, pass.total));
        // ...and second, the Mercantile tally below is ConfirmTrade's
        // (:1088), which the spell path never reaches. The paid
        // SERVICE does tally - it goes through ConfirmTrade's own
        // Identify arm (:1074-1082) like every other mode.
        surfacePlayer();
        return;
      } else {
        deductGold(playerEntity, price);
        for (const it of staged) it.isIdentified = true;
      }
      // The confirm only calls IdentifyItem over the staged lot
      // (:1075-1080); the goods go back to the player when the window
      // closes (ClearSelectedItems :613-626 `localItems.TransferAll`).
      // Here they never left the pack (see packItems), so the addItem
      // that stood for that return aliased each item into it a second
      // time - and doubled the count of anything stackable.
    }
    tallySkill(playerEntity, SKILLS.Mercantile, 1);
    surfacePlayer();
  }

  // U8c: the transaction core, shared by the keyed windows and the
  // native trade screen. doBuy returns the price or null (can't
  // afford); doSell always sells.
  function doBuy(shelf, it) {
    const price = buyPrice(it);
    if (goldAmount(playerEntity) < price) return null;
    deductGold(playerEntity, price);
    shelf.items.splice(shelf.items.indexOf(it), 1);
    playerEntity.items = playerEntity.items || [];
    addItem(playerEntity.items, it);
    tallySkill(playerEntity, SKILLS.Mercantile, 1);   // per completed trade (DFU OnTrade)
    surfacePlayer();
    return price;
  }
  function doSell(shelf, it) {
    const price = sellPrice(it);
    // AUDIT 17e F4: selling a WORN item left equip.slots pointing at
    // it - a permanent armor bonus and an FP rig still swinging the
    // sold weapon. The lists no longer offer worn gear; this is the
    // belt-and-braces release.
    if (isEquipped(it)) unequipSlot(playerEntity, it.equipSlot);
    addGold(playerEntity, price);
    playerEntity.items.splice(playerEntity.items.indexOf(it), 1);
    shelf.items.push(it);   // sold goods land on the open shelf (DFU's remoteItems)
    tallySkill(playerEntity, SKILLS.Mercantile, 1);
    surfacePlayer();
    return price;
  }
  // AUDIT 17e F2/F3: the buy branch used to fall back to value 1 and
  // omit the stack multiplier while the SELL branch fell back to
  // itemBaseValue and multiplied - two unbounded gold loops (sell a
  // looted daedric weapon for thousands, it lands on the shelf, buy
  // it back for 1; or buy a 20-arrow stack for the price of one).
  // Both branches now share one value resolution (DFU's item.value,
  // which every item carries once minted) and the stack multiplier.
  function itemValue(it) { return it.value ?? itemBaseValue(it); }
  function buyPrice(it) {
    const b = interiorBuilding;
    const cost = calculateCost(itemValue(it), b.quality, regionPriceAdjustment(playerEntity, b.regionIndex ?? 0)) * (it.stackCount ?? 1);
    return calculateTradePrice(cost, b.quality, {
      mercantile: skillValue(playerEntity, SKILLS.Mercantile),
      personality: playerEntity.stats?.personality ?? 50,
    }, false);
  }
  // E3: the sell offer - CalculateCost(value)*stack through the
  // SELLING branch of CalculateTradePrice (DaggerfallTradeWindow's
  // GetTradePrice; DFU's condition parameter is declared-but-unused).
  function sellPrice(it) {
    const b = interiorBuilding;
    const cost = calculateCost(itemValue(it), b.quality, regionPriceAdjustment(playerEntity, b.regionIndex ?? 0)) * (it.stackCount ?? 1);
    return calculateTradePrice(cost, b.quality, {
      mercantile: skillValue(playerEntity, SKILLS.Mercantile),
      personality: playerEntity.stats?.personality ?? 50,
    }, true);
  }
  // ── U23: THE STATIC NPC SEAM ────────────────────────────────────
  // PlayerActivate.ActivateStaticNPC/StaticNPCClick (:742-766,
  // :1512-1607). Until now the people standing in a building interior
  // were scenery: interiorContext spawned them (C1) and nothing could
  // click one. They are activation targets now, at DFU's own
  // StaticNPCActivationDistance (256 classic units, twice a door's).
  //
  // AUDIT 26 (F019/F190): ...and the STREET's static NPCs, which
  // RMBLayout stands the same way (RMBLayout.cs:366-378 / :442-454 -
  // any block flat with a non-zero FactionID). The port collected them
  // through a function nothing called, so above ground the ray met
  // only doors. Both people paths now reach THIS routing, which is
  // DFU's shape: StaticNPCClick is one method and it reads
  // IsPlayerInsideBuilding (:1541-1543) rather than being wired twice.
  //
  // THE FOUR HOSTS, named:
  //   - scenes/worldModes.js      WIRED (here), both modes: the
  //     interior ray (tryExit) and the exterior one (tryEnter).
  //   - scenes/exterior.js        WIRED - it owns the location's RMB
  //     blocks, so it collects their exterior NPCs and hands them over
  //     as `npcTargets` (world frame).
  //   - scenes/world.js           WIRED - the same collection per
  //     streamed pixel, shifted through the live floating origin.
  //   - scenes/dungeonContext.js  N/A. Dungeons are RDB, and neither
  //     RMBLayout member runs there: a dungeon's static NPCs come from
  //     RDB flat resources through StaticNPC.cs's OTHER overload
  //     (:139-160, Context.Dungeon), and there are no
  //     blockPeopleRecords either. A quest Person placed in a dungeon
  //     is the quest machine's, and B2/DQ1 shipped that half:
  //     mountQuestResources routes dungeon mode to
  //     questBridge.mountScene(dungeonQuestAdapter, Dungeon, 0) above,
  //     whose standNPC is AddQuestNPC's `inDungeon` arm.
  //   - scenes/interior.js / scenes/dungeon.js  N/A - the standalone
  //     ?interior and ?dungeon scenes lay out ONE building interior /
  //     one dungeon and never an RMB block's exterior.
  //
  // FLAGGED, above ground only, each with the DFU line it owes:
  //   - QuestMachine.SetupIndividualStaticNPC (RMBLayout.cs:376/:447),
  //     the third thing layout does to an exterior NPC. The interior
  //     path runs it at DFU's own moment (interiorContext's people
  //     walk) because the interior is built long after the quest
  //     bridge exists; the exterior blocks are laid out BEFORE it in
  //     both hosts (world.js builds the start pixel first), so there
  //     is no machine to ask yet and doing it at click time would be
  //     the wrong moment - the away arm's SetActive(false) has to take
  //     the billboard out of the batch at layout. The click still
  //     stamps LastNPCClicked and still honours a faction listener.
  //   - the GUILD SERVICE popup, if a street NPC ever carries a guild
  //     service faction: its window and every window it dispatches to
  //     mount in `interiorOverlay`, which only the interior/dungeon
  //     frame draws. Talk, the quest offer and the refusals all mount
  //     where the current mode draws.
  //
  // The routing law is systems/guildServiceFlow.js; this end owns only
  // the geometry, the faction lookups and the window.
  const personAabb = (pn) => ({
    min: [pn.x - pn.width / 2, pn.y, pn.z - pn.width / 2],
    max: [pn.x + pn.width / 2, pn.y + pn.height, pn.z + pn.width / 2],
  });

  /** The live date the guild rank gate reads (S28). AUDIT 21 F2 made
   *  every ticker a VIEW on one absolute world clock, so this reads
   *  straight through - the epoch is already in it, and S28's
   *  elapsed-minute bridge is retired. */
  const gameDate = () => dateFromClassicMinutes(interiorTicker.classicMinutes);

  /** A2 - DaggerfallLoot.CreateStockedDate over the live date (:68-71).
   *  PlayerActivate's three loot arms read it on EVERY activation
   *  (:882 shelves, :907 the owned latch, :911 house containers), so
   *  it is spelled once here and not three times below. */
  const stockedToday = () => createStockedDate(gameDate());
  /** ActivateBulletinBoard (PlayerActivate.cs:706-739), verbatim: the
   *  reach gate first, then the mill's SIGN face, then the box.
   *
   *  The rumour comes back as TOKENS already macro-expanded by
   *  GetNewsOrRumorsForBulletinBoard (:1378-1380), and DFU heads them
   *  with the location's name - so the sign reads as a town notice
   *  rather than a floating sentence. A town whose mill has nothing
   *  fit for a sign STILL opens the box (:727 only guards the second
   *  half): the name alone, which is the sign standing empty. */
  function activateBulletinBoard(aabb, eye, dir) {
    if (!aabb) return;
    // :709-713 - `hit.distance > MobileNPCActivationDistance` speaks
    // the mid-screen refusal and returns. The pick reached to
    // RayDistance, so this is the board's own second test.
    const d = rayAabb(eye, dir, aabb);
    if (d === null || d > BULLETIN_BOARD_ACTIVATION_DISTANCE) {
      townTalk?.say?.(TOO_FAR_AWAY_TEXT);
      return;
    }
    // PlayerGPS.CurrentLocalizedLocationName (:721). Standing in the
    // wilderness there is no directory and no name - the head row is
    // then empty, which is what C#'s own empty CurrentLocationName
    // would give (no board stands out there to click regardless).
    const locationName = buildingDirectory?.()?.locationName ?? '';
    // DaggerfallUI.MessageBox(tokens) (:738) - the composition, the
    // token->row law and the starter-label drop all live in
    // systems/bulletinBoard.js; this end owns only the window.
    const rows = bulletinBoardRows(locationName, bulletinBoardNews?.() ?? null, tokenRows);
    townTalk?.showOverlay?.(new ChoiceWindow({ lines: rows.map((r) => r.text) }));
  }


  function activateStaticNpc(pn) {
    if (!pn) return;
    // ASYNC NEVER DROPS: FACTION.TXT may still be loading on the first
    // click of a session. ensureFactions coalesces, so the click lands
    // when the file does rather than being swallowed.
    Promise.resolve(townTalk?.ensureFactions?.()).then(() => openStaticNpc(pn)).catch(() => {});
  }

  function openStaticNpc(pn, { forceTalk = false } = {}) {
    // Q4-v: PlayerActivate's questor half - EVERY static-NPC click
    // stamps LastNPCClicked before the routing decides what opens (the
    // Person questor sweep rides machine.setLastNPCClicked).
    // The answer is StaticNPC.Data (SetLayoutData, StaticNPC.cs:210-224)
    // and it is this NPC's identity from here down: the seed the talk
    // engine keys by, the faction it reads, the race it stamps. A host
    // with no bridge mounted derives the same record itself rather than
    // going without one - C# has no null for the struct.
    // AUDIT 26 (F019): ...and WHICH overload derived it. A building's
    // person takes SetLayoutData(obj, buildingKey) (StaticNPC.cs:165-179),
    // which stamps Context.Building and the entered building's key; a
    // street NPC takes the exterior overload (:180-207), which stamps
    // Context.Custom over buildingKey 0 - and outdoors there is no
    // entered building, so the key below is already 0. The record the
    // exterior host stood carries its own context; a building person
    // has none and takes staticNpcData's Building default.
    const npcSceneCtx = {
      ...(questSceneCtx?.() ?? {}), buildingKey: interiorBuilding?.buildingKey ?? 0,
      ...(pn?.context != null ? { context: pn.context } : {}),
    };
    const npcData = questBridge?.clickNpc(pn, npcSceneCtx) ?? staticNpcData(pn, npcSceneCtx);
    // AUDIT 24 (wave 20): PlayerActivate.cs:1523-1528, the return the
    // port never had. A clicked NPC whose GameObject carries a
    // QuestResourceBehaviour goes through DoClick FIRST, and a click
    // that landed on a live quest resource ENDS the activation - no
    // talk window, no guild service popup. The port stamped
    // LastNPCClicked and walked straight on to the routing, so handing
    // a questor their letter also opened their shop.
    if (pn.questBehaviour?.doClick()) return;
    // PlayerActivate.cs:1530-1535: a quest actively LISTENING on this
    // NPC's faction (WhenNpcIsAvailable) shuts down all further
    // routing - no talk, no service popup, nothing (C#'s own TODO
    // about releasing listeners rides with it).
    if (questBridge?.machine.factionListeners.has(pn.factionID)) return;
    const dict = townTalk?.factionDict ?? null;
    const npcFaction = dict?.get(pn.factionID) ?? null;
    const buildingFactionId = interiorBuilding?.factionId ?? 0;
    const route = staticNpcRoute({
      npcFactionId: pn.factionID,
      npcFaction,
      buildingFaction: buildingFactionId ? (dict?.get(buildingFactionId) ?? null) : null,
      buildingType: interiorBuilding?.buildingType ?? -1,
      insideBuilding: !!interiorBuilding,
      isShop,
      isRepairShop,
      isBank: (t) => t === BUILDING_TYPES.Bank,
      isTavern: (t) => t === BUILDING_TYPES.Tavern,
    });
    if (route.kind === 'guildService') { openGuildService(pn, route, npcData); return; }
    // CW1: the coven's own popup (StaticNPCClick's WitchesCoven arm).
    if (route.kind === 'witchesCoven') { openWitchesCoven(pn, npcData); return; }
    // R1: the repair-shop merchant (DaggerfallMerchantRepairPopupWindow
    // - Armorer/GeneralStore/WeaponSmith per RMBLayout.IsRepairShop).
    // The popup carries THREE buttons (:82-97): Repair (the window's
    // list), Talk (T - re-runs this routing with the merchant arm
    // skipped and menu:true, TalkButton_OnMouseClick :143-148), and
    // and Sell, which U40 landed - the popup's third button opens the
    // trade window in Sell mode. The banking arm landed at B2 (it is
    // the next arm below); the tavern's landed with U39.
    if (!forceTalk && route.kind === 'merchant' && route.service === 'repair') {
      openRepairService({
        onTalk: () => openStaticNpc(pn, { forceTalk: true }),
        onSell: () => openMerchantSell(),
      });
      return;
    }
    // UI2: DaggerfallMerchantServicePopupWindow. DFU never opens the
    // trade or bank window off a merchant click - it opens the two-row
    // GNRC01I0 panel, and the SERVICE BUTTON opens the window
    // (:104-108). The port jumped straight to the window, so the
    // merchant's own panel, and its Talk row, never appeared.
    if (!forceTalk && route.kind === 'merchant'
      && (route.service === 'banking' || route.service === 'sell')
      && merchantServiceArtLoaded() && _shopFont) {
      const banking = route.service === 'banking';
      mountInterior(new MerchantServiceWindow({
        service: banking ? 'Banking' : 'Sell',
        onTalk: () => openStaticNpc(pn, { forceTalk: true }),
        onService: () => { if (banking) openBank(); else openMerchantSell(); },
      }));
      return;
    }
    // B2: DaggerfallBankingWindow. The routing has answered 'banking'
    // since G8 into a dead arm - the bank teller fell through to talk.
    // Reached only when the popup's art is missing (the never-traps law).
    if (!forceTalk && route.kind === 'merchant' && route.service === 'banking'
      && openBank()) return;
    // U40: the PLAIN MERCHANT's sell arm. staticNpcRoute has answered
    // 'sell' since G8 and the only consumer was the repair shop's
    // list; a shopkeeper in a non-repair shop fell through to talk, so
    // there was no way to sell anything without finding a shelf first.
    if (!forceTalk && route.kind === 'merchant' && route.service === 'sell'
      && openMerchantSell()) return;
    // U39: DaggerfallTavernWindow. Same shape as the repair arm - the
    // routing has said 'tavern' since G8 and nothing consumed it.
    if (!forceTalk && route.kind === 'merchant' && route.service === 'tavern'
      && openTavern(pn)) return;
    // TK-iv: THE QUESTOR DOOR. TalkToStaticNPC's first act, before the
    // NPC type is even set (:758-770): an NPC the work pool is
    // carrying, or a castle NPC who wins its one 25% roll, opens the
    // quest OFFER instead of the conversation. Children are excluded
    // from both arms.
    // AUDIT 24 (wave 22): EVERY TalkToStaticNPC call inside
    // StaticNPCClick passes menu:FALSE (:1633, :1591, :1601, :1636) -
    // this talk was not started from a popup menu, so the quest-offer
    // window must NOT close itself when its message box closes
    // (DaggerfallQuestOfferWindow.cs:94-97). The port passed true.
    // And the third argument: the HolyOrder/spymaster escape hands
    // `factionData.id == TG_Spymaster` in (:1633), which is the flag
    // that disables the guild greeting for a spymaster reached outside
    // the guild menu. staticNpcRoute has computed it since G8 and the
    // call site dropped it on the floor.
    // AUDIT 24 (wave 24): StaticNPC.DisplayName (:315-328) - an
    // INDIVIDUAL faction answers its own name, everybody else is
    // generated from the name seed. staticNpcName has been the port of
    // that since the static-NPC identity slice landed and NOTHING ever
    // called it: `pn.displayName` is a field collectInteriorPeople
    // does not write, so every shopkeeper, priest and guild clerk in
    // the game reached TalkManager as ''. The visible half is
    // TalkManager's greeting, which says the NPC's name once reaction
    // is above zero and "stranger" below it (townTalk.js:467) - so
    // every static NPC stayed a stranger no matter how well liked -
    // and topicTree's same-building-static test (:558), which matches
    // a topic caption against this name and therefore never matched.
    // F016: the bank is the CURRENT REGION's (SetRuntimeData :309),
    // never the NPC's race - the mobile pools have passed it since
    // AUDIT 23 and this seam re-exports the same reader.
    const displayName = staticNpcName(npcData, { getFaction: (id) => dict?.get(id) ?? null, nameBank: currentNameBank() });
    const talk = npcSession?.talkToStaticNPC(
      // TalkToStaticNPC reads targetNPC.Data (TalkManager.cs:752-770):
      // the nameSeed the work pool and castleNPCsSpokenTo are keyed by,
      // the factionID, the race. That is the DERIVED record, never the
      // block-person one - `pn` carries no nameSeed at all, so every
      // static NPC in the game keyed by 0: one castle NPC consumed the
      // only 25% work roll for all of them, the questor pool (keyed by
      // the real seeds) could never match, and every NPC's answers
      // randomized identically.
      // AUDIT 26 F020: IsChildNPCData (StaticNPC.cs:342-350) - the
      // texture pair or faction 514. `pn.isChildNPC` was a flag NOTHING
      // ever wrote, so a child in a castle could pass the questor door.
      { data: npcData, isChildNPC: isChildNPCData(npcData), displayName },
      // R1: StaticNPCClick's own arms pass menu:FALSE (:1633 et al);
      // the repair popup's Talk button calls TalkToStaticNPC with the
      // DEFAULT menu=true (DaggerfallMerchantRepairPopupWindow.cs:147)
      // - forceTalk IS that button, so it carries the popup's flag.
      { menu: forceTalk, isSpyMaster: route.spymaster === true });
    if (talk?.kind === 'questOffer' && questBridge) {
      const step = questBridge.offerSocialQuest(talk.npc ?? npcData, talk.socialGroup, talk.menu);
      const boxes = questBridge.offerBoxes(step, (id) => townTalk?.lines?.(id) ?? []);
      if (boxes.length && guildServiceArtLoaded() && _shopFont) {
        // the U24 identity guard: a window that dispatches to another
        // must not be nulled by its OWN onClose
        let offerWin = null;
        offerWin = new ServiceFlowWindow(boxes, {
          // AUDIT 26 (F019): through the pair that mounts into
          // whichever slot the CURRENT mode draws. A street NPC's
          // offer is opened from exterior mode, where the interior
          // overlay slot is never drawn or ticked - the window would
          // have been set and then never seen.
          onClose: () => closeSpellWindow(offerWin),
        });
        mountSpellWindow(offerWin);
      }
      return;
    }
    // the three doors that close before a conversation: a racial
    // override, a reaction below -20, and a standing rejection - each
    // already said its piece through the session's messageBox seam
    if (talk && talk.kind !== 'talk') return;
    // CW1 retired the list of open arms that lived here - every one it
    // named is consumed above: repair (R1), tavern (U39), banking
    // (openBank), sell (U40, "needs the trade window's mode split"
    // outlived the split), and the coven popup (CW1 itself). What
    // still falls through to TALK is DFU's own last arm for an NPC
    // with no special handling, so nothing is inert.
    console.log('[interior] static NPC route:', route.kind, route.service ?? '');
    // B7 (AUDIT 25 blocker 7): the conversation OPENS. TalkToNpc's
    // tail is pushTalkWindow (TalkManager.cs:2653) - the engine has
    // computed the greeting, the resets and the topic rebuild since
    // TK-v, and this host answered "You get no response." over the
    // top of all of it. The window mounts through townTalk (its
    // overlay draws and takes input in every mode - the hosts route
    // townTalk first). A host with no session keeps the old line.
    if (talk?.kind === 'talk' && townTalk?.openTalkWindow) {
      // AUDIT 39 (#108): StartNewConversation is the WINDOW's reset -
      // DaggerfallTalkWindow.OnPush runs it through SetStartConversation
      // (:654) on EVERY push, static NPCs included - and the static
      // door ran none of it: the deferred topic-list rebuild was never
      // spent (a blank Where-is page, or the last town's list) and
      // numQuestionsAsked never returned to 0, so every conversation
      // after the session's first question opened on the follow-up
      // record. talkToNpc is TalkToNpc alone; this is the other member.
      npcSession?.startNewConversation();
      townTalk.openTalkWindow(talk.greeting, { npcSeed: npcData.nameSeed, npcName: displayName });   // the DERIVED seed (StaticNPC.Data), as the engine's own reads are
      return;
    }
    townTalk?.say?.('You get no response.');
  }

  // ---- P1: THE SCENE CACHE ------------------------------------------
  // The port rebuilt every interior from block data on entry, so
  // anything the player changed inside one was gone the moment they
  // stepped out: a sword dropped in a shop never existed, an emptied
  // shelf restocked, an opened door re-closed. DFU caches the two
  // stateful kinds (loot and action doors) under the scene's NAME on
  // the way out and restores them on the way back in.
  //
  // The cache lives on the ENTITY so it rides the save with everything
  // else, and is minted lazily the first time an interior is left.
  const sceneCache = () => (playerEntity.sceneCache ??= createSceneCache());

  /**
   * H1 - the town's houses on the market, from the ONE producer
   * (banking.housesForSale). The month is the classic calendar's, so
   * the list turns over on the first of the month exactly as DFU's
   * `+ Now.Month` term intends - see the departure recorded at the law.
   */
  function currentHousesForSale() {
    const dir = buildingDirectory?.();
    if (!dir?.buildings?.length) return [];
    return housesForSale(dir.buildings, {
      mapId: dir.mapId,
      month: Math.floor(worldMinutes() / (MINUTES_PER_DAY * DAYS_PER_MONTH)),
      // IsActiveQuestBuilding(building, residencesOnly: true) - a house
      // the quest machine is using is not for sale (:169).
      isActiveQuestBuilding: (bs) => (questBridge
        ? questBridge.machine.getSiteLinks(SITE_TYPES.Building, dir.mapId, bs.buildingKey).length > 0
        : false),
    });
  }
  /**
   * H2 - GetHousePrice's input (:164-171): the mesh RADIUS of the
   * building's own model, which DFU reads through MeshReader and the
   * port reads off the same ARCH3D record (arch3dFile:380 already
   * divides by POINT_DIVISOR, as DFU's DFMesh.Radius does).
   * Answers 0 for a model the reader cannot resolve, which prices the
   * house at 0 rather than throwing - a house nobody can value is not
   * one the window should refuse to list.
   */
  function houseMeshRadius(building) {
    const id = building?.modelIdNum;
    if (id == null) return 0;
    try {
      const rec = arch?.getRecordIndex?.(id);
      if (rec == null || rec < 0) return 0;
      return arch.getMesh(rec)?.radius ?? 0;
    } catch { return 0; }
  }
  /** The market, priced. */
  const pricedHousesForSale = () => currentHousesForSale()
    .map((h) => ({ ...h, meshRadius: houseMeshRadius(h) }));

  // H4 - THE PURCHASE PREVIEW'S SECOND CAMERA PASS. The window owns
  // the rotation clock and the camera law; the RENDERER owns the GL.
  // ROAD-C c2/S2: this was the third hand-rolled copy of the panel
  // bracket in the tree. It got the two hard parts right (scissor
  // BEFORE beginFrame so its clear is confined, viewport AFTER it
  // because beginFrame sets the full one) and still leaked - a
  // synchronous gl.getParameter(COLOR_CLEAR_VALUE) every frame when
  // _clearColor is already shadowed, and fog and lighting left
  // overridden on the way out, self-healing only because every mode's
  // frame body happens to re-set both. All of it now goes through
  // renderer.panelFrame, whose return runs in a finally.
  // Unchanged here: the ONE mirror on the projection (mat4's law -
  // this pass culls), the model spun by the window's yaw, and the
  // async mesh load through the pipeline's own getGpuMesh (the panel
  // stays empty for the frames it takes, DFU's first-frame gap).
  // RECORDED: DFU climate-swaps the preview's textures and lights it
  // with a 0.4 directional + hard shadows; the port draws the base
  // textures under the collapsed-ambient idiom the automap records.
  const _previewMeshes = new Map();   // modelIdNum -> gpu | null(loading/failed)
  function drawBankModelPreview(modelIdNum, rect, yawDeg, camera) {
    let gpu = _previewMeshes.get(modelIdNum);
    if (gpu === undefined) {
      _previewMeshes.set(modelIdNum, null);
      getGpuMesh(modelIdNum).then((g) => _previewMeshes.set(modelIdNum, g ?? null)).catch(() => {});
      return;
    }
    if (!gpu) return;
    const proj = mirrorProjectionX(perspective(60 * (Math.PI / 180), rect.w / Math.max(1, rect.h), 0.7, 100));   // Unity's default 60-degree lens, near/far :212-213
    const view = lookAt([0, camera.y, camera.z], [0, camera.y, camera.z + 1], [0, 1, 0]);   // identity rotation: straight down +z
    renderer.panelFrame({
      proj,
      view,
      lightDir: new Float32Array([0, 0.707, -0.707]),
      rect,
      clear: [0, 0, 0, 1],   // this camera's SolidColor clear IS opaque black (alpha 1 draws the quad unblended)
      setup: () => {
        renderer.setFog('off');
        renderer.setLighting(new Float32Array([0.75, 0.75, 0.75]), 0);
      },
    }, () => renderer.drawMesh(gpu, trs(0, 0, 0, 0, yawDeg, 0)));
  }

  /** The side effects AllocateHouseToPlayer carries besides the slot:
   *  discovery, the permanent scene, and the deed in the notebook. */
  function houseSideEffects() {
    return {
      // DiscoverBuilding(key, "<player>'s residence") - the port's
      // discovery store is keyed by LOCATION and takes the building
      // record, so the name rides as an override on a synthetic one.
      discoverBuilding: (key, name) => {
        const locId = discoveryLocationId?.();
        if (locId) discoverBuilding(locId, { buildingKey: key, buildingType: BUILDING_TYPES.House1, name });
      },
      addPermanentScene: (mapId, key) => addPermanentScene(sceneCache(), interiorSceneName(mapId, key)),
      addNote: (text) => questBridge?.notebook?.addNote?.(text),
    };
  }

  /** DaggerfallInterior.GetSceneName for the interior the player is
   *  standing in. Null when the building has no key - an unkeyed
   *  interior cannot be cached, because it cannot be named. */
  function currentInteriorScene() {
    const key = interiorBuilding?.buildingKey;
    if (!key) return null;
    return interiorSceneName(questSceneCtx?.()?.mapId ?? 0, key);
  }

  /** What this interior currently holds that the player could have
   *  changed. Shelves are the port's ShopShelves containers and carry
   *  their stocked items; the action system's objects carry the door
   *  and switch states. */
  function currentSceneState() {
    const ctx = interiorCtx;
    if (!ctx) return { lootContainers: [], actionDoors: [] };
    // A2: stockedDate rides the cached record - SerializableLootContainer
    // round-trips it (:72, :151) for exactly this reason. Without it a
    // shelf restocked on every re-entry no matter what day it was,
    // because the day it was stocked did not survive the walk out of
    // the door.
    const lootContainers = [
      ...(ctx.shelves ?? []).map((sh, i) => ({
        containerType: LOOT_CONTAINER_TYPES.ShopShelves, key: `shelf:${i}`, items: sh.items ?? null,
        stockedDate: sh.stockedDate ?? 0,
      })),
      ...(ctx.containers ?? []).map((c, i) => ({
        containerType: LOOT_CONTAINER_TYPES.HouseContainers, key: `container:${i}`, items: c.items ?? null,
        stockedDate: c.stockedDate ?? 0,
      })),
    ];
    // AUDIT 39 (#32): the whole door record, not the state word alone.
    // SerializableActionDoor round-trips currentRotation and
    // actionPercentage beside currentState (plus the lock and the
    // pick latch), and RestoreSaveData's RestartTween(1 - percentage)
    // is what puts an open door back OPEN. Cached as {key, state} the
    // pose and the collider stayed where addDoor minted them, so a
    // door left open came back drawn shut and solid while the machine
    // read open - and the next activation shut an already-shut door.
    // collectSaveData IS that record; the action system already owns
    // both halves.
    const actionDoors = ctx.actions?.collectSaveData?.() ?? [];
    // ID1: the player's own piles are DaggerfallLoot in the interior
    // scene, so they cache and restore with it - the same trio
    // LootContainerData_v1 carries and the dungeon already snapshots.
    // Without this, walking out of a shop and back in emptied the
    // floor.
    const droppedPiles = interiorDropped._piles
      .filter((pile) => pile.items.length)
      .map((pile) => ({ pos: [...pile.pos], record: pile.record, items: pile.items.map((it) => ({ ...it })) }));
    return { lootContainers, actionDoors, droppedPiles };
  }

  /** IS1's two fields - SetExteriorDoors' door identity and the
   *  building discovery record - hoisted (A10) because the SAVE
   *  writes the live scene beside them and the ANCHOR must not
   *  (Teleport.cs:107-112 reads the pair alone). */
  function interiorIdentity() {
    return {
      door: {
        blockIndex: exteriorDoor.blockIndex,
        recordIndex: exteriorDoor.recordIndex,
        doorIndex: exteriorDoor.doorIndex,
        buildingKey: interiorBuilding?.buildingKey ?? 0,
      },
      building: interiorBuilding ? { ...interiorBuilding } : null,
    };
  }

  /** CacheScene on the way OUT (PlayerEnterExit.cs:860). */
  function cacheInteriorScene() {
    const name = currentInteriorScene();
    if (!name) return;
    cacheScene(sceneCache(), name, currentSceneState());
  }

  /** RestoreCachedScene on the way IN (:804). A scene never cached
   *  answers null and the interior stands as the block data built it,
   *  which is every first visit. */
  function restoreInteriorScene() {
    const name = currentInteriorScene();
    if (!name || !interiorCtx) return;
    const data = restoreCachedScene(sceneCache(), name);
    if (!data) return;
    for (const c of data.lootContainers) {
      const [kind, i] = c.key.split(':');
      const target = kind === 'shelf' ? interiorCtx.shelves?.[+i] : interiorCtx.containers?.[+i];
      // `items: null` is a shelf that was never opened - restoring it
      // as null keeps the LAZY stock, which is what makes a first
      // browse still roll fresh goods after an uneventful visit.
      if (target && c.items !== null) target.items = c.items;
      // A2: and the day it was stocked, which is what decides whether
      // the next browse rerolls (SerializableLootContainer:151). A
      // record cached before this shipped carries none, and a missing
      // stockedDate is DFU's own 0 - "never stocked" - so such a shelf
      // restocks once and then behaves.
      if (target) target.stockedDate = c.stockedDate ?? 0;
    }
    // #32: through the system's own restore, which settles the matrix
    // and the collider bucket (syncRestored) - a door restored open
    // must not stay solid. A scene cached before this shipped carries
    // the state word alone; `t` is derived from it so the legacy entry
    // restores as a settled pose rather than a NaN matrix.
    interiorCtx.actions?.restoreSaveData?.(
      data.actionDoors.map((d) => (d.t == null ? { ...d, t: d.state === 'end' ? 1 : 0 } : d)));
    // ID1: a scene cached before this shipped has no `droppedPiles`,
    // and restorePiles CLEARS on an absent list - which is right: the
    // pool was rebuilt empty on the way in, so clearing is a no-op,
    // and a scene that really holds no piles must not keep the last
    // building's.
    interiorDropped.restorePiles(data.droppedPiles);
  }

  /** B2: the bank. Accounts are PER REGION and live on the entity, so
   *  they ride the save with everything else; the array is minted on
   *  first use at the map reader's region count. */
  function openBank() {
    if (!bankArtLoaded() || !_shopFont) return false;
    // MapFileReader.RegionCount (:237-246). The host has no map
    // reader in scope, so the count comes from the accounts already
    // restored by a save, and 62 is the shipped value otherwise.
    const regions = playerEntity.bankAccounts?.length || BANK_REGION_COUNT;
    playerEntity.bankAccounts ??= createBankAccounts(regions);
    // H1: the house registry is minted beside the accounts, on the
    // same region count. createHouses has existed since the banking
    // slice and had no caller - the save has round-tripped
    // `entity.houses` all along, over an array nothing ever made.
    playerEntity.houses ??= createHouses(regions);
    const b = interiorBuilding;
    const bankRegion = () => b?.regionIndex ?? buildingDirectory?.()?.regionIndex ?? 0;
    let win = null;
    win = new BankWindow({
      accounts: () => playerEntity.bankAccounts,
      // H3: ONE region for the whole window. The bank building's own
      // regionIndex is the right answer and stays first, but the
      // LOCATION directory is the same region and answers when the
      // window is opened without a building in hand. Before this,
      // `ownsHouse` read the building's region and the new sell price
      // read the directory's, and the two could disagree - the live
      // probe caught it as a house that had a price and no owner.
      regionIndex: () => bankRegion(),
      level: () => playerEntity.level ?? 1,
      now: () => Math.floor(worldMinutes()),
      player: bankPurse(),
      wagonGold: () => (playerEntity.wagonItems ?? []).find((i) => i.group === 'Currency')?.stackCount ?? 0,
      rows: (id, pick) => townTalk?.lines?.(id, pick) ?? [],
      // GetLoanDueDateString (:571-580) - empty when nothing is owed,
      // otherwise DateString(), which carries no year.
      dueDateText: (minutes) => (minutes > 0 ? dateString(dateFromClassicMinutes(minutes)) : ''),
      // H1: house ownership is live. SHIP ownership still needs the two
      // fixed ship scenes and stays FLAGGED, so those buttons keep
      // refusing through the law's own decisions.
      ownsHouse: () => ownsHouse(playerEntity.houses ?? [], bankRegion()),
      housesForSale: () => currentHousesForSale().length,
      // H2: BUY HOUSE reaches the purchase window. The U24 identity
      // guard again - a window that dispatches to another must not be
      // nulled by its OWN onClose - and the bank is restored when the
      // purchase window closes, which is DFU's PushWindow/PopWindow.
      openPurchase: () => {
        if (!purchaseArtLoaded() || !_shopFont) return false;
        const dir = buildingDirectory?.();
        const region = b?.regionIndex ?? 0;
        let pw = null;
        pw = new BankPurchaseWindow({
          houses: () => pricedHousesForSale(),
          drawModelPreview: drawBankModelPreview,   // H4: the live 3D panel

          buy: (h) => purchaseHouse(playerEntity.bankAccounts, playerEntity.houses, region, h, bankPurse(), {
            meshRadius: h.meshRadius ?? 0,
            mapId: dir?.mapId ?? 0,
            location: dir?.locationName ?? '',
            sideEffects: { ...houseSideEffects(), playerName: playerEntity.name ?? '', regionName: dir?.regionName ?? '' },
          }),
          // F138: GeneratePurchaseHousePopup is the BANKING window's
          // (:234-237) - the purchase list has already closed by the
          // time the result shows, so the box is win's GeneratePopup.
          showResult: (result, amount) => win._popup(result, amount),
          onClose: () => { if (interiorOverlay === pw) interiorOverlay = win; },
        });
        interiorOverlay = pw;
        return true;
      },
      // H3 CLOSED the sell price, which had stubbed at zero because it
      // needs the OWNED building's mesh radius and nothing resolved a
      // model behind a buildingKey. Nothing new had to be built:
      // `houseMeshRadius` already reads exactly that for the market
      // list, and the location directory already carries `modelIdNum`
      // on every building - the owned one just had to be found in it.
      houseSellPrice: () => {
        const dir = buildingDirectory?.();
        const key = ownedHouseKey(playerEntity.houses ?? [], bankRegion());
        if (!key || !dir?.buildings?.length) return 0;
        const owned = dir.buildings.find((b) => b.buildingKey === key);
        return owned ? houseSellPrice(houseMeshRadius(owned)) : 0;
      },
      ownsShip: () => ownsShip(playerEntity),
      ownedShip: () => ownedShipType(playerEntity),
      // The two SALES themselves. Both credit the bank ACCOUNT rather
      // than the purse - DFU pays a deed into the account - and both
      // drop what they made permanent.
      sellHouse: () => {
        const dir = buildingDirectory?.();
        const region = bankRegion();
        const key = ownedHouseKey(playerEntity.houses ?? [], region);
        const owned = dir?.buildings?.find((b) => b.buildingKey === key) ?? null;
        return sellHouse(playerEntity.bankAccounts, playerEntity.houses, region,
          { meshRadius: owned ? houseMeshRadius(owned) : 0 }, {
            removePermanentScene: (mapId, k) => removePermanentScene(sceneCache(), interiorSceneName(mapId, k)),
            // the deed named the building "<player>'s residence"; selling
            // takes that name back off the map
            undiscoverBuilding: (k) => {
              const locId = discoveryLocationId?.();
              if (locId) undiscoverBuilding(locId, k);
            },
          });
      },
      // AssignShipToPlayer/SellShip add and drop BOTH of the ship's
      // scenes (:494-495, :502-503) - the exterior is keyed by the
      // ship's map pixel and the interior by a fixed mapId with
      // buildingKey0. sceneCache.js already names both kinds, so the
      // pair is exact rather than half a port.
      sellShip: () => sellShip(playerEntity.bankAccounts, bankRegion(), playerEntity, {
        removePermanentScene: (ship) => {
          removePermanentScene(sceneCache(), worldSceneName(SHIP_COORDS[ship].x, SHIP_COORDS[ship].y));
          removePermanentScene(sceneCache(), interiorSceneName(SHIP_INTERIOR_MAP_IDS[ship], BUILDING_KEY_0));
        },
      }),
      // DaggerfallBankingWindow.cs:460 - the ONE read of
      // PortTownAndUnknown in all of DFU. Non-zero is a port.
      isPortTown: () => (buildingDirectory?.()?.portTownAndUnknown ?? 0) !== 0,
      onClose: () => { if (interiorOverlay === win) interiorOverlay = null; },
    });
    interiorOverlay = win;
    return true;
  }

  /** The purse seam banking.js's transactions take. The wagon half is
   *  the deposit arm's - DFU reaches into the cart for the shortfall
   *  after the purse is empty. */
  function bankPurse() {
    const wagonStack = () => (playerEntity.wagonItems ?? []).find((i) => i.group === 'Currency') ?? null;
    return {
      gold: () => goldAmount(playerEntity),
      // AUDIT 26 F103-F105/F178: GetGoldAmount is coins PLUS letters
      // of credit (PlayerEntity.cs:1313-1316), and DFU gates RepayLoan
      // (:516), PurchaseHouse (:415) and PurchaseShip (:474) on it -
      // where deposit/withdraw stay coins-only. One seam had conflated
      // the two quantities, so the gate and the payment (deductGold,
      // which DOES spend letters) disagreed with each other.
      totalGold: () => totalGoldAmount(playerEntity),
      deductGold: (n) => deductGold(playerEntity, n),
      addGold: (n) => addGold(playerEntity, n),
      wagonGold: () => wagonStack()?.stackCount ?? 0,
      takeWagonGold: (n) => {
        const st = wagonStack();
        if (!st) return;
        st.stackCount -= n;
        if (st.stackCount < 1) playerEntity.wagonItems.splice(playerEntity.wagonItems.indexOf(st), 1);
      },
      takeLetter: () => {
        const i = (playerEntity.items ?? []).findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
        return i < 0 ? null : playerEntity.items.splice(i, 1)[0];
      },
      addLetter: (loc) => { (playerEntity.items ??= []).unshift(loc); },
      carriedWeightKg: () => totalWeight(playerEntity.items ?? []),
      maxEncumbranceKg: () => entityMaxEncumbrance(playerEntity),   // DaggerfallBankManager.cs:370 reads PlayerEntity.MaxEncumbrance
    };
  }

  // V5's toggleInteriorRest retired: its bag-building lives in
  // `interiorRestPlaceHere` below, which hands the bag to the WINDOW
  // instead of calling CanRest here - DFU gates on the WHILE and
  // HEALED buttons (:641-690), not at open, which is what keeps LOITER
  // free of the refusal and the crime. What came across intact: H1's
  // `isHouseOwned` over the region's own registry slot, the
  // permanent-scene test through `currentInteriorScene`, and
  // `plainLines` on the refusal.

  /** U39: the innkeeper's four-button panel. Answers whether it
   *  opened - a host with no art or no font falls through to TALK,
   *  which is the U8 idiom and keeps the NPC answering. */
  function openTavern(pn) {
    if (!tavernArtLoaded() || !_shopFont) return false;
    const dict = townTalk?.factionDict ?? null;
    const b = interiorBuilding;
    // GuildManager.GetGuild(KnightlyOrder).FreeTavernRooms() - the
    // order the PLAYER belongs to, not this building's. The stored
    // membership is keyed by group and carries the guild's name, so
    // the order is recoverable from it; a non-member has no row and
    // pays like everyone else.
    const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book
    const km = joinedGuildOfGroup(memberships, GUILD_GROUPS.KnightlyOrder);
    const knightGuild = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
    let win = null;
    win = new TavernWindow({
      entity: playerEntity,
      rows: (id, pick) => townTalk?.lines?.(id, pick) ?? [],
      now: () => Math.floor(worldMinutes()),
      mapId: () => questSceneCtx?.()?.mapId ?? 0,
      buildingKey: () => b?.buildingKey ?? 0,
      buildingName: () => b?.name ?? '',
      quality: () => b?.quality ?? 0,
      // RentRoom's `FindMarkers(InteriorMarkerTypes.Rest)` (:239-240).
      bedCount: () => (interiorCtx?.markers ?? []).filter((m) => m.type === INTERIOR_MARKER.REST).length || 1,
      freeRooms: () => (knightGuild
        ? freeTavernRooms(knightGuild, km, {
          regionIndex: b?.regionIndex ?? 0,
          orderRegion: dict?.get(knightGuild.factionId)?.region ?? null,
        })
        : false),
      skills: () => ({
        mercantile: skillValue(playerEntity, SKILLS.Mercantile),
        personality: playerEntity.stats?.personality ?? 50,
      }),
      // SetHealth, through the entity's own ceiling.
      heal: (n) => { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); },
      onTalk: () => openStaticNpc(pn, { forceTalk: true }),
      sceneCache: () => sceneCache(),   // P1: renting HOLDS the room's interior
      // The U24 identity guard: a window that dispatches to another
      // must not be nulled by its OWN onClose.
      onClose: () => { if (interiorOverlay === win) interiorOverlay = null; },
    });
    interiorOverlay = win;
    return true;
  }

  /** B7: the popup's TALK button is TalkToStaticNPC with menu
   *  defaulted TRUE (DaggerfallGuildServicePopupWindow.cs:294) -
   *  the same engine doors, then the window push. G6 gave it a
   *  SECOND caller: the Spymaster's greeting hands the player to
   *  this same door on dismissal, with isSpyMaster true (:713).
   *  CW1 gave it a THIRD: the coven popup's Talk button
   *  (DaggerfallWitchesCovenPopupWindow.cs:168, the same default-TRUE
   *  menu), which is why the door hoisted out of openGuildService.
   *
   *  It reads the SAME StaticNPC.Data the click derived: DFU's popup
   *  is handed the very StaticNPC component the click routed
   *  (:294 TalkToStaticNPC(staticNPC)), and Data is computed once at
   *  layout. Re-deriving it here dropped GetRaceFromFaction's two
   *  lookups (StaticNPC.cs:357-369) - which only the bridge's world
   *  seam can answer - so every NPC reached through the popup was
   *  stamped Nord and drew a different generated name than the same
   *  NPC clicked directly. */
  function popupTalkToStaticNpc(npcData, { isSpyMaster = false } = {}) {
    const dict2 = townTalk?.factionDict ?? null;
    const displayName2 = staticNpcName(npcData, { getFaction: (id) => dict2?.get(id) ?? null, nameBank: currentNameBank() });   // F016
    const talk2 = npcSession?.talkToStaticNPC(
      { data: npcData, isChildNPC: isChildNPCData(npcData), displayName: displayName2 },   // F020
      { menu: true, isSpyMaster });
    if (talk2?.kind === 'talk' && townTalk?.openTalkWindow) {
      interiorOverlay = null;   // the popup yields to the conversation, as DFU's CloseWindow-then-push does
      npcSession?.startNewConversation();   // #108: the same OnPush reset - this door is a push too
      townTalk.openTalkWindow(talk2.greeting, { npcSeed: npcData.nameSeed, npcName: displayName2 });
      return;
    }
    if (!talk2) townTalk?.say?.('You get no response.');   // no session mounted - the old line
  }

  /** CW1: DaggerfallWitchesCovenPopupWindow - the coven's four-button
   *  panel on DAED00I0.IMG. Talk is the popup door above; Summon is
   *  DaedraSummoningService with the WITCH NPC's OWN factionID (:186),
   *  through the same openServiceFlow arm the temples take; Quest is
   *  the Witches-pool nonmember offer (offerFlow.offerCovenQuest),
   *  boxed on a ServiceFlowWindow like every guild offer. */
  function openWitchesCoven(pn, npcData) {
    if (!covenArtLoaded() || !_shopFont) return;   // no art, no window (the U8 idiom)
    const dict = townTalk?.factionDict ?? null;
    const store = ensureFactionRep(playerEntity, dict);
    const rows = (id) => townTalk?.lines?.(id) ?? [];
    let win = null;
    win = new CovenWindow({
      rows,
      onTalk: () => popupTalkToStaticNpc(npcData),
      onSummon: () => openServiceFlow('guildServiceDaedraSummoning', {
        guild: null, memberships: [], store, rows, route: null,
        summonerFactionId: pn.factionID,
      }),
      onQuest: () => {
        if (!questBridge || !store) return null;
        // GetQuest (:121-158): the NPC's faction homes the offer and
        // its reputation feeds the pool filter.
        const step = questBridge.offerCovenQuest(pn.factionID, getReputation(store, pn.factionID));
        const boxes = questBridge.offerBoxes(step, rows);
        if (!boxes.length || !guildServiceArtLoaded()) return null;
        let offerWin = null;
        offerWin = new ServiceFlowWindow(boxes, {
          onClose: () => { if (interiorOverlay === offerWin) interiorOverlay = null; },
        });
        interiorOverlay = offerWin;
        return { dispatched: true };
      },
      onClose: () => { if (interiorOverlay === win) interiorOverlay = null; },
    });
    interiorOverlay = win;
  }

  function openGuildService(pn, route, npcData) {
    const talkToStaticNpcHere = (o) => popupTalkToStaticNpc(npcData, o);
    const dict = townTalk?.factionDict ?? null;
    const guild = createGuildForGroup(route.guildGroup, route.buildingFactionId, dict);
    if (!guild) { townTalk?.say?.('You get no response.'); return; }
    if (!guildServiceArtLoaded() || !_shopFont) return;   // no art, no window (the U8 idiom)
    const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book
    // THE ONE CONSTRUCTION SEAM (5th), RECORDED and not a gap: DFU's
    // PlayerEntity is BUILT with its faction store - PlayerEntity.cs
    // :65 field-initializes `factionData = new PersistentFactionData()`
    // - so the join decision below can always read reputation. The
    // port's pre-chargen literal has no such field, and
    // `ensureFactionRep` mints it at the read, ahead of every
    // reputation question, which is the same guarantee by another
    // route. The live probe found the missing seam as a pageerror on
    // `store.dict`.
    const store = ensureFactionRep(playerEntity, dict);
    const service = npcServiceKind(pn.factionID);
    const rows = (id) => townTalk?.lines?.(id) ?? [];
    // U24: a window that dispatches to another window must not be
    // nulled by its OWN onClose - DFU closes the popup and pushes the
    // next one, and the port's overlay slot is single. The identity
    // guard is what keeps the second window alive; without it the join
    // welcome and every service flow vanished the moment they opened.
    let win = null;
    win = new GuildServiceWindow({
      member: () => !showsJoinButton(memberships, route.guildGroup),
      service: () => service,
      rows,
      // OnPush (:158-205) runs once, on construction.
      steps: () => onPushEffects(playerEntity, guild, memberships, store, gameDate(), {
        freeHealing: freeHealing(guild, membershipOf(memberships, guild)),
        freeMagickaRecharge: freeMagickaRecharge(guild, membershipOf(memberships, guild), playerEntity),
        revealLocation: host.revealLocation ?? null,   // G8: the TG/DB map reveals
        // F114: OwnsHouse per CURRENT region (DaggerfallBankManager.cs:136).
        ownsHouse: () => ownsHouse(playerEntity.houses ?? [], interiorBuilding?.regionIndex ?? 0),
      }),
      onJoin: () => {
        // JoinButton_OnMouseClick (:497-525). joinDecision is null for
        // the two invitation-only guilds, which DFU reaches by
        // THROWING from TokensEligible - it never shows them a join
        // button, because their group is forced-member above.
        // No FACTION.TXT, no reputation, no honest decision - and DFU
        // has no branch for it, so the port says nothing rather than
        // guessing a zero.
        if (!store) return null;
        const decision = joinDecision(playerEntity, guild, store);
        if (!decision) return null;
        if (!decision.eligible) return { rows: rows(decision.textId) };
        return {
          rows: rows(decision.textId),
          buttons: 'YesNo',
          onYes: () => {
            joinGuild(memberships, guild, gameDate());
            const welcome = new GuildServiceWindow(_welcomeHooks(guild, rows, () => welcome));
            interiorOverlay = welcome;
          },
        };
      },
      /** B7: the popup's TALK button is TalkToStaticNPC with menu
       *  defaulted TRUE (DaggerfallGuildServicePopupWindow.cs:294) -
       *  the same engine doors, then the window push. */
      onTalk: () => talkToStaticNpcHere({ isSpyMaster: false }),
      onService: () => {
        const access = serviceAccess(guild, membershipOf(memberships, guild), service);
        if (!access.allowed) {
          return { rows: access.textId ? rows(access.textId) : [access.text] };
        }
        // U24 could perform three of these. DR2 closed the last of
        // the twenty, so guildServiceFlow.SERVICE_DESTINATION maps
        // every arm and there is no null left to name.
        const flow = openServiceFlow(serviceDestination(service), {
          guild, memberships, store, rows, route,
          // G6: the greeting's dismissal IS the service - the same
          // talk door the popup's own Talk button opens, with
          // isSpyMaster TRUE (:713), which is the one thing that
          // differs between the two.
          talkAsSpymaster: () => talkToStaticNpcHere({ isSpyMaster: true }),
        });
        if (!flow) return { rows: ['That service is not available yet.'] };
        // G6: an arm may answer a BOX instead of a window - the
        // smith's refusal and the Spymaster's greeting both do, and
        // both belong ON the popup rather than in place of it. The
        // caller used to mount whatever came back, so a box would
        // land in the overlay slot and the next frame would ask a
        // plain object to draw itself.
        if (flow.rows) return flow;
        interiorOverlay = flow;
        return { dispatched: true };
      },
      onClose: () => { if (interiorOverlay === win) interiorOverlay = null; },
    });
    interiorOverlay = win;
  }

  /** U42: the CLASSIC spellbook in CAST mode - the interior host's
   *  Backspace window, ONE construction. The player's own array is
   *  handed by reference: the window's delete/swap/sort/rename write
   *  into it, and the save envelope reads the same array. */
  // PX23: the book's ONE door. (The BUY window below is not this one -
  // it is the spell merchant's shop, with its own deps, and it keeps
  // building itself.)
  const makeSpellbookWindow = () => createSpellbookWindow({
    entity: playerEntity,
    magic,
    castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
    rows: (id, pick) => townTalk?.lines?.(id, pick) ?? [],
  });

  /** DoGuildService's three built arms (U24). Each returns a
   *  ServiceFlowWindow, or null for a destination that does not exist
   *  yet. `onClose` uses the same identity guard as the popup's. */
  // CW1: guild is NULLABLE - the coven popup reaches ONE arm of this
  // switch (the summoning) with no guild at all, exactly as DFU's
  // DaedraSummoningService lives on the guild-less base popup class
  // (DaggerfallQuestPopupWindow, not the guild window). summonerFactionId
  // overrides the building faction for that arm: the coven summons by
  // the WITCH NPC's own factionID (:186), the one summoner whose id is
  // not the hall it stands in.
  function openServiceFlow(destination, { guild, memberships, store, rows, route, talkAsSpymaster = null, summonerFactionId = null }) {
    if (!destination) return null;
    const membership = guild ? membershipOf(memberships, guild) : null;
    const b = interiorBuilding;
    const closeSelf = () => { if (interiorOverlay === flow) interiorOverlay = null; };
    const now = () => interiorTicker.classicMinutes;   // already CLASSIC minutes (AUDIT 21 F2)
    const godName = guild?.divine ?? '';
    let flow = null;
    // R1: the guild repair service - the same keyed flow the repair
    // shops open, with guild.ReducedRepairCost bound (FightersGuild's
    // rank scaling; the base guild returns the price unchanged, so
    // binding it for every guild IS DFU's `guild != null` arm).
    // X7: IDENTIFY. DFU's service is the trade window in Identify mode
    // (DaggerfallGuildServicePopupWindow pushes it exactly as it does
    // Repair), and the port's Identify mode was already whole - the
    // cost formula with its Witches Festival free arm, the per-item
    // skip, the refusal line. Only the destination was missing, and
    // under it the identified state was being read raw rather than
    // DERIVED, so opening this mode before X7 would have offered to
    // identify a rusty dagger for money. X7 closed both in this block:
    // the `guildServiceIdentify` arm below pushes the trade window in
    // Identify mode exactly as DaggerfallGuildServicePopupWindow does,
    // carrying the guild's own faction id.
    //
    // The player's own pack is BOTH lists here: DFU's Identify mode
    // stages out of localItems into remoteItems and hands everything
    // back, so there is no shop shelf at all - the empty one below is
    // what the window's Buy-side plumbing expects to find and never
    // reads in this mode.
    if (destination === 'guildServiceIdentify' && tradeArtLoaded()) {
      // G4: ...and the guild's OWN faction id, which is what a guild
      // store has to price with.
      flow = openTradeWindow({ items: [] }, b ?? {}, 'Identify', { guildFactionId: guild?.factionId ?? null });
      return flow;
    }
    // X6: BUY SOULGEMS. DFU's own service window is the trade window in
    // Buy mode over GetMerchantMagicItems(onlySoulGems: true)
    // (DaggerfallGuildServicePopupWindow.cs:247-266), which is exactly
    // what the port's Buy mode already is - the shelf is the only new
    // part, and it is a pure law in shopStock.js.
    //
    // QUIRK, ported rather than fixed: DFU regenerates the shelf on
    // every open and seeds it from the DAY, so closing the window and
    // reopening it the same game day restores everything the player
    // just bought. DFU chose that seeding deliberately to stop the
    // stock flickering ("magic item stock not being deterministic
    // every time player opens window"); the restock is its
    // consequence. Making it persist would be a silent departure, so
    // it is left as DFU has it and recorded here instead.
    if (destination === 'guildServiceBuySoulgems' && tradeArtLoaded()) {
      const shelf = { items: stockSoulGems(
        { quality: b?.quality ?? 0, gameMinutes: Math.floor(worldMinutes()) },
        { soulPointsOf: (t) => ENEMY_BASICS[t]?.soulPts ?? 0 }) };
      // The slot is freed by the frame's own `done` sweep (:2450,
      // :2517), which is how EVERY trade window is dismissed -
      // NativeTradeWindow sets `done` on Escape/E and never calls a
      // close hook, so nothing more is needed here. (openMerchantSell
      // assigns hooks.onClose for this and it is inert; see the note
      // there.) closeSelf is the keyed-flow idiom and does not apply.
      flow = openTradeWindow(shelf, b ?? {}, 'Buy', { guildFactionId: guild?.factionId ?? null });
      return flow;
    }
    // G4: the remaining trade-mode services. U40 built every mode and
    // X6 proved the shelf pattern; these were destination strings and
    // nothing else. All of them - and X6's and X7's arms above - pass
    // the guild's OWN faction id, which is what makes the holiday
    // clause reachable at all.
    if (destination === 'guildServiceSellMagicItems' && tradeArtLoaded()) {
      // SellMagic works off the PLAYER'S PACK - there is no shelf to
      // stock, which is why DFU passes the trade window a mode and a
      // guild and nothing else (:409-411). X7 took the Identify arm
      // above on the same shape.)
      flow = openTradeWindow({ items: [] }, b ?? {}, 'SellMagic', { guildFactionId: guild?.factionId ?? null });
      return flow;
    }
    if (destination === 'guildServiceBuyPotions' && tradeArtLoaded()) {
      const shelf = { items: stockGuildPotions({ quality: b?.quality ?? 0, gameMinutes: Math.floor(worldMinutes()) }) };
      flow = openTradeWindow(shelf, b ?? {}, 'Buy', { guildFactionId: guild?.factionId ?? null });
      return flow;
    }
    if (destination === 'guildServiceBuyMagicItems' && tradeArtLoaded()) {
      // The soul-gem arm rides ALONG when this guild also sells them
      // (:248) - one shelf, two services' stock - and it walks the
      // day's sequence AFTER the magic items, so these gems are not
      // the ones the Buy Soulgems shelf shows.
      const shelf = { items: stockGuildMagicItems({
        quality: b?.quality ?? 0,
        gameMinutes: Math.floor(worldMinutes()),
        sellsSoulGems: canAccessService(guild, membership, 'BuySoulgems'),
      }, {
        magicItemTemplates: getMagicItemTemplates(),
        playerLevel: playerEntity.level ?? 1,
        gender: playerEntity.gender ?? 0,
        soulPointsOf: (t) => ENEMY_BASICS[t]?.soulPts ?? 0,
      }) };
      flow = openTradeWindow(shelf, b ?? {}, 'Buy', { guildFactionId: guild?.factionId ?? null });
      return flow;
    }
    // G5: TELEPORT. DFU arms the travel map and pushes it
    // (DaggerfallGuildServicePopupWindow:449-453); the map's own
    // teleport arm takes it from there. The WINDOW is the world
    // host's - only that host has a streaming world to land in - so
    // it arrives through a host door the same shape as G8's
    // revealLocation, and a host without one answers null, which is
    // the popup's own "not available yet" arm.
    //
    // The window is returned as WELL as mounted: an arm that mounts
    // itself and answers null cannot be told apart from a service
    // that does not exist, and the popup needs the difference to know
    // whether to close.
    // G6: THE SPYMASTER. A random TEXT.RSC 402 variant, click-anywhere
    // to close, and the close hands the player to the NPC's OWN talk
    // window (:711-714 TalkToStaticNPC with isSpyMaster true). It is
    // a greeting rather than a service: nothing is bought, and the
    // conversation that follows is the one the popup's Talk button
    // would have opened anyway.
    if (destination === 'guildServiceSpymaster') {
      const spyRows = rows?.(SPYMASTER_GREETING_TEXT_ID) ?? [];
      return {
        rows: spyRows.length ? spyRows : [{ text: 'I am the Spymaster.', center: true }],
        closesWindow: true,
        onDismiss: () => { talkAsSpymaster?.(); },
      };
    }
    // G6: THE KNIGHTLY SMITH'S GIFT. The refusal is a box on the
    // popup; the offer opens THIS HOST's inventory in choose-one mode
    // over the reward pile, and taking a piece is what claims the
    // rank (systems/knightlyGifts.js).
    if (destination === 'guildServiceReceiveArmor') {
      const decision = receiveArmorDecision(membership, {
        makeArmor: (templateIndex, material) => mintCondition({ group: 'Armor', templateIndex, material }),
      });
      if (decision.kind === 'refuse') {
        const refusal = rows?.(decision.textId) ?? [];
        return { rows: refusal.length ? refusal : [{ text: 'You have already received your armor for your current rank.', center: true }] };
      }
      const win = interiorInventory({
        chooseOne: {
          items: decision.pieces,
          onChoose: () => { claimArmor(membership, decision.mask); surfacePlayer(); },
        },
      });
      if (!win) return null;
      interiorOverlay = win;
      return win;
    }
    if (destination === 'guildServiceDaedraSummoning') {
      // G7 - the last of the twenty destinations. Two boxes: "is it a
      // summoning day" and, if it is, "are you REALLY sure" - and the
      // answer to the second spends two hundred thousand gold before
      // anything is rolled.
      const dict = townTalk?.factionDict ?? null;
      const summonerId = summonerFactionId ?? b?.factionId ?? 0;
      const summoner = dict?.get(summonerId) ?? null;
      const store = ensureFactionRep(playerEntity, dict);
      const daedra = daedraForSummoner({
        factionId: summonerId,
        factionType: summoner?.type ?? null,
        dayOfYear: dayOfYearFromMinutes(Math.floor(worldMinutes())),
        // The coven's remembered roll lives on the player, as DFU's
        // PlayerEntity.DaedraSummonIndex/Day do.
        state: playerEntity,
      });
      if (!daedra) return { rows: rows?.(SUMMON_TEXT.notToday) ?? [{ text: 'This is not a summoning day.', center: true }] };
      // WeatherManager.IsRaining / IsStorming - thunder is a STORM
      // and not rain, which is what makes Sheogorath's day distinct
      // from Sanguine's four.
      const sky = currentWeatherEnum();
      const weather = { raining: sky === WEATHER_ENUM.rain, storming: sky === WEATHER_ENUM.thunder };
      return {
        rows: rows?.(SUMMON_TEXT.areYouSure) ?? [{ text: 'Are you sure you wish to attempt this?', center: true }],
        buttons: 'YesNo',
        onYes: () => {
          const r = attemptSummoning({
            daedra,
            summonerRep: getReputation(store, summonerId),
            summonerGuildGroup: summoner?.ggroup ?? null,
            gold: goldAmount(playerEntity),
            daedraRep: (fid) => getReputation(store, fid),
            hasSummoned: (fid) => getFlag(store, fid, FACTION_FLAGS.Summoned),
            ...weather,
          });
          if (r.kind === 'poor') {
            return { rows: [{ text: `The summoning would cost ${r.cost} gold.`, center: true }] };
          }
          // The gold goes BEFORE the roll and is not refunded: you paid
          // for the summoning, not for the prince turning up.
          deductGold(playerEntity, r.cost);
          surfacePlayer();
          if (r.kind === 'failed') {
            // IF: a coven's failure spawns daedric foes ON YOU -
            // DaggerfallQuestPopupWindow.cs:257, Range(1,4) of one
            // type at 4..64 units. The SAME CreateFoeSpawner call as
            // the summoning window's refusal, so it takes the same
            // door with its own numbers.
            if (r.spawnFoes) {
              spawnDaedricPunishment({
                count: COVEN_FAIL_FOE_COUNT[0] + Math.floor(Math.random() * (COVEN_FAIL_FOE_COUNT[1] + 1 - COVEN_FAIL_FOE_COUNT[0])),
                minDistance: 4, maxDistance: 64,
              });
            }
            return { rows: rows?.(SUMMON_TEXT.failed) ?? [{ text: 'The daedra does not answer.', center: true }] };
          }
          if (r.kind === 'greeting') {
            return { rows: rows?.(r.textId) ?? [{ text: `${r.daedra.name} has met you before.`, center: true }] };
          }
          setFlag(store, r.daedra.factionId, r.flag);
          const offered = questBridge?.offerDaedricQuest?.(r.quest, summonerId) ?? null;
          // G7b: the prince's own .FLC window carries the OFFER step -
          // DaggerfallDaedraSummonedWindow, the film with the offer
          // read over it in four-line chunks. The step has ONE
          // consumer: the film window when the FLC loads, the box
          // chain when it cannot (never traps). The fetch is async,
          // so the service window closes now and the summons appears
          // on arrival - DFU's own push replaces the popup the same
          // way.
          const mountBoxes = () => {
            const boxes = offered ? questBridge.offerBoxes(offered, (id) => townTalk?.lines?.(id) ?? []) : [];
            if (!boxes.length || !guildServiceArtLoaded() || !_shopFont) return;
            let offerWin = null;
            offerWin = new ServiceFlowWindow(boxes, {
              onClose: () => { if (interiorOverlay === offerWin) interiorOverlay = null; },
            });
            interiorOverlay = offerWin;
          };
          if (offered?.kind === 'offer' && r.daedra.video) {
            fetchBytes(r.daedra.video).then((bytes) => {
              let sw = null;
              sw = new DaedraSummonedWindow({
                flcBytes: bytes, flcName: r.daedra.video, offerStep: offered,
                // IF: the refusal's punishment is REAL now - 3-5 daedra
                // at 8..64 units (:125), through the interior pool.
                spawnRefusalFoes: () => spawnDaedricPunishment({
                  count: REFUSAL_FOE_COUNT[0] + Math.floor(Math.random() * (REFUSAL_FOE_COUNT[1] + 1 - REFUSAL_FOE_COUNT[0])),
                  minDistance: 8, maxDistance: 64,
                }),
                onClose: () => { if (interiorOverlay === sw) interiorOverlay = null; },
              });
              if (!sw.flc.readyToPlay) { mountBoxes(); return; }
              interiorOverlay = sw;
            }).catch(() => mountBoxes());
            return null;
          }
          if (offered) { mountBoxes(); return null; }
          return { rows: [{ text: `${r.daedra.name} answers your summons.`, center: true }] };
        },
      };
    }
    if (destination === 'guildServiceReceiveHouse') {
      const region = b?.regionIndex ?? 0;
      playerEntity.houses ??= createHouses(playerEntity.bankAccounts?.length || BANK_REGION_COUNT);
      const dir = buildingDirectory?.();
      const decision = receiveHouseDecision(membership, {
        ownsHouse: ownsHouse(playerEntity.houses, region),
        housesForSale: currentHousesForSale(),
        alreadyOwnResult: TRANSACTION_RESULT.ALREADY_OWN_HOUSE,
        noneForSaleResult: TRANSACTION_RESULT.NO_HOUSES_FOR_SALE,
      });
      if (decision.kind === 'refuse') {
        const refusal = decision.line ? [{ text: decision.line, center: true }]
          : (rows?.(decision.textId ?? decision.result) ?? []);
        return { rows: refusal.length ? refusal : [{ text: ALREADY_GIVEN_HOUSE, center: true }] };
      }
      allocateHouseToPlayer(playerEntity.houses, region, {
        buildingKey: decision.house.buildingKey,
        mapId: dir?.mapId ?? 0,
        location: dir?.locationName ?? '',
      }, {
        ...houseSideEffects(),
        playerName: playerEntity.name ?? '',
        regionName: dir?.regionName ?? '',
      });
      claimHouse(membership);
      surfacePlayer();
      return { rows: rows?.(decision.textId) ?? [{ text: 'I have a house for you.', center: true }] };
    }
    if (destination === 'guildServiceTeleport') {
      const win = host.openTeleportMap?.();
      if (!win) return null;
      interiorOverlay = win;
      return win;
    }
    if (destination === 'guildServiceRepair') {
      openRepairService({ reducedRepairCost: (price) => reducedRepairCost(guild, membership, price) });
      return interiorOverlay;
    }
    // S1: the spell maker. DFU pushes its own singleton window from
    // the service popup (DaggerfallGuildServicePopupWindow:389-394);
    // the port mounts the keyed window in the interior slot. The
    // spellbook check lives in the purchase ladder, where DFU also
    // runs it (the window opens either way, as DFU's does once the
    // popup's own check passes).
    // M2: the potion maker. Same seam as the spell maker below - the
    // temple and Mages Guild both offer it - and M2 wired the
    // destination immediately below: PotionMakerWindow in the interior
    // slot, behind MakePotionService's no-ingredient refusal.
    if (destination === 'guildServicePotionMaker' && potionArtLoaded() && _shopFont) {
      // AUDIT 26 F201: MakePotionService (:670-686) closes the popup,
      // scans pack AND wagon for any ingredient, and refuses with
      // NoPotionIngredients (34) when there is none - the record id
      // had shipped with zero callers and the mixer opened empty.
      if (![...(playerEntity.items ?? []), ...(playerEntity.wagonItems ?? [])].some(isIngredient)) {
        return { rows: rows(NO_POTION_INGREDIENTS), closesWindow: true };
      }
      let potionWin = null;
      potionWin = new PotionMakerWindow({
        packItems: () => (playerEntity.items ??= []),
        wagonItems: () => (playerEntity.wagonItems ??= []),
        gold: () => goldAmount(playerEntity),
        // The recipes the player has LEARNED. Reading a recipe scroll
        // is the useItem arm that fills this; until then a character
        // knows none and the button says so, which is DFU's own
        // answer for a new character.
        recipeKeys: () => playerEntity.potionRecipeKeys ?? [],
        // ItemBuilder.CreatePotion (:324) - loot.js has minted these
        // since E1 for random treasure; a mixed potion is the same
        // bottle carrying the same key, so there is one minter.
        addPotion: (recipe, key) => {
          const bottle = createPotion(key);
          bottle.name = recipe.name;
          bottle.value = recipe.price;
          addItem(playerEntity.items, bottle);
          surfacePlayer();
        },
        takeOne: (templateIndex, where, group) => {
          const list = where === 'pack' ? playerEntity.items : (playerEntity.wagonItems ?? []);
          // F176: GetItem(group, template, allowEnchantedItem: false)
          // (:338, :345) - the walk must not spend an enchanted twin
          // of the plain reagent that went in the pot. (X11b's lesson
          // stands: removeOne takes a TEMPLATE INDEX, not the item.)
          return removeOne(list, templateIndex, { group, allowEnchantedItem: false });
        },
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        entity: playerEntity,
        onClose: () => { if (interiorOverlay === potionWin) interiorOverlay = null; },
      });
      interiorOverlay = potionWin;
      return null;
    }
    // M4: the item maker, the Mages Guild's own enchanter. M4 wired
    // the destination immediately below - ItemMakerWindow into the
    // interior slot - and the probe seam (`window.__openItemMaker`)
    // reaches it through the real guild-service dispatcher.
    if (destination === 'guildServiceItemMaker' && itemMakerArtLoaded() && _shopFont) {
      let itemWin = null;
      itemWin = new ItemMakerWindow({
        packItems: () => (playerEntity.items ??= []),
        player: playerEntity,
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        entity: playerEntity,
        onEnchanted: () => surfacePlayer(),
        onClose: () => { if (interiorOverlay === itemWin) interiorOverlay = null; },
      });
      interiorOverlay = itemWin;
      return null;
    }
    // U42: BUY SPELLS. DFU pushes the spellbook itself in BUY MODE
    // from the service popup - one window, one `true` argument
    // (DaggerfallGuildServicePopupWindow.cs:383-387) - which is why
    // BuySpells (the temples' service) and BuySpellsMages (the Mages
    // Guild's, open to non-members) share one destination. U42 wired
    // it, immediately below: SpellbookWindow in buy mode over the
    // SPELLS.STD records this host loaded.
    //
    // The OFFER is every SPELLS.STD record the host loaded;
    // LoadSpellsForSale's own two laws - drop the '!'-prefixed
    // internal spells, sort by name - live in the window, where DFU
    // keeps them. The price rides this building's quality, so the
    // same spell costs more at a shabby temple.
    if (destination === 'guildServiceSpellbook' && spellbookArtLoaded() && _shopFont) {
      const sbi = typeof spellsByIndex === 'function' ? spellsByIndex() : spellsByIndex;
      if (!sbi) return null;
      let bookWin = null;
      bookWin = new SpellbookWindow({
        spells: () => (playerEntity.spells ??= []),
        entity: playerEntity,
        castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
        offered: () => [...sbi.values()],
        buildingQuality: () => b?.quality ?? 0,
        shopName: () => b?.name ?? '',
        skills: () => ({
          mercantile: skillValue(playerEntity, SKILLS.Mercantile),
          personality: playerEntity.stats?.personality ?? 50,
        }),
        classicMinutes: () => Math.floor(worldMinutes()),
        rows,
        onClose: () => { if (interiorOverlay === bookWin) interiorOverlay = null; },
      }, { buyMode: true });
      // Mount AND hand back, the repair arm's shape rather than the
      // maker windows' `return null` - the popup's onService reads the
      // return value, and a null makes it answer "not available yet"
      // over a window that just opened.
      interiorOverlay = bookWin;
      return bookWin;
    }
    if (destination === 'guildServiceSpellMaker') {
      interiorOverlay = new SpellMakerWindow({
        entity: playerEntity,
        onClose: () => { if (interiorOverlay === flow) interiorOverlay = null; },
      });
      flow = interiorOverlay;
      return interiorOverlay;
    }
    if (destination === 'guildServiceTraining') {
      flow = buildTrainingFlow(playerEntity, guild, membership, {
        rows, now, onClose: () => closeSelf(),
        guildTitle: getTitle(membership, playerEntity, guild),
        // The clock advance and the fatigue drain are the HOST's -
        // trainSkill hands them back rather than reaching for a ticker.
        applyTraining: (result, price) => {
          deductGold(playerEntity, price);
          tallySkill(playerEntity, result.skill, result.tally);
          playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - result.fatigueLoss);
          interiorTicker.advance(result.advanceMinutes);
          surfacePlayer();
        },
      });
    } else if (destination === 'guildServiceDonation') {
      // "Based on the building faction id rather than guild object so
      // it works for non-members as well" (:29-30) - and the id the
      // reputation lands on is the DIVINE's, which for a temple hall
      // is the building faction itself.
      const divine = getDivine(townTalk?.factionDict ?? null, route.buildingFactionId);
      flow = buildDonationFlow(playerEntity, store, DIVINES[divine] ?? route.buildingFactionId, {
        rows, onClose: () => closeSelf(), godName: divine ?? '',
      });
    } else if (destination === 'guildServiceCureDisease') {
      flow = buildCureDiseaseFlow(playerEntity, guild, membership, {
        rows, now, onClose: () => closeSelf(), godName,
        quality: b?.quality ?? 0, regionIndex: b?.regionIndex ?? 0,
        // F113: CalculateCost applies the regional adjustment itself.
        priceAdjustment: regionPriceAdjustment(playerEntity, b?.regionIndex ?? 0),
      });
    } else if (destination === 'questOffer' && questBridge && store) {
      // Q4-v: the guild Quests service - the Q4-ii offer flow through
      // the bridge, boxed for the ServiceFlowWindow. The surface's
      // reputation is the guild's OWN faction rep (Guild.GetReputation
      // reads FactionData for guild.factionId); the two variant groups
      // fall back to the hall's building faction.
      const step = questBridge.offerGuildQuest({
        guildGroup: route.guildGroup,
        guild,
        membership,
        reputation: getReputation(store, guild.factionId ?? route.buildingFactionId),
        buildingFactionId: route.buildingFactionId,
      });
      const boxes = questBridge.offerBoxes(step, rows);
      // A guild offer's first step is 'offer' or 'fail' - both box; an
      // empty chain is the silent-close face and opens nothing.
      if (boxes.length) flow = new ServiceFlowWindow(boxes, { onClose: () => closeSelf() });
    }
    return flow;
  }

  /** ConfirmJoinGuild's welcome box (:527-541): a fresh click-anywhere
   *  box over the popup, which the port shows as its own one-box
   *  window since the popup underneath has already closed. */
  const _welcomeHooks = (guild, rows, self) => ({
    member: () => true,
    service: () => null,
    rows,
    steps: () => [{ textId: guild.text.welcome, clickAnywhere: true, closesWindow: true }],
    onClose: () => { if (interiorOverlay === self()) interiorOverlay = null; },
  });

  // ---- R1: THE REPAIR SERVICE (DaggerfallTradeWindow's Repair mode
  // over the keyed-window idiom - the INVE12I0 native art mode pends
  // with the trade window's own mode flow, the same INTERIM the
  // buy/sell screen documents: transactions conclude AT THE CLICK,
  // one item per payment, so the multi-item queue stretch engages
  // only through the law module's own scheduler). The laws are
  // systems/repairService.js's; this owns gold, the windows and the
  // otherItems moves (PlayerEntity.OtherItems - the in-repair
  // collection, :392). InstantRepairs heals in place; otherwise the
  // item leaves the bag for the shop's queue and comes back through
  // the collect list - finished free, in-progress only past the
  // interrupt confirm, partial and unrefunded (:843-855). ----

  const _rowsText = (rows, fallback) => {
    const t = (rows ?? []).map((r) => r.text).filter((t2) => t2.trim() !== '');
    return t.length ? t : [fallback];
  };
  function repairPrice(it, discount) {
    const b = interiorBuilding;
    const raw = calculateItemRepairCost(itemValue(it), b?.quality ?? 0, it.currentCondition ?? 0, it.maxCondition ?? 0, {
      reducedRepairCost: discount ?? null,
      priceAdjustment: regionPriceAdjustment(playerEntity, b?.regionIndex ?? 0),
    }) * (it.stackCount ?? 1);
    // GetTradePrice: Repair shares the Buy branch (:497-498)
    return calculateTradePrice(raw, b?.quality ?? 0, { mercantile: skillValue(playerEntity, SKILLS.Mercantile), personality: playerEntity.stats?.personality ?? 50 }, false);
  }
  function openRepairService(ctx = {}) { showRepairList(0, ctx); }
  function showRepairList(page, ctx) {
    const now = Math.floor(worldMinutes());
    const jobs = repairJobsAt(playerEntity, interiorBuilding?.buildingKey ?? 0, now);
    // FilterLocalItems' one repair gate is !IsEquipped (:672-703);
    // the condition/enchant/not-repairable refusals land at CLICK
    const locals = (playerEntity.items ?? []).filter((it) => !isEquipped(it));
    const per = 6;
    const slice = locals.slice(page * per, (page + 1) * per);
    const allowMagic = getBool('Controls', 'AllowMagicRepairs');
    const options = slice.map((it, j) => ({
      code: `Digit${j + 1}`,
      label: `${j + 1} - ${_itemLabel(it)}${repairRefusal(it, { allowMagicRepairs: allowMagic }) ? '' : ` (${repairPrice(it, ctx.reducedRepairCost)} gold)`}`,
      action: () => repairItem(it, ctx),
    }));
    if ((page + 1) * per < locals.length) options.push({ code: 'KeyN', label: 'N - more', action: () => showRepairList(page + 1, ctx) });
    if (jobs.length) options.push({ code: 'KeyC', label: `C - collect (${jobs.length} in repair)`, action: () => showRepairJobs(ctx) });
    if (ctx.onTalk) options.push({ code: 'KeyT', label: 'T - talk', action: () => ctx.onTalk() });
    // U40: the popup's THIRD button, which R1 flagged as waiting on the
    // trade window's mode split (DaggerfallMerchantRepairPopupWindow's
    // Sell). The split landed, so the button does.
    if (ctx.onSell) options.push({ code: 'KeyS', label: 'S - sell', action: () => ctx.onSell() });
    options.push({ code: 'Escape', label: 'Esc - close', action: () => {} });
    interiorOverlay = new ChoiceWindow({
      lines: [interiorBuilding?.name || 'Repairs', `Repair: (you have ${goldAmount(playerEntity)} gold)`],
      options,
    });
  }
  function repairItem(it, ctx) {
    const rows = (id) => townTalk?.lines?.(id) ?? [];
    const back = [{ code: 'Escape', label: 'Esc - back', action: () => showRepairList(0, ctx) }];
    const refusal = repairRefusal(it, { allowMagicRepairs: getBool('Controls', 'AllowMagicRepairs') });
    if (refusal) {
      // the three refusals in DFU's click order (:808-818): TEXT.RSC
      // 33 for a magic item, the cannotBeRepaired line for a flagged
      // template, TEXT.RSC 24 for full condition
      const lines = refusal === 'magic' ? _rowsText(rows(MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID), 'You cannot repair magic items.')
        : refusal === 'undamaged' ? _rowsText(rows(DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID), 'This item does not need to be repaired.')
        : [CANNOT_BE_REPAIRED_TEXT];
      interiorOverlay = new ChoiceWindow({ lines, options: back });
      return;
    }
    const price = repairPrice(it, ctx.reducedRepairCost);
    if (goldAmount(playerEntity) < price) {
      interiorOverlay = new ChoiceWindow({ lines: ['You do not have enough gold.'], options: back });
      return;
    }
    deductGold(playerEntity, price);
    tallySkill(playerEntity, SKILLS.Mercantile, 1);   // OnTrade's tally (:1088)
    if (getBool('Controls', 'InstantRepairs')) {
      it.currentCondition = it.maxCondition;   // the InstantRepairs branch (:1062-1065)
    } else {
      const now = Math.floor(worldMinutes());
      // DFU's commit pass runs over remoteItemsFiltered - EVERY job at
      // this shop plus the new one - which is what makes the longest-job
      // queue stretch and the never-decrease clamp real laws rather
      // than dead arms of a one-item list (:1069 -> :514-568).
      const bk = interiorBuilding?.buildingKey ?? 0;
      updateRepairTimes([...repairJobsAt(playerEntity, bk, now), it], { commit: true, nowMinutes: now, buildingKey: bk });
      const i = playerEntity.items.indexOf(it);
      if (i >= 0) playerEntity.items.splice(i, 1);
      (playerEntity.otherItems ??= []).push(it);
      // the repairNote (:536-537 - key repairNote, prose ours)
      questBridge?.notebook?.addNote?.(`Left ${_itemLabel(it)} to be repaired at ${interiorBuilding?.name ?? 'the shop'}.`);
    }
    surfacePlayer();
    showRepairList(0, ctx);
  }
  function showRepairJobs(ctx, page = 0) {
    const now = Math.floor(worldMinutes());
    const jobs = repairJobsAt(playerEntity, interiorBuilding?.buildingKey ?? 0, now);
    if (!jobs.length) { showRepairList(0, ctx); return; }
    const per = 8;
    const slice = jobs.slice(page * per, (page + 1) * per);
    const options = slice.map((it, j) => ({
      code: `Digit${j + 1}`,
      label: `${j + 1} - ${_itemLabel(it)} (${repairStatusLabel(it, now)})`,
      action: () => collectJob(it, ctx),
    }));
    if ((page + 1) * per < jobs.length) options.push({ code: 'KeyN', label: 'N - more', action: () => showRepairJobs(ctx, page + 1) });
    options.push({ code: 'Escape', label: 'Esc - back', action: () => showRepairList(0, ctx) });
    interiorOverlay = new ChoiceWindow({ lines: ['Items left for repair:'], options });
  }
  function collectJob(it, ctx) {
    const now = Math.floor(worldMinutes());
    const takeBack = () => {
      const i = (playerEntity.otherItems ?? []).indexOf(it);
      if (i >= 0) playerEntity.otherItems.splice(i, 1);
      (playerEntity.items ??= []).push(it);
      collectRepaired(it);
      showRepairJobs(ctx);
    };
    if (isBeingRepaired(it) && !isRepairFinished(it, now)) {
      // interruptRepair's Yes/No (:843-855): the item comes back
      // partial, the gold stays spent
      interiorOverlay = new ChoiceWindow({
        lines: ['Do you want to interrupt the repair?'],   // key interruptRepair, prose ours
        options: [
          { code: 'KeyY', label: 'Y - yes', action: takeBack },
          { code: 'KeyN', label: 'N - no', action: () => showRepairJobs(ctx) },
        ],
      });
      return;
    }
    takeBack();
  }

  function showShelfList(shelf, page) {
    const per = 8;
    const slice = shelf.items.slice(page * per, (page + 1) * per);
    const options = slice.map((it, j) => ({
      code: `Digit${j + 1}`, label: `${j + 1} - ${_itemLabel(it)} (${buyPrice(it)} gold)`,
      action: () => buyItem(shelf, it),
    }));
    if ((page + 1) * per < shelf.items.length) options.push({ code: 'KeyN', label: 'N - more', action: () => showShelfList(shelf, page + 1) });
    // E3: the sell mode (storeBuysItemType gates what they take)
    if ((SHOP_BUYS_GROUPS[interiorBuilding.buildingType] ?? []).length) {
      options.push({ code: 'KeyS', label: 'S - sell', action: () => showSellList(shelf, 0) });
    }
    options.push({ code: 'Escape', label: 'Esc - close', action: () => {} });
    interiorOverlay = new ChoiceWindow({
      lines: [interiorBuilding.name || 'Shelves', shelf.items.length ? `Buy: (you have ${goldAmount(playerEntity)} gold)` : 'The shelf is empty.'],
      options,
    });
  }
  function buyItem(shelf, it) {
    if (doBuy(shelf, it) === null) {
      interiorOverlay = new ChoiceWindow({ lines: ['You do not have enough gold.'], options: [{ code: 'Escape', label: 'Esc - close', action: () => {} }] });
      return;
    }
    showShelfList(shelf, 0);
  }
  function showSellList(shelf, page) {
    const sellable = (playerEntity.items ?? []).filter((it) => shopBuysItem(interiorBuilding.buildingType, it) && !isEquipped(it));   // AUDIT 17e F4
    const per = 8;
    const slice = sellable.slice(page * per, (page + 1) * per);
    const options = slice.map((it, j) => ({
      code: `Digit${j + 1}`, label: `${j + 1} - ${_itemLabel(it)} (${sellPrice(it)} gold)`,
      action: () => sellItem(shelf, it),
    }));
    if ((page + 1) * per < sellable.length) options.push({ code: 'KeyN', label: 'N - more', action: () => showSellList(shelf, page + 1) });
    options.push({ code: 'KeyB', label: 'B - buy', action: () => showShelfList(shelf, 0) });
    options.push({ code: 'Escape', label: 'Esc - close', action: () => {} });
    interiorOverlay = new ChoiceWindow({
      lines: [interiorBuilding.name || 'Shelves', sellable.length ? `Sell: (you have ${goldAmount(playerEntity)} gold)` : 'You have nothing they want.'],
      options,
    });
  }
  function sellItem(shelf, it) {
    doSell(shelf, it);
    showSellList(shelf, 0);
  }
  let exitReturn = null;
  let dungeonCtx = null;
  let dungeonLoc = null;    // B2: the mounted dungeon's dfLocation (playerInside's dungeon arm)
  let dungeonReturn = null; // entrance-door candidates of the group
  let transitioning = false;

  const eyeDir = () =>
    [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const objAabb = (o) => worldAabb(o.cpu.positions, o.matrix);

  async function tryEnter() {
    const eye = player.eye;
    const dir = eyeDir();
    const entries = doorTargets();
    const targets = entries.map((entry, i) => ({
      key: i, aabb: doorWorldAabb(entry.door),
    }));
    // AUDIT 26 (F019/F190): THE STREET'S STATIC NPCs, in the SAME ray
    // as the doors. DFU has one activation raycast above ground and
    // routes by what it hit (PlayerActivate.cs:1229 reads the
    // StaticNPC off the hit, :741-767 activates it), so an exterior
    // NPC and a door compete by distance, not by precedence. The reach
    // is StaticNPCActivationDistance (:87), twice a door's, and the
    // AABB is the swept billboard box the interior host's people take.
    // A person whose archive gave no size is not a target at all.
    //
    // collectExteriorNpcs (RMBLayout.cs:366-378/:442-454) had NO
    // production caller before this: no street NPC was ever stood, so
    // none could be clicked or talked to above ground.
    const npcs = npcTargets?.() ?? [];
    npcs.forEach((pn, i) => {
      if (!pn.width) return;
      targets.push({ key: `person:${i}`, aabb: personAabb(pn), distance: STATIC_NPC_ACTIVATION_DISTANCE });
    });
    // THE BULLETIN BOARDS, in the SAME ray as the doors and the street
    // NPCs - PlayerActivate casts one ray and routes by what it hit
    // (:314, :393-398), so a board and a door compete by distance.
    // Their reach here is the RAY's, not the board's: DFU's hit test
    // is the raycast (RayDistance), and the board's own
    // MobileNPCActivationDistance is a SECOND test inside
    // ActivateBulletinBoard (:709-713) whose failure speaks the
    // refusal instead of falling through. A board the player can see
    // but not reach therefore consumes the click, exactly as C# does.
    const boards = boardTargets?.() ?? [];
    boards.forEach((aabb, i) => targets.push({ key: `board:${i}`, aabb, distance: RAY_DISTANCE }));
    const key = pickActivatable(eye, dir, targets, baseCollider());
    if (key === null) return false;
    // ...and the NPC arm ENDS the activation, exactly as the interior
    // ray's does: an NPC under the ray is not a door.
    if (typeof key === 'string' && key.startsWith('person:')) {
      activateStaticNpc(npcs[Number(key.split(':')[1])]);
      return true;
    }
    if (typeof key === 'string' && key.startsWith('board:')) {
      activateBulletinBoard(boards[Number(key.split(':')[1])], eye, dir);
      return true;
    }
    return activateStaticDoor(entries[key], entries, false);
  }

  /** ROAD-B: ActivateStaticDoor (PlayerActivate.cs:486-632) as its own
   *  member, because it has TWO callers in DFU and the port only ever
   *  had one. The click reaches it through the activation ray
   *  (tryEnter, above) with `isBash` false; a WEAPON SWING reaches it
   *  through AttemptExteriorDoorBash (:1056-1079) with `isBash` true,
   *  and that second caller is what R1's FLAG said was missing -
   *  "what is missing is not the two rolls but the INPUT that would
   *  reach them". `attemptExteriorDoorBash` below is that input. */
  async function activateStaticDoor(hit, entries, isBash = false) {
    // Route by verbatim door type: buildings to interiors, dungeon
    // entrances into the RDB crawl.
    // :507-509 - the bash SOUND, before any of the type routing and
    // on every door but a dungeon exit. DFU plays it from
    // PlayerActivate's own AudioSource (the player), not from the
    // door, which is why this is playOneShot and not play3d.
    if (isBash && hit.door.doorType !== DOOR_TYPE.DUNGEON_EXIT) audio.playOneShot(SOUND.PlayerDoorBash, 1);
    if (hit.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE) return tryEnterDungeon(hit, entries);
    if (hit.door.doorType !== DOOR_TYPE.BUILDING || hit.recordIndex === undefined) return false;
    // R1: THE EXTERIOR DOOR LOCK (ActivateStaticDoor, PlayerActivate.cs
    // :512-568). Closed hours lock the town: the unlocked ladder runs
    // first, and its top two rungs - owned houses and active-quest
    // buildings, buildingLocks.js:65-68 = PlayerActivate.cs:1262/:1266
    // - are answered at the call below (`isActiveQuestBuilding` off
    // the siteLinks walk with DFU's residencesOnly default,
    // `isHouseOwned` over playerEntity.houses), which is the hookup
    // R1 wrote that contract for. A locked door in any mode but Steal
    // speaks the refusal + the look-at text (classic's
    // interior-formula oversight included); Steal mode picks - gated
    // by the per-building anti-grind record (the skill must RISE past
    // the last failure), tallying Lockpicking before the roll, entering
    // ONCE on success (no persistent unlock - DFU's isBrokenIn is
    // local) and recording the skill on failure. DiscoverBuilding
    // fires on the activation (:515). X3 wired the Open-spell bypass
    // (:519-520).
    // TallyCrimeGuildRequirements landed at CG2 on the success arm
    // below; BG1 took the greeting (:585-628) at the tail.
    //
    // ROAD-B CLOSED R1's FLAG. It read: "the two BASH arms (:571-583
    // the failed bash -> 10% noticed -> Attempted_Breaking_And_Entering;
    // :621-627 the bash of an ALREADY OPEN door -> 10% ->
    // Breaking_And_Entering). Both hang off DFU's `isBash`... and
    // outdoors this port has no such path... So what is missing is not
    // the two rolls but the INPUT that would reach them... the day that
    // input lands the arms drop in beside it." The input is
    // `attemptExteriorDoorBash` (below, off the exterior weapon swing -
    // WeaponManager.WeaponEnvDamage:474-477), and the arms are here:
    // `isBrokenIn` starts from the real isBash, the Open spell and the
    // whole lock ladder are skipped for a bash exactly as :519-521 and
    // :523-524 skip them, and the two rolls sit where C# puts them.
    {
      const bd = buildingDataForDoor?.(hit) ?? null;
      const locId = discoveryLocationId?.() ?? null;
      // A door whose building the directory cannot resolve FAILS OPEN
      // (enters unconditionally) - the pre-R1 behavior, kept
      // deliberately: refusing entry on missing data would strand a
      // player where DFU always has BuildingSummary.
      if (bd && bd.buildingType != null) {
        if (locId) discoverBuilding(locId, bd);
        const minutes = Math.floor(worldMinutes());
        const dict = townTalk?.factionDict ?? null;
        const unlocked = buildingIsUnlocked(bd, {
          hour: Math.floor((minutes % 1440) / 60),
          holidayId: getHolidayId(minutes, bd.regionIndex ?? 0),
          guildForBuilding: (factionId) => {
            const guild = guildOfFaction(factionId, resolveVariantGuild(dict), dict);
            if (!guild) return null;
            const m = membershipOf(activeMemberships(playerEntity), guild);
            return { hallAccessAnytime: hallAccessAnytime(guild, m), isMember: isMember(m) };
          },
          isActiveQuestBuilding: (b) => {
            if (!questBridge || !isResidence(b.buildingType)) return false;   // residencesOnly, DFU's default
            const mapId = questSceneCtx?.()?.mapId ?? 0;
            return questBridge.machine.getSiteLinks(SITE_TYPES.Building, mapId, b.buildingKey).length > 0;
          },
          // H1: your own front door is not locked against you
          // (buildingLocks.js:65 - the first thing the ladder tests).
          // The hook has been in that law's contract since R1 with
          // nothing able to answer it.
          isHouseOwned: (key) => isHouseOwned(playerEntity.houses ?? [], bd.regionIndex ?? 0, key),
        });
        // X3: HandleOpenEffectOnExteriorDoor (:519-520). An armed OPEN
        // spell is tried on a locked building BEFORE the mode ladder,
        // and it spends itself either way (Open.cs:158's CancelEffect
        // sits outside the success branch) - a failure falls through
        // to the ordinary refusal/pick ladder below with the spell
        // gone. LOCK has no exterior arm at all in DFU (PlayerActivate
        // calls HandleLockEffect only from the action-door path), so an
        // armed Lock is left untouched here, still waiting for a real
        // door: doorSpellFor only answers 'lock' when no Open is armed,
        // and the kind test below refuses it.
        let opened = unlocked;
        // BG1: DFU carries TWO variables here and they answer different
        // questions (:517-518). `buildingUnlocked` is this host's
        // `opened`; `isBrokenIn` starts as isBash, is raised by the
        // Open SPELL *together with* buildingUnlocked, and is raised
        // ALONE by a successful pick - which is what makes a picked
        // shop still state its quality while a magicked house says
        // nothing at all. ROAD-B: `var isBrokenIn = isBash;` (:517) -
        // "Breaking in can be done via unlocking or bashing", so a
        // bashed house says nothing either.
        let isBrokenIn = isBash;
        const lockValue = buildingLockValue(bd.quality);
        // :519-520 - `if (!buildingUnlocked && !isBash && ...)`: a
        // swing never spends the readied Open spell.
        if (!opened && !isBash) {
          const spell = doorSpellFor(playerEntity);
          if (spell?.kind === 'open') {
            const r = triggerExteriorOpen(lockValue, spell.holderLevel);
            consumeDoorSpell(playerEntity, 'open');
            if (r.alert) townTalk?.say?.(DOOR_SPELL_TEXT[r.alert]);
            opened = r.opened;
            if (r.opened) isBrokenIn = true;   // `buildingUnlocked = isBrokenIn = true`
          }
        }
        // :523-524 - `if (!buildingUnlocked && !isBash)`: the WHOLE
        // mode ladder (the refusal, the look-at text, the Steal pick
        // and its anti-grind record) belongs to the activation ray. A
        // swing does not read the interaction mode and does not train
        // Lockpicking; it goes straight to the bash roll below.
        if (!opened && !isBash) {
          const lockpick = skillValue(playerEntity, SKILLS.Lockpicking);
          if (getInteractionMode() !== 'steal') {
            townTalk?.say?.(LOCKED_EXTERIOR_DOOR_TEXT);
            townTalk?.say?.(lookAtLockText(lockValue, playerEntity.level, lockpick));
            return true;
          }
          if (locId && lockpick <= getLastLockpickAttempt(locId, bd.buildingKey)) {
            townTalk?.say?.(lookAtLockText(lockValue, playerEntity.level, lockpick));
            return true;
          }
          tallySkill(playerEntity, SKILLS.Lockpicking, 1);
          const chance = exteriorLockpickingChance(lockValue, lockpick);
          const roll = 1 + Math.floor(Math.random() * 100);   // Random.Range(1, 101), success strictly chance > roll
          if (chance > roll) {
            // CG2: PlayerActivate.cs:552 - the tally lands BEFORE the
            // success text and the unlock sound, as it does in C#. A
            // picked exterior lock IS a break-in and counts one toward
            // the Thieves Guild's ten; the FAILED roll below tallies
            // nothing, because nothing was broken into.
            tallyCrimeGuildRequirements(playerEntity, true, 1);
            townTalk?.say?.(LOCKPICKING_SUCCESS_TEXT);
            audio.playOneShot(SOUND.ActivateLockUnlock, 1);
            isBrokenIn = true;   // :557 - the pick raises THIS and never buildingUnlocked
          } else {
            townTalk?.say?.(LOCKPICKING_FAILURE_TEXT);
            if (locId) setLastLockpickAttempt(locId, bd.buildingKey, lockpick);
            return true;
          }
        }
        // ROAD-B - THE FIRST BASH ARM (:570-583). "Classic makes a roll
        // whether it is locked or not", and DFU's comment is the law:
        // the roll is `Dice100.FailedRoll(25 - buildingLockValue)`, so
        // the bash OPENS on a success of that chance and a FAILURE ends
        // the activation here. A quality-50 building (lock 25) can
        // never be bashed open at all; a hovel (lock 0) opens one time
        // in four. `!buildingUnlocked` is `!opened`: a door already
        // standing open is not bashed, it is walked through - that is
        // the SECOND arm, below.
        //
        // And the crime is only levied when someone NOTICES: a nested
        // Dice100.SuccessRoll(10) inside the failure. Nine failed bashes
        // in ten cost nothing at all, which is why bashing a door is a
        // real, if stupid, way into a house.
        if (isBash && !opened) {
          if (!dice100(25 - lockValue, Math.random())) {   // Dice100.FailedRoll(25 - lock)
            if (dice100(10, Math.random())) {
              setCrimeCommitted(playerEntity, CRIMES.Attempted_Breaking_And_Entering);   // PT1: the ONE crime write
              host.spawnCityGuards?.(true);
            }
            return true;   // :582 - the failed bash consumes the swing and does NOT enter
          }
          // A successful bash IS the way in; `opened` stays false so
          // the greeting below reads it exactly as DFU's
          // buildingUnlocked does (isBrokenIn is already true).
        }
        // BG1: the greeting (:585-628). `buildingGreetingsEnabled` is a
        // DFU static defaulted TRUE, not a settings key, so it is a
        // named constant rather than an invented registry entry.
        // PlayerActivate.cs:109 - `public static bool
        // buildingGreetingsEnabled = true`. A static field, not a
        // settings key, so it is a constant here rather than an
        // invented registry entry (the port's own settings doctrine).
        const greet = buildingGreeting({
          buildingType: bd.buildingType,
          quality: bd.quality ?? 0,
          factionId: bd.factionId ?? 0,
          buildingUnlocked: opened,
          isBrokenIn,
          houseOwned: isHouseOwned(playerEntity.houses ?? [], bd.regionIndex ?? 0, bd.buildingKey),
          isShop: isShop(bd.buildingType),
        });
        if (greet) {
          // The house greeting is a RANDOM variant of record 256
          // (GetRandomText); the quality line is the record itself.
          const lines = greet.kind === 'house'
            ? [townTalk?.randomText?.(greet.textId) ?? ''].filter((l) => l.trim() !== '')
            : (townTalk?.lines?.(greet.textId) ?? []).map((r) => r.text).filter((l) => l.trim() !== '');
          const how = greet.kind === 'house'
            ? 'popup'   // the house greeting is not behind ShopQualityPresentation
            : shopQualityPresentation();   // the law reads the setting, as PresentShopQuality does
          if (lines.length && how === 'popup' && townTalk?.showOverlay) {
            // :617-623 - the transition DEFERS to the box closing.
            // AUDIT 39 (#164): the callback fires synchronously and
            // discarded the promise, so a refused interior (the
            // no-landing throw) escaped to main.js's unhandledrejection
            // handler and painted CRASH over a game still running. The
            // catch is the one the two host call sites already put on
            // the non-deferred arm.
            townTalk.showOverlay(new ChoiceWindow({ lines }), () => { enterInteriorCore(hit, entries).catch((e) => console.error(e)); });
            return true;
          }
          // The HUD arm speaks and does NOT defer (:1379-1386); 'none'
          // says nothing and also does not defer.
          // AUDIT 28 W6: AddHUDText(text, Settings.ShopQualityHUDDelay)
          // (:1382) - each line stays up for the setting's seconds,
          // GetInt 1..10 (SettingsManager :494). The default hudText
          // delay is not this law's.
          if (lines.length && how === 'hud') for (const l of lines) townTalk?.say?.(l, getInt('GUI', 'ShopQualityHUDDelay', 1, 10));
        }
        // ROAD-B - THE SECOND BASH ARM (:621-627). "Bashing open an
        // unlocked door potentially alerts the guards": a flat 10%, no
        // lock term, and the crime is the full Breaking_And_Entering
        // rather than the attempt - the door DID open. It sits INSIDE
        // DFU's `if (hitBuilding && buildingGreetingsEnabled)` block
        // and AFTER the deferred-messagebox return, so a bash that
        // raised a greeting popup skips the roll entirely (the return
        // above is that same return) and only a bash that showed no box
        // - or showed the HUD line - can be noticed. Ported where C#
        // has it rather than where it reads more sensibly.
        if (isBash && dice100(10, Math.random())) {
          setCrimeCommitted(playerEntity, CRIMES.Breaking_And_Entering);
          host.spawnCityGuards?.(true);
        }
      }
    }
    return enterInteriorCore(hit, entries);
  }

  /** ROAD-B: PlayerActivate.AttemptExteriorDoorBash (:1056-1079) - THE
   *  INPUT R1's flag was waiting for. WeaponManager.WeaponEnvDamage
   *  (:474-477) offers every swing that met no action object to the
   *  static doors, and a door under the swing runs the WHOLE of
   *  ActivateStaticDoor with isBash true.
   *
   *  The ray is the SWING's, not the activation click's: DFU's `hit`
   *  comes from WeaponManager's own SphereCast along the camera at
   *  `weapon.Reach` (:1064), which is why the reach here is
   *  WEAPON_REACH and not DEFAULT_ACTIVATION_DISTANCE. That also makes
   *  ActivateStaticDoor's `hit.distance > DoorActivationDistance`
   *  refusal (:500-504) unreachable on this path - the weapon cannot
   *  reach 3.2 units - so it is not re-tested here; the click's own
   *  caller still enforces it through pickActivatable.
   *
   *  Only DOORS are targets: the street's NPCs and bulletin boards are
   *  in the activation ray, not the weapon's. The return is DFU's -
   *  `door.doorType != DoorTypes.DungeonExit`, i.e. the swing was
   *  consumed - which above ground is "a door was under it".
   *  @returns {boolean} true when the swing hit a door */
  function attemptExteriorDoorBash(eye, dir) {
    if (mode !== 'exterior') return false;
    const entries = doorTargets();
    const key = pickActivatable(eye, dir,
      entries.map((entry, i) => ({ key: i, aabb: doorWorldAabb(entry.door), distance: WEAPON_REACH })),
      baseCollider());
    if (key === null) return false;
    const hit = entries[key];
    activateStaticDoor(hit, entries, true).catch((e) => console.error('[bash]', e));
    return hit.door.doorType !== DOOR_TYPE.DUNGEON_EXIT;
  }

  /** IS1: TransitionInterior's shared core - the clicked door
   *  (tryEnter, above) and the load re-entry (restoreInterior) both
   *  land here, exactly as DFU routes the click (PlayerActivate) and
   *  the Respawner's building arm (StartBuildingInterior :1022-1035)
   *  through the ONE TransitionInterior. A `restore` bag carries what
   *  the save resolved live at ITS entry time - the building identity
   *  with the insideOpenShop latch already on it (SerializablePlayer
   *  .cs:394-400 restores BuildingDiscoveryData + IsPlayerInsideOpenShop
   *  rather than recomputing at the load hour, which is what keeps a
   *  shop entered while open an open shop) - and the saved position,
   *  which lands RAW after the layout (RestorePosition's interior arm,
   *  transform.position = the saved value). */
  /** TransportManager.HandleTransition (:196-202): the two interior
   *  transitions dismount, and nothing else does - DFU has no arm for
   *  LEAVING one, so you walk out on foot. TR5. */
  function dismountPlayer(transition) {
    const next = dismountOnTransition(player.transportMode, transition);
    if (next !== player.transportMode) host.setTransportMode?.(next);
  }

  async function enterInteriorCore(hit, entries, restore = null) {
    // TR5: TransportManager.HandleTransition (:196-202) - a BUILDING
    // interior puts you back on foot. The law shipped in TR1 with no
    // caller; this is it.
    dismountPlayer('ToBuildingInterior');
    transitioning = true;
    try {
      // E2/P1: the building's identity, resolved BEFORE the interior
      // stands. DFU's transition does the same three things in this
      // order (PlayerActivate.cs:1119-1121): take the discovered
      // building, latch IsPlayerInsideOpenShop from it, and only then
      // call TransitionInterior - which is what reaches AddPeople with
      // a `buildingData` already in hand. The port used to resolve the
      // identity AFTER buildInteriorContext, which is why the people
      // gate had nothing to read.
      const _hour = Math.floor((Math.floor(worldMinutes()) % 1440) / 60);
      let insideOpenShop;
      if (restore) {
        // The SAVED record stands whole - identity, latch and all.
        interiorBuilding = restore.building ?? null;
        insideOpenShop = !!interiorBuilding?.insideOpenShop;
      } else {
        interiorBuilding = buildingDataForDoor?.(hit) ?? null;
        // PlayerActivate.cs:1120 verbatim - computed once, at the door,
        // and then left alone. A shop entered while open keeps its
        // people even if the player is still inside at closing time.
        const _bt = interiorBuilding?.buildingType;
        insideOpenShop = _bt != null && isShop(_bt) && isBuildingOpen(_bt, _hour);
        // AUDIT 26 F066: the latch RIDES the building record, because
        // PlayerActivate reads it again at shelf time (:887-899) - the
        // port computed it here for the people gate and then dropped it,
        // so a shop broken into after hours still sold at full price.
        if (interiorBuilding) interiorBuilding.insideOpenShop = insideOpenShop;
      }
      // ROAD-B B4: the OTHER TWO latches PlayerActivate.TransitionInterior
      // sets in the same breath as insideOpenShop -
      //   playerEnterExit.IsPlayerInsideTavern    = RMBLayout.IsTavern(db.buildingType);
      //   playerEnterExit.IsPlayerInsideResidence = RMBLayout.IsResidence(db.buildingType);
      // (PlayerActivate.cs:1121-1122). Both were MISSING outright, so
      // SpawnCityGuards' indoor arm (PlayerEntity.cs:628-641) could never
      // recognise a tavern or a house and fell through to the exterior
      // street pool. Like insideOpenShop they are "set upon entry" flags
      // (PlayerEnterExit.cs:162-170) rather than live reads, and they
      // ride the building record for the same reason its sibling does -
      // SerializablePlayer.cs:220-221/:398-399 round-trips all three
      // together, restoring rather than recomputing.
      //
      // The restore arm may recompute here without disagreeing with the
      // save: unlike insideOpenShop, whose IsBuildingOpen term is a
      // function of the HOUR at entry, IsTavern and IsResidence are pure
      // functions of buildingType, and the restored record carries that
      // buildingType. Same value either way.
      _insideTavern = isTavern(interiorBuilding?.buildingType ?? BUILDING_TYPES.None);
      _insideResidence = isResidence(interiorBuilding?.buildingType ?? BUILDING_TYPES.None);
      if (interiorBuilding) {
        interiorBuilding.insideTavern = _insideTavern;
        interiorBuilding.insideResidence = _insideResidence;
      }
      const _dict = townTalk?.factionDict ?? null;
      const peopleVisible = !interiorBuilding ? true : peopleAreVisible(interiorBuilding, {
        hour: _hour,
        insideOpenShop,
        isHouseOwned: (key) => isHouseOwned(playerEntity.houses ?? [], interiorBuilding?.regionIndex ?? 0, key),
        guildForBuilding: (factionId) => {
          const g = guildOfFaction(factionId, resolveVariantGuild(_dict), _dict);
          if (!g) return null;
          const m = membershipOf(activeMemberships(playerEntity), g);
          return { hallAccessAnytime: hallAccessAnytime(g, m), isMember: isMember(m) };
        },
      });
      // HC1: AddFurnitureAction's IsHouseOwned(buildingKey) answer,
      // evaluated at build like DFU's (:816) - the bank registry is the
      // host's, the peopleVisible idiom. Ships route at ACTIVATION
      // only, as DFU does.
      const houseOwned = !!interiorBuilding && isHouseOwned(playerEntity.houses ?? [], interiorBuilding.regionIndex ?? 0, interiorBuilding.buildingKey);
      // P8: parent the interior at the entered building's world matrix
      // (verbatim ownerPosition + buildingMatrix) - context coordinates
      // come back world-frame, landings run in one frame, and the walk
      // through the door is coordinate-seamless.
      const ctx = await buildInteriorContext(
        { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette, getMachineryParts },
        // DaggerfallInterior.IsBadInteriorModel (:530-548) keys the
        // 31000-overlap repair on EntryDoor.blockIndex, which
        // RMBLayout.cs:848 mints as blockData.Index. The literal 0 is
        // not a key in the table, so the repair could never fire when
        // a building was entered from ?world / ?exterior - the same
        // building reached through ?interior=NAME:REC omitted it.
        hit.dfBlock, hit.dfBlock.index, hit.recordIndex, hit.climateBase, hit.season,
        hit.door.matrix, {
          voxelfolk, piece, paint, setupStaticNpc, houseOwned, peopleVisible,
          // ROAD-C c2/S9: SetupBeacons(door)'s building arm - the
          // entrance beacon stands at the door walked through
          // (Automap.cs:1450-1457), with rayEntrancePosOffset (0,0,0).
          entrance: doorWorldPosition(hit.door),
          // ...and RestoreStateAutomapDungeon's tail (:2362-2379): the
          // BUILDING is looked up in the DUNGEON dictionary by this
          // location's own "RegionName/Name" - which a town and the
          // dungeon beneath it share - and the beacon takes that
          // record's entranceDiscovered before the locationName
          // mismatch ends the restore. A READ; nothing about a
          // building ever enters that dictionary (systems/automap.js).
          dungeonEntranceDiscovered: !!getDungeonAutomap(
            automapDungeonKey(hit.dfLocation?.regionIndex ?? -1, hit.dfLocation?.name ?? ''))?.entranceDiscovered,
        });
      const siblings = entries.filter((e) =>
        e.dfBlock === hit.dfBlock && e.recordIndex === hit.recordIndex);
      const landing = interiorLanding(
        doorWorldPosition(hit.door), ctx.enterMarkers, ctx.doors);
      // NT1 (F054): the context is fully built - GPU billboard batches,
      // voxelfolk meshes - and `interiorCtx` is not yet assigned, so a
      // throw here used to leak the whole build on EVERY E-press at
      // such a door (the callers only log it). Free it first.
      if (!landing) { ctx.destroy(); throw new Error('no interior landing'); }
      exitReturn = { siblings };
      exteriorDoor = hit.door;   // IS1: SetExteriorDoors - the save's way back in
      interiorCtx = ctx;
      interiorFoes = makeInteriorFoes(ctx);   // IF: the pool lives exactly as long as the interior does
      interiorGuards = makeInteriorGuards(ctx);   // ROAD-B: ...and so does the watch that can be called into it
      // X1: an armed Open/Lock spell fires on this interior's doors
      // too - the same law the dungeon context wires for its own.
      wireDoorSpells(ctx.actions, playerEntity, (t) => townTalk?.say?.(t));
      // (interiorBuilding was resolved above, before the context was
      // built - P1 needs it to gate the people.)
      ensureInteriorWindowArt();   // U23: every interior can open a window now
      // ROAD-C c2/S9: InitWhenInInteriorOrDungeon's building arm raises
      // `resetAutomapSettingsFromExternalScript` exactly as the dungeon
      // arm does (Automap.cs:2486), so the window's next OnPush resets
      // the view - and picks CUTOUT as the default render mode, because
      // "floors above the current are often distracting" in a building
      // (window :587-596). The signal is pulled and erased once.
      signalAutomapReset();
      // P1: RestoreCachedScene (:804) - after the identity is known,
      // because the scene NAME is built from the building key.
      restoreInteriorScene();
      // Q4-v: the quest layer mounts with the interior (RMBLayout's
      // AddQuestResourceObjects moment - the walk runs once the site's
      // buildingKey is known).
      mountQuestResources();
      // Music is NOT started here any more. AUDIT 19's 1:1 pass moved it
      // to the SongManager: the host feeds a context every frame and the
      // manager decides when the song changes, which is the only way to
      // get DFU's law that a new day or a new location re-picks even when
      // the playlist is identical. `musicContext()` below reports this
      // host's half of that context.
      player.collider = ctx.collider;
      const floored = floorLanding(ctx.collider, landing);   // verbatim FixStanding: instant snap, no gravity drop-in
      // IS1: a restore lands the SAVED position raw over the door
      // landing (RestorePosition: transform.position = saved, the
      // interior arm) - the landing above still ran, because a
      // doorless interior must refuse a restore exactly as it refuses
      // a click.
      const spot = restore?.pos ?? floored;
      player.spawn(spot[0], spot[1], spot[2]);
      mode = 'interior';
      console.log(`interior: ${ctx.drawList.length} draws, ${ctx.doors.length} doors, ${ctx.lights.length} lights, ${ctx.people.length} people`);
    } finally {
      transitioning = false;
    }
    return true;
  }

  function rayAabbProbe(eye, dir, aabb) {
    let tMin = 0;
    let tMax = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) {
        if (eye[a] < aabb.min[a] || eye[a] > aabb.max[a]) return null;
        continue;
      }
      const inv = 1 / dir[a];
      let t0 = (aabb.min[a] - eye[a]) * inv;
      let t1 = (aabb.max[a] - eye[a]) * inv;
      if (t0 > t1) { const sw = t0; t0 = t1; t1 = sw; }
      if (t0 > tMin) tMin = t0;
      if (t1 < tMax) tMax = t1;
      if (tMin > tMax) return null;
    }
    return +tMin.toFixed(2);
  }

  function tryExit() {
    const eye = player.eye;
    const dir = eyeDir();
    // Exit doors and interior swing doors share the E ray; swing doors
    // use their LIVE matrices via the ActionSystem objects.
    const targets = interiorCtx.doors.map((d, i) => ({ key: `exit:${i}`, aabb: doorWorldAabb(d) }));
    interiorCtx.containers.forEach((c, i) => {
      targets.push({ key: `container:${i}`, aabb: worldAabb(c.cpu.positions, c.matrix) });   // S2b
    });
    interiorCtx.shelves.forEach((s, i) => {
      targets.push({ key: `shelf:${i}`, aabb: worldAabb(s.cpu.positions, s.matrix) });   // E2
    });
    for (const o of interiorCtx.actions.objects.values()) {
      targets.push({ key: o.key, aabb: objAabb(o) });
    }
    interiorCtx.ladders.forEach((l, i) => {
      targets.push({ key: `ladder:${i}`, aabb: objAabb(l) });
    });
    targets.push(...interiorDropped.lootTargets());   // ID1: the player's own piles, the dungeon's key vocabulary
    // U23: the StaticNPCs. Their reach is DFU's own 256 classic units
    // (PlayerActivate.cs:87), twice a door's, and a person with no
    // billboard size resolved is not a target at all.
    interiorCtx.people.forEach((pn, i) => {
      if (!pn.width || pn.active === false) return;   // SetActive(false) takes the collider too
      targets.push({ key: `person:${i}`, aabb: personAabb(pn), distance: STATIC_NPC_ACTIVATION_DISTANCE });
    });
    // Q4-v: quest stands activate like StaticNPCs - a click routes
    // QuestResourceBehaviour.DoClick.
    // AUDIT 24 (wave 22): but only a PERSON gets the static-NPC reach.
    // PlayerActivate.cs:326-332 gates the quest-resource arm on
    // `!(questResourceBehaviour.TargetResource is Person)` and then
    // measures against DefaultActivationDistance (128), half a static
    // NPC's 256 - so a quest ITEM on the floor had twice DFU's reach.
    // A behaviour with NO target resource takes the 128 arm too
    // (`!(null is Person)` is true), which the ?? below preserves.
    // DELTA (recorded): C# prints "You are too far away." and aborts
    // the whole activation when the resource is hit beyond 128; the
    // port's picker simply does not select it, so a too-far click
    // falls through to whatever is behind it and says nothing.
    targets.push(...questFlatTargets(questFlats));
    const key = pickActivatable(eye, dir, targets, interiorCtx.collider);
    if (key === null) return false;
    if (key.startsWith('ladder:')) {
      // Verbatim ClimbLadder: closest markers, below-top -> top,
      // above-bottom -> bottom.
      // ClimbLadder compares the CONTROLLER position, which after
      // FixStanding sits at floor + height * 0.65 = 1.17 (PlayerMotor
      // repositions to hit + up * (controller.height * 0.65f)) - NOT
      // the geometric half-height. The teleport target re-floors via
      // gravity exactly as FixStanding would.
      const standing = [player.pos[0], player.pos[1] + 1.8 * 0.65, player.pos[2]];
      const to = climbLadder(standing, interiorCtx.markers, INTERIOR_MARKER);
      if (to) {
        // Teleport just ABOVE the marker and let gravity floor it -
        // FixStanding's re-floor, without tunneling thin boards.
        player.spawn(to[0], to[1] + 0.1, to[2]);
        cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      }
      return true;
    }
    if (!key.startsWith('exit:')) {
      if (key.startsWith('shelf:')) {
        openShelf(Number(key.split(':')[1]));   // E2: the browse/buy window (no-op outside shops)
        return true;
      }
      if (key.startsWith('person:')) {
        activateStaticNpc(interiorCtx.people[Number(key.split(':')[1])]);   // U23
        return true;
      }
      if (key.startsWith('questflat:')) {
        clickQuestFlat(questFlats[Number(key.split(':')[1])], interiorBuilding?.buildingKey ?? 0);
        return true;
      }
      if (key.startsWith('droppedLoot:')) {
        // ID1: the pile the player dropped in this room. Activating a
        // container opens the inventory WITH it as the remote target
        // (PlayerActivate's default loot handling), which is the same
        // OnPush law the dungeon and both exterior hosts ride.
        const pile = interiorDropped.pileFor(key);
        if (pile?.items.length) mountInterior(interiorInventory({ loot: { items: () => pile.items } }));
        return true;
      }
      if (key.startsWith('container:')) {
        // S2b/F209 -> HC1: the WHOLE HouseContainers arm of
        // PlayerActivate (:902-925). An owned interior - the house,
        // or a SHIP with OwnsShip (:905-906, "not distinguishing
        // between ships") - is YOUR storage: never stocked (DFU marks
        // `stockedDate = 1` and breaks) and the inventory opens with
        // the container as the remote loot target, two-way. Anyone
        // else's stocks ON FIRST ACCESS through StockHouseContainer
        // (the `??=` is the same null-latch the shop shelves ride),
        // an EMPTY result does nothing (:917-918), and a full one
        // asks the TEXT.RSC 37 private-property question - Yes opens
        // the same loot-target inventory, No claims nothing
        // (PrivateProperty_OnButtonClick :1085-1096). PT1 took the
        // theft basket behind `loot.houseOwned` (:919), which is why
        // Yes opens the window in PRIVATE-PROPERTY mode below.
        const c = interiorCtx.containers[Number(key.split(':')[1])];
        if (c) {
          const b = interiorBuilding;
          // PT1: `loot.houseOwned` (:919) is set in the STRANGER arm
          // alone, so `isPrivateProperty` (:611) - and the theft roll
          // with it - is exactly the case where the player is rifling
          // someone else's furniture. An owned house or ship reaches
          // openLoot() through the arm above with `privateProperty`
          // false, and is never a theft.
          const openLoot = (privateProperty = false) => {
            const before = privateProperty ? [...(c.items ?? [])] : null;
            const win = interiorInventory({
              loot: { items: () => c.items },
              onClose: () => {
                if (!privateProperty) return;
                const out = privatePropertyTheft({
                  basket: theftBasket(before, c.items ?? []),
                  pickpocketSkill: skillValue(playerEntity, SKILLS.Pickpocket),
                  shopQuality: b?.quality ?? 0,
                });
                if (!out) return;
                // The member's own order: the tally is first and is not
                // conditional on the roll.
                tallyCrimeGuildRequirements(playerEntity, true, 1);
                if (out.detected) {
                  setCrimeCommitted(playerEntity, CRIMES.Theft);
                  host.spawnCityGuards?.(true);
                } else {
                  tallySkill(playerEntity, SKILLS.Pickpocket, 1);
                }
              },
            });
            if (win) interiorOverlay = win;
          };
          const owned = (b?.buildingType === BUILDING_TYPES.Ship && ownsShip(playerEntity))
            || isHouseOwned(playerEntity.houses ?? [], b?.regionIndex ?? 0, b?.buildingKey);
          if (owned) {
            // ":907 - loot.stockedDate = 1; // Ensure it gets
            // serialized". A literal 1 is below any real
            // CreateStockedDate and above the 0 that means "never
            // stocked", so an owned container is saved AND never
            // restocked out from under the player's own storage.
            c.stockedDate = 1;
            c.items ??= [];
            openLoot();
          } else {
            // A2 (:910-915): the same day comparison the shelves take.
            // StockHouseContainer clears and re-mints (:293-294), so a
            // stranger's cupboard refills overnight; the `??=` that
            // stood here stocked it once per interior build.
            const today = stockedToday();
            if (needsRestock(c, today)) {
              c.stockedDate = today;
              c.items = stockHouseContainer({ buildingType: b?.buildingType, record: c.record }, playerEntity);
            }
            if (c.items.length === 0) return true;   // "If no contents, do nothing"
            interiorOverlay = new ChoiceWindow({
              lines: _rowsText(townTalk?.lines?.(PRIVATE_PROPERTY_TEXT_ID) ?? [], 'This looks like private property. Do you still want to look through it?'),
              options: [
                { code: 'KeyY', label: 'Y - yes', action: () => openLoot(true) },
                { code: 'KeyN', label: 'N - no', action: () => {} },
              ],
            });
          }
        }
        return true;
      }
      interiorCtx.actions.activate(key, { steal: getInteractionMode() === 'steal', doorSpell: doorSpellFor(playerEntity) });   // X1
      return true;
    }
    // Verbatim BuildingTransitionExteriorLogic: the closest exterior
    // door to the PLAYER (frames unified at P8), landing at
    // normal * radius*3. DFU compares transform.position - the
    // CONTROLLER standing at floor + height * 0.65 (the same
    // FixStanding constant P6 dug out for ClimbLadder), not the feet.
    const landing = exteriorLanding(
      [player.pos[0], player.pos[1] + 1.8 * 0.65, player.pos[2]],
      exitReturn.siblings.map((e) => e.door));
    if (!landing) { console.error('exit: no exterior landing (empty sibling doors)'); return false; }   // tryEnter guards its landing; this path was unguarded - a null here killed the frame loop
    // P1: CacheScene (:860) - BEFORE the teardown, while the shelves
    // and the action objects are still alive to be read.
    cacheInteriorScene();
    teardownQuestFlats();   // Q4-v: OnDestroy for the quest stands, before the batch teardown
    interiorCtx.destroy();
    interiorFoes?.destroy?.();   // IF: OnTransitionExterior tears the interior's enemies down with it
    interiorFoes = null;
    interiorGuards?.clearLive?.();   // ROAD-B: the watch are enemies too - same transition, same teardown
    interiorGuards = null;
    interiorDropped.restorePiles(null);   // ID1: the piles are cached above; free their batches with the scene
    interiorHitEffects.clear();   // HE1: a splash mid-animation must not follow the player into the next building
    interiorCtx = null;
    interiorBuilding = null;   // E2: the identity + overlay leave with the interior
    exteriorDoor = null;       // IS1: ...and the way back in with them
// ROAD-B B1: the whole stack leaves with the interior, not just its
    // top - a rest suspended under a message box is a real occupant.
    interiorWindows.reconcile(interiorOverlay);
    interiorWindows.clear((w) => w.dispose?.());
    _insideTavern = false;     // ROAD-B B4: PlayerEnterExit.cs:874 - the tavern latch alone (the residence latch is NOT cleared there; see its declaration)
    interiorOverlay = null;
    player.collider = baseCollider();
    // RepositionPlayer(Offset): the door centre is where DFU puts the
    // controller's CENTRE; the feet go a body-half lower, never below
    // the terrain's floor (enterExit.repositionFeetY).
    player.spawn(landing[0], repositionFeetY(player.collider.heightAt(landing[0], landing[2]), landing[1]), landing[2]);
    mode = 'exterior';
    questBridge?.onExteriorTransition();   // Q4-v: CreateFoe's pending-wave invalidation
    npcSession?.onWorldChanged();          // TK-v: OnTransitionToExterior (:3599-3603)
    console.log('exterior: returned at door');
    return true;
  }

  /** DE1: `preferEnterMarker` names WHICH DFU member the caller is.
   *  Default FALSE, because the overwhelmingly common way into a
   *  dungeon is walking through its door - PlayerActivate.cs:645 ->
   *  TransitionDungeonInterior - and that member takes the START
   *  marker. startInDungeon passes true for StartDungeonInterior. */
  async function tryEnterDungeon(hit, entries, { preferEnterMarker = false } = {}) {
    // AUDIT 28 W4: SMALLER DUNGEONS - the location that gets BUILT is
    // sized by MapsFile's law (setting, main-story gate, and a live
    // quest's frozen state through its SiteLink), on a clone; the
    // cached location the exterior shares is never touched.
    const dfLocation = dungeonLocationFor(hit.dfLocation, { questMachine: questBridge?.machine });
    if (!dfLocation || !dfLocation.hasDungeon) return false;
    dismountPlayer('ToDungeonInterior');   // TR5: the other half of :196-202
    transitioning = true;
    try {
      const ctx = await buildDungeonContext(
        { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette },
        dfLocation, blocks, dfLocation.climate.climateType, { activateHeld: () => held(keys, 'ActivateCenterObject'), useMagicItem: (item) => host.useMagicItem?.(item),
          // A10: the Recall prompt (Teleport.cs:81-98). The outer host
          // owns it - the plan's arms are its pixel teleport, its mode
          // teardown and its dungeon mount - so a cast underground in
          // the STREAMING host raises the same 4000 box as one cast in
          // the street. The standalone ?dungeon probe passes none and
          // the context keeps its own refusal.
          onTeleport: host.onTeleport ? () => host.onTeleport() : null,
          foes: host.foes, playerClass: host.playerClass,
          playerSpell: host.playerSpell, playerWeapon: host.playerWeapon,
          // AUDIT 24 (the seven-slice sweep): THE OUTER HOST OWNS
          // CHARGEN. world.js mounts the wizard itself when
          // !chargenDone, and the classic start then enters the dungeon
          // - which mounted a SECOND, independently-rolled wizard into
          // its own overlay. Both were drawn (the dungeon's, then
          // townTalk's on top) and both were driven: the two hosts
          // register separate keydown listeners on the same target and
          // neither stops propagation, so every arrow and Enter
          // advanced both. Whichever finished LAST wrote the character.
          // The classic-start probe never caught it because it boots
          // with &class, which takes the headless branch in both.
          chargen: false,
          // wave 22: PopupText.AddText files into the notebook ring
          hudMessageSink: (t) => questBridge?.notebook?.addMessage(t),
          // B4: the dungeon quicksave rides the ONE composer - DFU
          // saves quest + conversation wherever the player stands
          // (SaveLoadManager.cs:1113-1121), and until this the F9
          // pressed in here wrote a snapshot with neither.
          // B2: a restored quest machine re-runs the scene mount (DFU's
          // load path re-adds site resources) - including the
          // restored-Symbol duplicate quirk sceneMount records.
          questBridge, talkSave,
          onQuestRestored: () => { onQuestRestored?.(); mountQuestResources(); },
          // AUDIT 39 (#41): PlayerDeath.cs reads the camera's LIVE local
          // y and the controller's LIVE height at the moment of death,
          // so a crouched death sinks from the crouched eye. dungeon.js
          // has always passed this; without it the world-hosted dungeon
          // death fell to the standing defaults.
          motorState: () => ({ eyeLevel: player.eye[1] - player.pos[1], capsule: player.height }),
          // AUDIT 26 F222/F223/F101: the host's half of the pose -
          // this mode machine owns the modal player and camera; the
          // context owns the weapon and folds weaponDrawn in itself.
          pose: {
            read: () => ({ yaw: cam.yaw, pitch: cam.pitch, crouching: !!player.crouching }),
            apply: (p) => {
              cam.yaw = p.yaw ?? cam.yaw;
              cam.pitch = p.pitch ?? cam.pitch;
              if (p.crouching != null) player.crouching = !!p.crouching;
            },
          },
        });
      dungeonCtx = ctx;
      // P10 host parity (2026-08-16 audit: only the standalone scene
      // installed the warp - a world-mode teleporter logged and
      // no-opped): Teleport actions move the modal player.
      // A6: the FreezeMotor 0.5 s settle (DaggerfallAction.Teleport
      // :594 + PlayerMotor.FixedUpdate :296-307), and NOT the marker's
      // yaw - DFU's rotation copy is overwritten by PlayerMouseLook on
      // the next frame (:256-259), so the heading survives a teleport.
      // Same law as the standalone host's handler; the comment block
      // there carries the full reading.
      ctx.actions.onTeleport = ({ pos }) => {
        player.freezeMotor = TELEPORT_FREEZE_S;
        player.spawn(pos[0], pos[1], pos[2]);
        cam.pos = [...player.eye];
      };
      // Classic water tile: the location climate's ground archive,
      // record 0 (R11) - uploaded here since the exterior ground path
      // never routes single records through uploadRecord.
      const waterArchive = getGroundArchive(hit.climateBase, hit.season);
      await getTexture(waterArchive);
      uploadRecord(waterArchive, 0);
      dungeonReturn = {
        waterArchive,
        candidates: entries.filter((e) =>
          e.group === hit.group && e.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE),
      };
      // DE1: WHICH DFU MEMBER THIS IS. Walking in through the door is
      // TransitionDungeonInterior, which uses the START marker and
      // aborts where there is none; startInDungeon (a new game) is
      // StartDungeonInterior, which prefers the ENTER marker. This
      // function serves both, so the caller says which.
      const spawn = ctx.startSpawn({ preferEnterMarker });
      // TransitionDungeonInterior destroys the dungeon and raises
      // OnFailedTransition when the marker it needs is absent
      // (:923-929) rather than dropping the player at an invented
      // point. The port answers false, which is this door's "nothing
      // happened" - the player stays outside, standing at the door.
      //
      // AUDIT 39 (#29): and that sentence did not describe the code
      // under it. The marker test used to run AFTER mode, dungeonLoc
      // and the player's collider had been switched, so the "abort"
      // left the host in dungeon mode with the player at their
      // EXTERIOR position on the dungeon's collider and a built
      // context nobody destroyed. DFU tests the marker BEFORE
      // EnableDungeonParent/MovePlayerToMarker and Destroys the layout
      // on the way out; the three commits move below the test, and the
      // refusal unwinds the context it just built.
      if (!spawn) {
        console.error('[dungeon] no start marker; transition aborted');
        ctx.destroy();
        dungeonCtx = null;
        return false;
      }
      mode = 'dungeon';
      _insideTavern = false;   // ROAD-B B4: PlayerEnterExit.cs:1112 - the dungeon transition clears the tavern latch too (and, verbatim, not the residence one)
      dungeonLoc = dfLocation;
      player.collider = ctx.collider;
      player.spawn(spawn[0], spawn[1], spawn[2]);
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
      // ...and the orientation half of the same two members: away from
      // the door you came through, or north for a start with no door.
      const _yaw = ctx.entryFacingYaw(spawn, { preferEnterMarker });
      if (_yaw !== null) {
        cam.yaw = _yaw;
        // DE2: BOTH members LEVEL THE PITCH, and DE1 shipped only the
        // yaw half. StartDungeonInterior calls SetFacing(Vector3.forward)
        // and TransitionDungeonInterior calls SetFacing(doorNormal);
        // SetFacing(Vector3) is `LookRotation(forward).eulerAngles` fed
        // to SetFacing(yaw, pitch) (PlayerMouseLook.cs:286-291), and
        // every vector either member passes is HORIZONTAL - so the
        // pitch it computes is 0. Walk into a dungeon looking up at the
        // sky and DFU levels you; the port left you craning at the
        // ceiling. The guard is DFU's own: TransitionDungeonInterior
        // only faces when it found a door to face away from.
        cam.pitch = 0;
      }
      mountQuestResources();   // B2: AddQuestResourceObjects(SiteTypes.Dungeon) on the transition, as PlayerEnterExit raises it
      // AUDIT 39 (#31): the sixth of TalkManager's six subscriptions.
      // PlayerEnterExit raises OnTransitionDungeonInterior from BOTH
      // members this function serves (:958 and :1016), and the handler
      // is castleNPCsSpokenTo.Clear() - so a castle NPC gets a fresh
      // work roll on each visit. The two exterior transitions here
      // already notify the session; the entry notified nothing.
      npcSession?.onEnterDungeonInterior();   // TK-v: OnTransitionToDungeonInterior (:3611-3614)
      console.log(`dungeon: ${ctx.drawList.length} draws, ${ctx.exitDoors.length} exit doors, ` +
        `${ctx.lights.length} lights, ${ctx.waterQuads.length} water, ${ctx.colliderTris} tris, ${ctx.enemies.length} enemies`);
    } finally {
      transitioning = false;
    }
    return true;
  }

  /** StartGameBehaviour's StartDungeonInterior (:392-401), which is
   *  how a NEW GAME begins: the streamer is already teleported to the
   *  start map pixel, and the player is put inside that location's
   *  dungeon without ever walking through the door.
   *
   *  It routes through tryEnterDungeon rather than repeating its body,
   *  because the thing that makes the dungeon EXITABLE is the
   *  dungeonReturn record built in there - the entrance-door
   *  candidates the exit landing is computed from. The classic start
   *  used to boot scenes/dungeon.js, which has no exit path at all, so
   *  Privateer's Hold was a sealed box: the whole reason this exists. */
  async function startInDungeon() {
    const entries = doorTargets();
    const hit = entries.find((e) => e.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE);
    if (!hit) return false;
    // DE1: this is StartDungeonInterior, not the door transition - the
    // player is placed inside without ever walking through, so the
    // ENTER marker wins and the facing is plain north.
    return tryEnterDungeon(hit, entries, { preferEnterMarker: true });
  }

  function tryExitDungeon() {
    const eye = player.eye;
    const dir = eyeDir();
    // QG1: the quest-resource click arm runs FIRST and does not
    // consume the activation (PlayerActivate.cs:325-339 - no return,
    // skipped in Info mode): a live quest foe under the ray takes the
    // click through its own DoClick, and the ladder below still runs.
    if (getInteractionMode() !== 'info' && dungeonCtx) {
      const qf = pickQuestFoe(eye, dir, dungeonCtx.foes, dungeonCtx.collider);
      if (qf) qf.questBehaviour.doClick();
    }
    const targets = dungeonCtx.exitDoors.map((d, i) => ({ key: `exit:${i}`, aabb: doorWorldAabb(d) }));
    targets.push(...activationTargets(dungeonCtx.actions.objects));   // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
    targets.push(...dungeonCtx.lootTargets());   // S2: piles + lootable corpses
    // DQ1: the quest stands. B2 mounted them underground and the ray
    // never learned them, so `clicked npc` and `clicked item` at a
    // DUNGEON site could not fire - only kills could. Everything the
    // interior arm needs was already here: the stand records are the
    // same shape (one factory builds both lists), and PlayerActivate
    // has no scene gate on the quest-resource arm at all (:326-339).
    targets.push(...questFlatTargets(dungeonQuestFlats));
    const key = pickActivatable(eye, dir, targets, dungeonCtx.collider);
    if (key === null) return false;
    // U26: droppedLoot: is the player's own pile - the same three-way
    // arm the standalone dungeon scene carries, kept in step here.
    if (key.startsWith('loot:') || key.startsWith('corpse:') || key.startsWith('droppedLoot:')) {
      dungeonCtx.takeLoot(key);   // opens the inventory with the pile as the remote target
      return true;
    }
    if (key.startsWith('questflat:')) {
      // DQ1: buildingKey is 0 down here - StaticNPC reads it from the
      // runtime data and a dungeon has no building, the same reason
      // mapID is 0 in both hosts.
      clickQuestFlat(dungeonQuestFlats[Number(key.split(':')[1])], 0);
      return true;
    }
    if (!key.startsWith('exit:')) {
      dungeonCtx.actions.activate(key, { steal: getInteractionMode() === 'steal', doorSpell: doorSpellFor(playerEntity) });   // X1
      return true;
    }
    // AUDIT 28 W2c: THE EXIT-DOOR WAGON PROMPT (PlayerActivate.cs
    // :649-664). A dungeon exit with a Small_cart in the pack and
    // Settings.DungeonExitWagonPrompt raises TEXT.RSC 38 as a YesNo
    // box and RETURNS: No leaves the dungeon (:1137), Yes calls
    // AllowDungeonWagonAccess() and opens the inventory (:1141-1142),
    // Escape closes the box and nothing happens (allowCancel). Without
    // the cart, or with the setting off, the exit is immediate as
    // before. The bash gate (:651) has no port counterpart here - the
    // exit door is not a bash target in this host.
    if (hasCart(playerEntity.items ?? []) && getBool('GUI', 'DungeonExitWagonPrompt')) {
      const rows = (dungeonCtx.rscLines?.(38) ?? ['Do you wish to access your wagon?']).map((text) => ({ text, center: true }));
      const prompt = new ServiceFlowWindow([{
        rows, buttons: 'YesNo',
        // AUDIT 28 SELF-AUDIT (F-A5): No must NOT tear the dungeon down
        // from INSIDE the ctx's own overlayInput dispatch - after the
        // handler returns, that dispatch still runs surfacePlayer() on
        // the ctx, which exitDungeonNow has just destroyed. That is the
        // 2026-08-29 crash's shape wearing a new coat. The flag defers
        // the exit to the top of the next dungeon frame, outside any
        // dispatch, which is also what the comment on exitDungeonNow
        // promised.
        onYes: () => { dungeonCtx.openInventoryWithWagon(); return null; },
        onNo: () => { pendingDungeonExit = true; return null; },
        onEscape: () => null,
      }]);
      return mountSpellWindow(prompt);
    }
    return exitDungeonNow();
  }
  let pendingDungeonExit = false;   // F-A5: the wagon prompt's No, taken a frame later
  /** TransitionDungeonExterior(true): the exit itself, split from the
   *  activation so the wagon prompt's No can take it a frame later. */
  function exitDungeonNow() {
    // Verbatim PositionPlayerToDungeonExit; the camera faces the normal.
    const landing = dungeonEntranceLanding(dungeonReturn.candidates.map((e) => e.door));
    teardownDungeonQuestFlats();   // B2: OnDestroy for the quest stands, before the batch teardown
    dungeonCtx.destroy();
    dungeonCtx = null;
    dungeonLoc = null;
    mode = 'exterior';
    questBridge?.onExteriorTransition();   // Q4-v: the same invalidation on the dungeon door
    npcSession?.onWorldChanged();          // TK-v: OnTransitionToDungeonExterior (:3605-3609)
    player.collider = baseCollider();
    if (landing) {
      // RepositionPlayer(DungeonEntrance): same law as the building
      // door - the door centre is the controller's centre, not the feet.
      player.spawn(landing.pos[0], repositionFeetY(player.collider.heightAt(landing.pos[0], landing.pos[2]), landing.pos[1]), landing.pos[2]);
      cam.yaw = Math.atan2(landing.normal[0], landing.normal[2]);
      // DE2: PositionPlayerToDungeonExit ends on
      // SetHorizontalFacing(foundDoorNormal) (StreamingWorld.cs
      // :1428-1433), which is SetFacing(yaw, 0f) - the pitch is forced
      // level EXPLICITLY here rather than falling out of a horizontal
      // vector, and it is the one call site in the trio that says so in
      // its own name. Coming up out of a dungeon looking at your feet
      // put you outside still looking at them.
      cam.pitch = 0;
    }
    cam.pos = player.eyeAt();   // EV1: the interpolated render eye
    console.log('exterior: returned at dungeon entrance');
    return true;
  }

  // The modal frame: player update + E + the whole render pipeline for
  // the active context. Returns true when a mode consumed the frame -
  // the host's exterior path (streaming, sky, weather) must not run.
  function frame(dt, now) {
    if (mode === 'exterior') return false;
    // E2: modal frames advance the shot-mode frame counter too - the
    // hosts' early return froze __frame inside interiors/dungeons and
    // every probe frame-sync starved (the process doctrine).
    if (window.__frame !== undefined) window.__frame++;
    const fwd = eyeDir();
    // AUDIT 21 (hosts lane, F4): THE EARS MOVE IN HERE TOO.
    //
    // The 3D listener was set by world.js, exterior.js and dungeonContext.js
    // and by nothing in this host, so in INTERIOR mode it stayed frozen
    // wherever the last exterior frame parked it - at the town's world
    // position. interiorContext plays door open/close and door-bash through
    // sfx.play3d at INTERIOR-LOCAL coordinates against a linear model with a
    // finite maxDistance, so those sounds were out of range: inaudible, or
    // panned from nowhere.
    //
    // Covers both modes. The dungeon arm sets it again later from its own
    // view matrix, which is a pure write and harmless.
    audio.setListener(cam.pos, fwd);
    const jumpHeld = held(keys, 'Jump');
    if (mode === 'dungeon' && dungeonCtx) {
      player.slowFalling = dungeonCtx.playerSlowFalling;   // S8 slowfall (P14: the verbatim constant-speed law lives in the motor)
      // P11 host parity (2026-08-16 audit: the standalone ?dungeon
      // scene wired swim/levitate but THIS host never did - a
      // world-mode dungeon sank the player under water at walk
      // speed): the swim toggle (the LIVE capsule centre + 50*GS -
      // 0.95 below the block water surface - AUDIT 24 player), the
      // Levitate/waterWalking consumers.
      const surf = dungeonCtx.waterSurfaceYAt(player.pos[0], player.pos[2]);
      player.waterSurfaceY = surf;
      player.swimming = surf != null && player.pos[1] + player.height / 2 + 50 * 0.025 - 0.95 < surf;
      player.levitating = dungeonCtx.playerLevitating();
      player.waterWalking = dungeonCtx.playerWaterWalking();
    } else {
      // AUDIT 18 HOST GAP: these four flags were written ONLY in the
      // branch above and never cleared, so a player who left a dungeon
      // levitating stayed in the motor's no-gravity branch forever -
      // and an interior kept whatever the last dungeon frame left.
      // The EFFECT owns levitate/waterWalking/slowFall (Levitate.cs
      // :131/:136 sets IsLevitating on Start AND End), so they are
      // recomputed; swimming is false with no blockWaterLevel.
      applyMotorEffectFlags(player, playerEntity);
    }
    // S19 paralysis host parity (the standing host rule): movement
    // input zeroed, jump cancelled - the player still falls; look
    // stays live (FrictionMotor/AcrobatMotor verbatim gates).
    // P12 crouch: KeyX edge toggle (host parity with ?dungeon).
    // AUDIT 39r: the INTERIOR arm hardcoded false, so a building was the
    // one place in the game paralysis did nothing - in the same file
    // that mounts spellsByIndex/magicHooks on the interior foe pool so
    // the S19 monster rider has Spider Touch indoors. Every DFU gate
    // reads PlayerEntity.IsParalyzed with no interior/exterior test
    // (FrictionMotor :75-81, AcrobatMotor :135-141, WeaponManager
    // :235-239), which is the fold world.js and exterior.js took; the
    // dungeon arm keeps its context read, the same answer one seam over.
    const paralyzed = (mode === 'dungeon' && dungeonCtx) ? (dungeonCtx.playerParalyzed?.() ?? false) : entityIsParalyzed(playerEntity);
    // A6: FrictionMotor.GroundedMovement's head-dip guard reads
    // IsParalyzed itself (:90-93) - the zeroed input bag below is
    // the movement half of the same law, not this one.
    player.paralyzed = paralyzed;
    // E2: the shop overlay holds the motor like every other window
    // (typing digits must not walk the player).
    // AUDIT 18 HOST GAP: the dungeon overlay was absent from this
    // expression, so with F6/the rest window open in a world-hosted
    // dungeon the motor kept walking, E still exited the dungeon and
    // the movers kept travelling - all of it under the open menu.
    // DFU UserInterfaceManager.AddWindow (:179-184) calls
    // PauseGame(true) for any PauseWhileOpen window (the default),
    // which is what dungeon.js:218's `held` already implements.
    // AUDIT 39 (#28): and the OUTER host's slot with them. AddWindow
    // pauses for the window, not for the slot it was pushed into -
    // and townTalk's slot really does hold one in these modes: this
    // file's own openStaticNpc tail opens a talk window while the
    // player stands in a shop, and world.js runs the classic-start
    // chargen wizard there with the player already inside Privateer's
    // Hold. The keydown chain already conceded the point below.
    // ROAD-B B1: the stack catches up with the slot BEFORE anything
    // reads it, so a window that closed between frames uncovers the one
    // beneath it in the same frame it closed - the motor never sees the
    // gap, and the restored window is what this frame ticks and draws.
    if (mode === 'interior') interiorWindows.reconcile(interiorOverlay);
    const overlayHeld = !!townTalk?.overlayActive ||
      (mode === 'interior' && !!interiorOverlay) ||
      (mode === 'dungeon' && !!dungeonCtx?.uiOverlayActive);
    // Q4-v: the quest layer's modal frame. Behaviours update every
    // frame (Unity Update runs whatever Time.timeScale is); the
    // machine's OWN tick freezes under a paused window - PauseGame
    // sets timeScale 0 and QuestMachine.Update accumulates
    // Time.deltaTime, which is 0 there - so the overlay gates it.
    if (mode === 'interior') for (const s of [...questFlats]) s.behaviour?.update();
    if (mode === 'dungeon') for (const s of [...dungeonQuestFlats]) s.behaviour?.update();   // B2: foe behaviours drive inside drawFoes
    if (!overlayHeld) questBridge?.tick(dt);
    const crouchHeld = held(keys, 'Crouch');   // I2: DFU's default C (was the port's X)
    const mv = moveHeld(keys);
    // AUDIT 28 W8: the axes advance only on frames the motor runs (a
    // held overlay is DFU's timeScale 0 - no climb, no friction).
    const axes = overlayHeld ? { forward: moveAxes.vertical, strafe: moveAxes.horizontal } : moveAxes.update(dt, mv);
    const moving = !paralyzed && anyMove(mv);
    // Platform riding (the DFU MoveWithMovingPlatform shape) was wired
    // ONLY into the standalone ?dungeon scene, so a world/exterior
    // hosted dungeon dropped the mover delta and the lift penetrated
    // the capsule. The delta applies BEFORE the player's own move.
    if (!overlayHeld) ridePlatform(player, mode === 'dungeon' ? dungeonCtx?.actions : interiorCtx?.actions);
    // AUDIT 26 (hosts-modal): THE MOTOR ITSELF STOPS under a window.
    // PauseGame(true) sets Time.timeScale = 0 (GameManager.cs:600-609),
    // which is not "no input" but no Update and no FixedUpdate at all -
    // PlayerMotor stops integrating. Zeroing the input bag is the
    // PARALYSIS law (FrictionMotor/AcrobatMotor cancel movement and the
    // jump while the player still falls), and it was standing in for
    // both: a fall opened under a menu completed under it and
    // applyFallLanding charged the damage, a swimmer kept sinking, and
    // the crouch edge still toggled. dungeon.js:353 is this same gate
    // ("no movers, no motor").
    if (!overlayHeld) {
      // Audit F3: crouch stays live while paralyzed (DFU gates movement/jump only)
      // AUDIT 39r: and so does the SPEED-ADJUSTMENT capture. DFU zeroes the
      // movement VECTOR (FrictionMotor :75-81, AcrobatMotor :135-141);
      // CaptureInputSpeedAdjustment runs in Update behind a levitate gate
      // and nothing else. Dropping run/sneak/autoRun/back from this bag read
      // as a RELEASE to the motor's press-edge latches, so a key held
      // through the paralysis fired a synthetic press on the frame it lifted.
      player.update(dt, paralyzed ? { forward: 0, strafe: 0, run: held(keys, 'Run'), autoRun: held(keys, 'AutoRun'), back: mv.backwards, sneak: held(keys, 'Sneak'), jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
        forward: axes.forward,   // AUDIT 28 W8: InputManager's axes - accelerated under MovementAcceleration, the held difference without
        strafe: axes.strafe,
        run: held(keys, 'Run'),
        // AUDIT 39: PlayerSpeedChanger's AutoRun latch (:82-99) - the
        // press flips ToggleRun; MoveBackwards is its cancel key.
        autoRun: held(keys, 'AutoRun'),
        back: mv.backwards,
        sneak: held(keys, 'Sneak'),   // P15: DFU's default Sneak binding (LeftAlt), held
        jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
        up: jumpHeld || held(keys, 'FloatUp'),
        // AUDIT 26 F031: LevitateMotor's descent arm is Crouch OR
        // FloatDown (:88-89), the mirror of the rise arm above; the
        // port's own motor contract said so and every host passed
        // FloatDown alone, so C did nothing but toggle the stance.
        down: crouchHeld || held(keys, 'FloatDown'),
        crouch: crouchHeld && !latch.crouch,
      }, cam.yaw, cam.pitch);
      latch.crouch = crouchHeld;
      // FS-slice: PlayerFootsteps - buildings walk on wood, dungeons on
      // stone with the water arms (shallow = the capsule center 0.57
      // under the block water line, DFU's own expression at the port's
      // feet-origin convention).
      {
        const _surf = player.waterSurfaceY;
        const _step = _footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          standingStill: !moving,   // AUDIT 39r: `moving` is the paralysis-folded read - a frozen player takes no stride (world.js/exterior.js's own line)
          halfSpeed: player.movingLessThanHalfSpeed,
        }, pickFootstepSet(mode === 'interior'
          ? { inside: true, inBuilding: true }
          : { inside: true, inBuilding: false,
              dungeonSwimming: player.swimming,
              // F090: the LATCHED flag - shallow is entered at 0.57 and
              // only left at 0.95 (PlayerFootsteps :189, :199-208).
              dungeonShallow: _footsteps.waterStep(player.pos[1] + 0.9, _surf, player.swimming) }));
        if (_step) audio.playOneShot(_step.clip, _step.volume);
      }
    }
    if (mode === 'dungeon' && dungeonCtx) {
      // P11: the splash/jump/swim-minute fatigue feed (same seam as
      // the standalone scene); P14's fall landing rides the same call.
      // The motor's frame flags (jumped, landedFallDistance) are RESET
      // by the update that sets them, so their readers ride the motor's
      // own gate: a jump taken the instant before a window opened would
      // otherwise be re-reported on every paused frame.
      if (!overlayHeld) dungeonCtx.reportActivity?.({ running: held(keys, 'Run') && moving && !player.riding, swimming: player.swimming, climbing: !!player.climb?.isClimbing, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed, fell: player.landedFallDistance });   // P13 sneak state + P14 fall landing (AUDIT 26 F083: + the climbing arm)
      // PlayerMotor.StartRestGroundedCheck (:184-194) reads the LIVE
      // grounded state; dungeonContext's `_grounded` is host-fed and
      // only dungeon.js:270 fed it, so in a world-hosted dungeon the
      // rest gate read the initialiser `true` for the whole session
      // and R mid-fall opened the window DFU refuses (TEXT.RSC 355).
      if (!overlayHeld) dungeonCtx.reportMotor?.(player.grounded, player.velY, cam.yaw);
    } else if (mode === 'interior') {
      // AUDIT 21 hosts F6 / AUDIT 23 (hosts-1): take the presenter back
      // from a dungeon we just left - re-register the mode ROUTER, not
      // the raw interior presenter, so a later walk-mode death still
      // reaches the exterior screen.
      setDeathPresenter(() => {
        if (mode === 'exterior' && prevDeathPresenter) return prevDeathPresenter();
        presentInteriorDeath();
      });
      // F117: take the avoid-death consult back from the dungeon too -
      // its hook closed over the dungeon's submersion marker. Above
      // ground there is no submersion model, so this is the plain
      // Stendarr consult, same as the boot host's.
      setAvoidDeathHook(() => {
        if (!avoidDeath(activeMemberships(playerEntity))) return false;
        say(AVOID_DEATH_TEXT);
        return true;
      });
      // AUDIT 18: interior mode had NO fall-damage seam at all, behind
      // a flag that claimed single-storey shells could never fall far
      // enough to matter. That was false - interiors carry ladder
      // markers well past the BadFallDetected alert, and
      // IsBadInteriorModel's own comment is about "trapping player
      // upstairs". AcrobatMotor.CheckFallingDamage has exactly one
      // exemption and it is the outdoor water tile, never an interior.
      if (!overlayHeld) applyFallLanding(playerEntity, player.landedFallDistance, { sound: (id) => audio.playOneShot(id) });
      // AUDIT 18: and the interior owed the same world clock the exterior
      // and dungeon hosts run - inside a building, effects, diseases,
      // poisons, fatigue and skill advancement had all stopped.
      if (!overlayHeld) interiorTicker.tick(dt, {
        running: player.isRunning && !player.standing,   // AUDIT 23 (entity-2)
        swimming: false,
        jumped: player.jumped,   // C6
      });
      // IF: the pool's frame. Armed for MobileTeams targeting like
      // every other pool (MT) - the candidate list is this host's
      // whole active-enemy database, which is the pool itself.
      if (interiorFoes && interiorCtx) {
        interiorFoes.update(overlayHeld ? 0 : dt, player.pos, cam.pos, _interiorSenses());
      }
    }
    cam.pos = player.eyeAt();   // EV1: the interpolated render eye
    // DC1: PlayerDeath.Update's camera sink; the fresh eye array keeps
    // it per-frame, never cumulative. AUDIT 39 (#36) added the dungeon
    // arm - the context registers its OWN death presenter for the whole
    // visit, so a dungeon death mounts its DeathScreen in the CONTEXT's
    // slot and the one write below never saw it.
    if (interiorOverlay instanceof DeathScreen) cam.pos[1] -= interiorOverlay.drop;
    if (mode === 'dungeon') cam.pos[1] -= dungeonCtx?.deathDrop ?? 0;
    // A8 - POINTER PARITY, THE FLAG AT THIS LINE RETIRED. Mouse0 is
    // DFU's ActivateCenterObject: the readied spell fires on its
    // PRESS (EntityEffectManager.cs:250) and the world activation
    // runs on its RELEASE (PlayerActivate.cs:279), with a readied
    // non-touch spell blocking the activation outright. The whole
    // of that law - castPending included - is in
    // systems/activateGate.js so all four hosts read one copy.
    // The port's E stays live BESIDE it (DFU binds E to AbortSpell; a
    // recorded departure). ROAD-Ar R10: the swing below is the raw
    // right button - DFU's own 'Mouse1' (InputManager.cs:1010) - but
    // never read through held(), so a SwingWeapon rebind is inert.
    // ...and the engine is the MODE's, exactly as the attack routing
    // below it is (:4812): a dungeon visit mints its own cast engine on
    // the context, so reading the exterior host's HasReadySpell here
    // would arm the gate off the wrong spell.
    // ROAD-Ar: the gate's last three inputs, which A8 declared and no
    // host passed. `paused` is InputManager's own return under an open
    // window (:486-503) and carries RemoveWindow's 0.3 s click delay
    // with it - the CAST half of this block was never overlay-gated,
    // so a left-click on an open window fired a readied spell into the
    // room behind it; `hudBlocked` is PlayerActivate.cs:230-236;
    // `touchSpell` is its stated exception at :250-258. The readied
    // spell comes off the same per-mode engine HasReadySpell does.
    const _act = activateFrame((latch.activate ??= createActivateGate()), {
      down: held(keys, 'ActivateCenterObject'),
      hasReadySpell: (mode === 'dungeon' ? dungeonCtx?.spellArmed?.() : magic?.spellArmed()) ?? false,
      touchSpell: ((mode === 'dungeon' ? dungeonCtx?.readiedSpell?.() : magic?.readied()) ?? null)?.rangeType === 1,   // rangeType 1 is ByTouch (spellcast.js:197)
      hudBlocked: activeMouseOverLargeHUD(),
      paused: overlayHeld,
    });
    if (_act.cast) {   // the frame's firePending sends it down the live look
      if (mode === 'dungeon') dungeonCtx?.playerAttackInput?.(0, 0, true);
      else magic?.interceptAttack(true);
    }
    const useHeld = keys.has('KeyE');   // I2 departure, kept beside A8's Mouse0: DFU binds E to AbortSpell
    const zNow = held(keys, 'ReadyWeapon');   // sheathe toggle (audit 2026-08-17)
    // C9: per-mode routing (the old unconditional dungeonCtx read
    // CRASHED on Z inside a building - dungeonCtx is null there).
    if (zNow && !zPrev) {
      if (mode === 'dungeon') dungeonCtx?.toggleSheath?.();
      else interiorWeapon.toggleSheath();
    }
    zPrev = zNow;
// a12: SwitchHand (H) - ActionComplete's RELEASE edge
    // (WeaponManager.cs:272), so the latch is inverted against Z's.
    // Same per-mode routing, same reason: dungeonCtx is null indoors.
    const hNow = held(keys, 'SwitchHand');
    if (!hNow && hPrev) {
      if (mode === 'dungeon') dungeonCtx?.switchHand?.();
      else interiorWeapon.switchHand();
    }
    hPrev = hNow;
    if ((_act.activate || (useHeld && !latch.use)) && !overlayHeld) (mode === 'dungeon' ? tryExitDungeon : tryExit)();
    latch.use = useHeld;
    // A successful exit destroyed the modal context and flipped the
    // mode - the render below must NOT run against it. This frame is
    // the transition's; the host resumes next frame. (Root cause of
    // the production crash: tryExit nulled interiorCtx, then this
    // same frame fell into the interior render and read .lights of
    // null. The __exit shot probes call tryExit OUTSIDE the frame
    // loop, so P3/P8 verification never exercised the in-frame path.)
    if (mode === 'exterior') return true;

    const proj = mirrorProjectionX(perspective(fieldOfView(), canvas.clientWidth / canvas.clientHeight, 0.05, 500));   // HANDEDNESS (mat4's law)
    // MW-D25: the modal hosts ride the same Morrowind camera machine as
    // the walk hosts - one eye law, this context's own collider.
    const mwv = mwViewFrame({
      fpEye: cam.pos, feet: player.pos, yaw: cam.yaw, pitch: cam.pitch,
      raycast: (o, d, m) => player.collider?.raycast?.(o, d, m) ?? null,
    });
    const view = lookAt(mwv.eye, [mwv.eye[0] + fwd[0], mwv.eye[1] + fwd[1], mwv.eye[2] + fwd[2]], [0, 1, 0]);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);

    if (mode === 'dungeon') {
      if (pendingDungeonExit) { pendingDungeonExit = false; exitDungeonNow(); return true; }   // F-A5: outside any overlay dispatch
      if (!overlayHeld) dungeonCtx.actions.update(dt);   // dungeon.js:219's `if (!held)` - a paused game advances no movers
      if (!overlayHeld) dungeonCtx.automapTick?.(dt, cam.pos, fwd);   // A1: the 5 Hz reveal probes ride the same gate
      dungeonCtx.flicker.tick(dt);
      // AUDIT 26 F183: castle blocks and the one special area take
      // 0.58 where a plain dungeon takes 0.12 (PlayerAmbientLight.cs
      // :82-90) - Castle Daggerfall, Wayrest and Sentinel's non-hostile
      // wings rendered about five times darker than DFU. The predicate
      // was already live here, driving music and water sounds.
      renderer.setLighting(new Float32Array(dungeonCtx.ambient), 0);
      // AUDIT EV F-R1 (the F001 shape, one field over): the MOON and
      // the player-following INDIRECT light are renderer globals the
      // exterior hosts set per frame and nothing here ever cleared -
      // a dungeon entered on a clear full-Masser night kept a warm
      // ~0.22 directional term at the moon's exterior bearing (about
      // 2x this ambient on moonward faces) for the whole visit, and
      // the R12 indirect sat at stale exterior coordinates. Underground
      // has no sky: both go dark explicitly, exactly as the emission
      // line below already learned to.
      renderer.setMoonlight(null);
      renderer.setIndirectLight(NO_INDIRECT_POS, 0, NO_INDIRECT_COLOR);
      // AUDIT 26 F001: a dungeon mesh is textured by SetDungeonTextures
      // (DaggerfallMesh.cs:153-169), which calls GetMaterial with NO
      // window style - so a dungeon's window records keep the colour a
      // window material is BORN with, DayWindowColor * DayWindowIntensity
      // (MaterialReader.cs:456-461). Written explicitly because the
      // emission tint is one renderer global: before this every
      // non-exterior host simply inherited whatever the exterior last
      // wrote, so a dungeon entered at night glowed amber.
      renderer.setWindowEmission(windowEmissionRGB('day'));
      // ROAD-B (b3): UnderwaterFog.UpdateFog (UnderwaterFog.cs:39-81),
      // called where PlayerEnterExit.Update calls it - every frame the
      // player is inside a dungeon and over a block (:349-352). The
      // DungeonFogSettings this host used to write inline is now the
      // BASE it hands the fog, which backs it up on the dry frames and
      // restores it on surfacing.
      applyFog(renderer, dungeonCtx.underwaterFogSettings?.(cam.pos[1], player.pos, DUNGEON_FOG) ?? DUNGEON_FOG);
      renderer.setPointLights(
        // A10: DungeonLightHandler's XZ block range culls first, the
        // 16-slot shader cap picks from what survives (dungeonLights.js
        // carries the composition and why that order).
        withPlayerLights(nearestLights(dungeonCtx.lights, cam.pos, 16, dungeonCtx.flicker.ranges, null, DUNGEON_LIGHT_BLOCK_RANGE),
          magic?.candleLight(), playerTorchLight(playerEntity, player.pos, cam.yaw)),   // X11 the Light effect's candle; T1 the torch
        new Float32Array(DUNGEON_LIGHT_COLOR));
      renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
      mwViewDrawBody(canvas, { proj, view, eye: mwv.eye, feet: player.pos, yaw: cam.yaw });   // MW-D24
      for (const d of dungeonCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, dungeonCtx.texRemap);
      for (const d of dungeonCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);
      dungeonCtx.flatAnims.tick(dt);   // FA1
      renderer.drawBillboards(dungeonCtx.billboardBatches, camRight, UP_Y);
      // AUDIT 17e F1: this MUST return true like every other exit of
      // the dungeon branch. Returning undefined let the host fall
      // through and run its whole exterior frame on top - the town
      // drawn over the dungeon, and in ?world the streaming recenter
      // fed dungeon-local coordinates.
      if (dungeonCtx.uiOverlayActive) { dungeonCtx.tickOverlay(dt); dungeonCtx.drawOverlay(canvas); return true; }   // U2b/U3: overlays gate the dungeon (AUDIT 18 F5: the overlay's own clock still runs)
      dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, anyMove(moveHeld(keys)), player.height, !!player.isSneaking, { forward: player.moveForward || 0, strafe: player.moveStrafe || 0, running: !!player.isRunning, speed: player.moveSpeed || 0, grounded: player.grounded !== false, jumping: !!player.jumping, swimming: !!player.swimming, levitating: !!player.levitating }, player.bobOffset ? player.bobOffset[1] : 0);   // PX26 F4: the jump-state inputs the interior lane never sent - without them `grounded` read undefined, the rig thought the player was permanently airborne, and BOTH the movement selection and the jump play died in every interior   // moveHeld: the collision-trigger input gate (verbatim)   // C8 foes + S3b clock + S4b missiles - internally gated, must run foes or not (trap spells fire in empty dungeons)
      if (dungeonCtx.waterQuads.length) {
        renderer.drawWater(dungeonCtx.waterQuads, DUNGEON_WATER_COLOR,
          renderer.textures.get(`${dungeonReturn.waterArchive}_0`),
          (now / 1000) * DUNGEON_WATER_SCROLL);
      }
      return true;
    }

    // Whole-pipeline swap: interior draws, lighting, fog, collider;
    // the world sleeps untouched underneath (the modal frame also
    // freezes streaming - the interior-local player position must
    // never feed the recenter logic).
    // AUDIT 23 (C12: cross-6 = wts-3) - PlayerAmbientLight.cs:75-80: a
    // night interior takes the darker purple-tinted ambient.
    renderer.setLighting(new Float32Array(isNight(worldMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT), 0);
    // AUDIT EV F-R1: no moonlight and no stale exterior indirect
    // through the walls - see the dungeon arm's note above.
    renderer.setMoonlight(null);
    renderer.setIndirectLight(NO_INDIRECT_POS, 0, NO_INDIRECT_COLOR);
    renderer.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
    // AUDIT 26 F001: DaggerfallInterior lays out EVERY interior mesh
    // with WindowStyle.Disabled - individual models (:473), the
    // combined static batch (:517) and action doors (:1270) - and
    // Disabled is EmissionColor Color.black outright
    // (MaterialReader.cs:933-935). Nothing re-lights it mid-visit
    // either: the interior is created as a ROOT GameObject
    // (PlayerEnterExit.cs:713), so DaggerfallLocation's Day/Night
    // re-apply on the city-lights edge never reaches it. The port's
    // exterior glow used to follow the player indoors.
    renderer.setWindowEmission(windowEmissionRGB('disabled'));
    // LT1: per-light range AND colour x intensity - AddLight's whole
    // second switch reaches the GPU (interiorLightProperties; the
    // colorOf arm rides the ONE distance sort). The candle and torch
    // keep the white the shared channel always gave them.
    const _itLit = withPlayerLights(
      nearestLights(interiorCtx.lights, cam.pos, 16, interiorCtx.lights.map((l) => l.range),
        (l) => [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity]),
      magic?.candleLight(), playerTorchLight(playerEntity, player.pos, cam.yaw));   // X11 candle; T1 torch
    renderer.setPointLights(_itLit.data, null, _itLit.colors);
    // AUDIT 39 (#33): the gate the dungeon arm above already carries.
    // A paused game advances no movers - DFU's door swing is an iTween
    // that never opts out of timeScale - so a swing begun before the
    // window opened used to complete under it and ring its close sound
    // over a frozen world, while the frame's own ridePlatform (gated)
    // declined to carry the player with it.
    if (!overlayHeld) interiorCtx.actions.update(dt);
    // ROAD-C c2/S9: the 5 Hz reveal probes, the dungeon arm's own gate.
    // CheckForNewlyDiscoveredMeshes runs on IsPlayerInsideBuilding
    // exactly as it runs in a dungeon (Automap.cs:1155).
    if (!overlayHeld) interiorCtx.automapTick?.(dt, cam.pos, fwd);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    mwViewDrawBody(canvas, { proj, view, eye: mwv.eye, feet: player.pos, yaw: cam.yaw });   // MW-D24
    for (const d of interiorCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, interiorCtx.texRemap);
    // WM4b: the mill's machinery turns at Kamer's rate, in here too.
    for (const r of interiorCtx.rotors) {
      // #33: the rotors are movers too - the DRAW below still paints them
      if (!overlayHeld) advanceMachinery(r.state, dt, r.child);
      renderer.drawMesh(r.gpu, mountMachineryChild(r.parent, r.child, r.state.angle), interiorCtx.texRemap);
      // WM4c: the part that carries Spin_Up hums (the gear; the roller's
      // script adds no source). Retried until the context is up.
      if (r.child.loopsSound && !r.hum) r.hum = audio.loop3d(MILL_SOUND.clip, machineryChildPos(r.parent, r.child), MILL_SOUND.volume, MILL_SOUND);
    }
    for (const d of interiorCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, interiorCtx.texRemap);
    // C13: interior arrows fly and draw with the meshes; a new
    // interior (different ctx) drops the stale flights.
    if (_arrowsCtx !== interiorCtx) { interiorArrows.arrows.length = 0; _arrowsCtx = interiorCtx; }
    // AUDIT 39 (#65): with no options this call was pure geometry -
    // every arm of ArrowFlight's impact is gated on the seams it takes
    // here, so the bow-armed quest foe this host mounts shot at the
    // player with sound and animation and landed nothing. The four are
    // world.js's, sourced from this host's own motor and pool.
    // (#64): and the fifth is the PLAYER's shaft, which no non-dungeon
    // host resolved at all.
    interiorArrows.update(dt, {
      playerFeet: player.pos,
      onPlayerHit: (m) => {
        const shooter = m.shooterFoe;
        tallySkill(playerEntity, SKILLS.Dodging, 1);
        const dmg = shooter && !shooter.dead ? calculateAttackDamage(shooter.entity, playerEntity, {
          weapon: m.weapon,
          onInflictPoison: (att, tgt, pt) => inflictPoison(playerEntity, pt, false, { currentMinute: Math.floor(interiorTicker.classicMinutes) }),
          say: (l) => say(l),
        }) : 0;
        if (dmg > 0) {
          hurtPlayer(playerEntity, dmg);
          audio.playOneShot(hitSoundFor(m.weapon), 1.1);
          // AUDIT 39r: and the FLASH, which this arm was copied without.
          // An arrow reaches the player through BowDamage ->
          // ApplyDamageToPlayer -> SendDamageToPlayer, the same door as
          // a blow (world.js:5453's own wave-46 note); the interior
          // MELEE hit already flashes inside exteriorFoes, so only this
          // arm - which applies its own damage - was missing it.
          flashPlayerDamage();
          playPlayerVoice(audio, playerPainVoice(playerEntity, dmg));
          surfacePlayer();
        }
        addItem(playerEntity.items, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });   // BowDamage: the arrow is recoverable from the target
      },
      foeTargets: (interiorFoes?.foes ?? []).filter((t) => !t.dead && t.ai).map((t) => ({ feet: t.ai.feet, ref: t })),
      onFoeHit: (m, t) => interiorFoes?.arrowHitFoe(m, t),
      onPlayerArrowHitFoe: (m, t) => playerArrowHitFoe(m, t, {
        playerEntity, playerWeapon: interiorWeapon.playerWeapon, playerFeet: player.pos,
        dealDamage: (f, d) => interiorFoes?.damageFoe(f, d, player.pos, m.dir),
        audio, hitEffects: interiorHitEffects, say: (l) => say(l),
        onInflictPoison: (att, tgt, pt) => inflictPoison(tgt, pt, false, { currentMinute: Math.floor(interiorTicker.classicMinutes) }),
      }),
    });
    interiorArrows.draw(renderer, interiorCtx.texRemap);
    interiorCtx.flatAnims.tick(dt);   // FA1
    renderer.drawBillboards(interiorCtx.billboardBatches, camRight, UP_Y);
    // HE1: the blood, on the same axis and the same call the exterior
    // host makes for its own pool.
    interiorHitEffects.tick(dt);
    {
      const _blood = interiorHitEffects.batches();
      if (_blood.length) renderer.drawBillboards(_blood, camRight, UP_Y);
    }
    // ID1: the player's own piles, on the same axis and the same call
    // the dungeon host makes for its droppedLoot.
    interiorDropped.tickFlats(dt);
    {
      const _dropBatches = interiorDropped.batches();
      if (_dropBatches.length) renderer.drawBillboards(_dropBatches, camRight, UP_Y);
    }
    // IF: the pool's own billboards ride the same axis, the same call
    // the exterior host makes for its foes.
    if (interiorFoes) {
      const _foeBatches = interiorFoes.batches();
      if (_foeBatches.length) renderer.drawBillboards(_foeBatches, camRight, UP_Y);
    }
    // ROAD-B: the indoor WATCH drives and draws on the same axis, in
    // the same place the exterior host runs its own pool - update
    // RETURNS the batches (cityGuards' shape), so the drive lives here
    // beside the draw rather than up in the sim block, which has no
    // render context to hand it.
    if (interiorGuards && interiorCtx) {
      const _guardBatches = interiorGuards.update(overlayHeld ? 0 : dt, player.pos, cam.pos,
        _interiorSenses(), { canvas, proj, view, eye: mwv.eye });
      if (_guardBatches.length) renderer.drawBillboards(_guardBatches, camRight, UP_Y);
    }
    if (magic) {
      // M2: the armed click's cast + missile flight, on the interior's
      // own collider (the engine's mode-aware raycast reads it).
      magic.firePending([...cam.pos], eyeDir());
      magic.update(dt, player.pos, eyeDir(), player.height);   // X11: the candle hangs off the look direction
      if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, UP_Y);
    }
    // LM1: the transformed move-sound loop, in this host's INTERIOR
    // arm (dungeon mode runs dungeonContext's frame, which carries its
    // own). Outside the `if (magic)` above on purpose - the beast
    // makes its noise whether or not a cast engine was built.
    { const mv = lycanthropeMoveSound(playerEntity, dt); if (mv != null) audio.playOneShot(mv, 1); }
    if (interiorCtx.animateChars) interiorCtx.animateChars((performance.now() - _charT0) / 1000, _charAnimMode);
    for (const d of interiorCtx.charDraws) renderer.drawCharacter(d.mesh, d.matrix);
    // C9: the interior FP weapon - gesture/swing/sounds through the
    // rig; the strike frame runs the WeaponEnvDamage ray against the
    // interior's action objects (swing doors bash, verbatim). Bows
    // consume an Arrow per loose + tally, and the loose is VISIBLE
    // now (C13: the arrow flies until it meets geometry - lost on
    // impact, as DFU misses are). No paralysis gate: effects tick
    // only in the dungeon context.
    // AUDIT 21 (hosts lane, F8): SWINGING INDOORS COST NOTHING AND TRAINED
    // NOTHING. WeaponManager.cs:419-436 drains the swing's fatigue whatever it
    // hits, and only then takes the tally arm - the dungeon does both
    // (dungeonContext's two arms), the city guards do, and this rig did
    // neither. A shop was a free, fatigue-less place to swing a longsword.
    //
    // The bow arm was half-right: it tallied Archery and drained nothing,
    // which disagreed with the dungeon's own bow arm. A bow always takes the
    // tally arm in DFU (`!hitEnemy && WeaponType != Bow` is false for a bow),
    // so it is tallySwingSkills - Archery AND CriticalStrike - not one skill.
    // AUDIT 39 (#34): the rig's MACHINE is held under a window like
    // every other consumer of this frame - a swing in flight when the
    // level-up screen, the death screen or a quest popup opened used
    // to land its hit frame under it, draining fatigue, spending an
    // arrow and tallying skills over a paused game. The draw below
    // stays outside: the viewmodel still paints.
    // AUDIT 39r: ...and the rig takes the paralysis flag the other two
    // above-ground hosts pass (WeaponManager.cs:235-239 - ShowWeapons
    // (false) and no swing). This host's interior rig was handed
    // nothing, so a paralysed player indoors kept swinging.
    for (const ev of (overlayHeld ? [] : interiorWeapon.frame(dt, { paralyzed }))) {
      // AUDIT 23 (combat-2): the bow machine's frame-4 loose sound.
      if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
      if (ev !== 'hit') continue;
      if (weaponTypeForItem(interiorWeapon.playerWeapon.weapon) === WEAPON_TYPES.Bow) {
        if (spendArrow(playerEntity.items)) {
          drainInteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
          tallySwingSkills(playerEntity, interiorWeapon.playerWeapon.weapon);
          interiorArrows.fire(player.eye, eyeDir(), { fromPlayer: true, weapon: interiorWeapon.playerWeapon.weapon });   // #64: LastBowUsed rides the shaft - the impact prices off it
        }
        continue;
      }
      // "// Fatigue loss" - unconditional, whatever the swing meets.
      drainInteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
      // IF: ...and an interior swing CAN meet an enemy now. This was
      // `envAttack` alone, on the strength of a true premise that has
      // stopped being true: with no interior pool there was never a
      // hitEnemy to gate the skill tally on, so the comment here said
      // the swing "trains nothing, which is what DFU does on a miss".
      // A quest foe or a summoned daedra standing in a building is
      // not a miss. WeaponManager.cs:419-436 tallies on the hit and
      // rings the no-enemy sound only when nothing was struck.
      // ROAD-B: the WATCH resolves first, as it does above ground
      // (world.js runs cityGuards.resolvePlayerHit ahead of the
      // encounter pool) - killing a watchman indoors is the same
      // Murder it is in the street, and only its own pool knows that.
      if (interiorGuards?.resolvePlayerHit(interiorWeapon.playerWeapon, cam.pos, eyeDir(), player.pos,
        makeInView(proj, view, multiply), (g) => audio.play3d(hitSoundFor(interiorWeapon.playerWeapon.weapon), g.ai.feet, 1.1, { maxDistance: 16 }))) {
        continue;   // resolvePlayerHit runs DFU's tally arm itself (AUDIT 23 combat-4)
      }
      if (interiorFoes?.resolvePlayerHit(interiorWeapon.playerWeapon, cam.pos, eyeDir(), player.pos,
        makeInView(proj, view, multiply), (wpn) => audio.playOneShot(hitSoundFor(wpn), 1.1))) {
        tallySwingSkills(playerEntity, interiorWeapon.playerWeapon.weapon);
        continue;
      }
      envAttack(interiorCtx.actions, interiorCtx.collider, player.eye, eyeDir());
      // AUDIT 23 (C9) - WeaponManager.cs:423-424: a swing that set no
      // hitEnemy rings the no-enemy sound at the hit frame (the rig's
      // strike-entry whoosh is gone).
      audio.playOneShot(swingSoundFor(interiorWeapon.playerWeapon.weapon), 1.1);
    }
    interiorWeapon.draw({ paralyzed });   // AUDIT 39r: ShowWeapons(false) - no viewmodel while frozen
    // AUDIT 21 (hosts lane, F7): THE HUD, in a building. drawHud lives inside
    // dungeonContext.drawFoes, which the interior arm never calls - so the
    // whole classic status bar vanished the moment you stepped through a door
    // and came back when you stepped out. Same call, same place in the order:
    // last, over the viewmodel, under the overlay.
    // AUDIT 39: THE CALL IS UNCONDITIONAL. drawHud runs the damage
    // flash and the enhanced DOM HUD ABOVE its own `!art` return
    // (hud.js:377-402) because neither reads ARENA2 - "a player whose
    // HUD art failed to load still has vitals". Wrapping the whole
    // call in `if (hudArt)` inverted that: hudArt starts null and is
    // filled by a fire-and-forget load whose failure leaves it null
    // forever.
    {
      const _hfw = [-view[2], -view[10]];
      // X4: the Detect markers, interior arm. THE FOUR HOSTS RULE
      // mounted the feed here before this host had anything to put in
      // it, and DT1 is what that rule is for: the pools filled (shop
      // shelves, house containers, the foe pool, its corpses - see the
      // feed's own construction) and the seam was already standing to
      // receive them. Static interior NPCs remain correctly OUT: they
      // are StaticNPC components, and PlayerGPS lists only enemy and
      // CIVILIAN MOBILE behaviours, of which the port has none
      // indoors.
      const _detected = detectFeed.tick(dt);
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1, dt,
        { detected: _detected, playerXZ: [player.pos[0], player.pos[2]],
          largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity),
          // AUDIT 28 W2: the interior frame never handed drawHud a font,
          // so nothing text-shaped on the classic HUD (the mode word,
          // now the arrow count) could draw indoors while DFU draws
          // the one HUD everywhere. townTalk owns the host's FONT0003.
          font: townTalk?.font ?? null,
// AUDIT 39 (#132): the flag the other three hosts pass and
          // this one never did, so with a window up indoors the HUD
          // was never told the pointer was free - the enhanced strip
          // stayed painted over the window, the crosshair drew, the
          // vitals detector never paused and the spell tooltip could
          // not appear. This frame ends `return true`, so world.js's
          // own drawHud (which does pass it) never runs in here.
          cursorActive: overlayHeld,
          // AUDIT 39: the enhanced HUD's two hand plaques - see world.js.
          readied: magic?.readied?.() ?? null,
          weapon: interiorWeapon.playerWeapon.weapon ?? null,
          weaponSheathed: !!interiorWeapon.playerWeapon.sheathed });   // AUDIT 28 W2: the arrow counter's drawn-bow gate   // U45
    }
    // MERGE AUDIT: the interior arm SAYS things - the static-NPC and
    // guild fallthroughs at :362/:368/:416 all speak through
    // townTalk.say - and this frame is the one that has to show them.
    // Without this the line was queued into a HudText no interior
    // frame ticked: invisible inside, and still queued when the player
    // stepped back out, where the street's frame popped it two seconds
    // late attached to nothing.
    townTalk?.hudFrame?.(dt, _shopFont);
    // E2: the shop browse overlay draws above everything; font-less
    // never traps the motor (the townTalk law).
    if (interiorOverlay) {
      // AUDIT D-C1: this arm DREW the overlay and never TICKED it, so
      // an overlay with a clock stalled here alone - dying inside a
      // building left the death sequence frozen and the run never
      // ended. The other three hosts tick through townTalk.frame and
      // dungeonContext.tickOverlay; this is the fourth.
      //
      // S40: the window is CAPTURED first, and every read below is of
      // the capture. A window may now clear this slot from inside its
      // own tick - RestWindow's death path does, through the PopToHUD
      // door - and re-reading `interiorOverlay` afterwards crashed the
      // frame loop on the draw. Capturing is the shape this module's
      // own overlayInput already uses, and it is robust whether the
      // window clears the slot, the drain does, or nobody does.
      const w = interiorOverlay;
      w.tick?.(dt);
      // THE DONE-DRAIN, which the other three seams carry and two of
      // them call not optional in so many words (townTalk.frame,
      // dungeonContext.tickOverlay). A window may FINISH inside its
      // own tick - RestWindow does, on the death path and on a missing
      // endLines - and until now only overlayInput cleared this slot,
      // so such a window stayed painted over the world.
      if (w.done) { w.dispose?.(); if (interiorOverlay === w) interiorOverlay = null; }
      // ROAD-B B1: the drain above is PopWindow. Reconcile HERE, not
      // just at the top of the frame, so the window it uncovers is the
      // one this frame paints - a message box that finishes inside its
      // own tick hands the screen straight back to the rest window
      // under it, with no blank frame between.
      interiorWindows.reconcile(interiorOverlay);
      // ...and DRAW whatever is in the slot NOW, not the capture. The
      // tick may have emptied it (the drain above) or handed it on to
      // a successor - this module's windows do dispatch to one another
      // - and painting the capture would show last frame's window over
      // this frame's. One read, both cases, no branch a test cannot
      // reach.
      if (!interiorOverlay) { /* the window is gone; nothing to paint */ }
      else if (_shopFont) interiorOverlay.draw(renderer, canvas, _shopFont, hudScale(canvas.width, canvas.height));
      else interiorOverlay = null;
    }
    return true;
  }

  // Shot-mode hooks for everything modal (parity with the pre-P7 world
  // probes; __doors reads the host's live door registry).
  window.__anim = (m) => { _charAnimMode = ['idle','walk','off'].includes(m) ? m : _charAnimMode; return _charAnimMode; };
  function installShotProbes() {
    window.__doors = () => doorTargets().map((e, i) => (
      { i, pos: doorWorldPosition(e.door), normal: doorWorldNormal(e.door), record: e.recordIndex, block: e.dfBlock.name, type: e.door.doorType }));
    window.__enter = () => tryEnter();
    window.__exit = () => tryExit();
    // E2: the shop probe surface
    window.__buildingAt = (i) => JSON.stringify(buildingDataForDoor?.(doorTargets()[i]) ?? null);
    window.__shelves = () => interiorCtx ? JSON.stringify({
      building: interiorBuilding,
      shelves: interiorCtx.shelves.map((s) => ({ stocked: s.items?.length ?? null, pos: [s.matrix[12], s.matrix[13], s.matrix[14]].map((v) => +v.toFixed(1)) })),
    }) : null;
    window.__openShelf = (i) => { openShelf(i); return window.__shopOverlay(); };
    window.__shopOverlay = () => JSON.stringify(interiorOverlay ? {
      native: !!interiorOverlay.hooks,   // U8c: the trade screen surfaces its lists
      // U40: the two lists are LOCAL and REMOTE and what each holds
      // depends on the mode, so the probe reads them through the
      // window's own accessors rather than through a hook that only
      // ever meant "the shelf".
      mode: interiorOverlay.mode,
      remote: interiorOverlay.remoteList?.().length,
      local: interiorOverlay.localList?.().length,
      basket: interiorOverlay.basket?.length,
      staged: interiorOverlay.staged?.length,
      cost: interiorOverlay.cost?.().cost,
      canCommit: interiorOverlay.cost?.().modeActionEnabled,
      box: interiorOverlay.box ? {
        buttons: interiorOverlay.box.buttons,
        rows: interiorOverlay.box.rows?.map((r) => r.text ?? r),
      } : null,
      lastPrice: interiorOverlay.lastPrice,
      lines: interiorOverlay.lines, options: interiorOverlay.options?.filter((o) => o.label).map((o) => o.label),
    } : null);
    /** Click a trade-panel rect by name (the probe cannot aim at art). */
    // V4: THE DONE-SWEEP. These two call the window's click() directly
    // and skipped the sweep pointerdown does, and that
    // __inventoryPickRemote already did - so a window that had set
    // `done` (EXIT is the obvious one) stayed in the slot and every
    // reader downstream still saw it open. The playthrough probe
    // bought a horse, pressed EXIT through here, and reported that the
    // trade window would not close; the window had closed, the hook
    // had not noticed.
    // X11c: ...and the window is no longer always in the INTERIOR slot.
    // A shop's trade window still is - you walk into a shop - but the
    // IDENTIFY SPELL can be cast in a dungeon or in the street, and
    // since X11c it opens there, in whichever slot that mode draws. A
    // probe that only knew one slot would report "no window" for a
    // window that is plainly up.
    const _liveTrade = () => {
      const w = mode === 'dungeon' ? dungeonCtx?.overlayWindow?.()
        : mode === 'interior' ? interiorOverlay
          : townTalk?.overlay;
      return w instanceof NativeTradeWindow ? w : null;
    };
    const _tradeSweep = (r) => {
      if (interiorOverlay?.done) interiorOverlay = null;
      return r;
    };
    window.__tradeClick = (key) => {
      const [x, y, w, h] = TRADE_RECTS[key];
      return _tradeSweep(_liveTrade()?.click?.(x + w / 2, y + h / 2) ?? false);
    };
    window.__tradeSlot = (which, slot) => {
      const [x, y] = TRADE_RECTS[which === 'local' ? 'localList' : 'remoteList'];
      return _tradeSweep(_liveTrade()?.click?.(x + 30, y + 20 + slot * 38) ?? false);
    };
    window.__openMerchantSell = () => { openMerchantSell(); return window.__shopOverlay(); };
    // B2: the bank's own surface, for the probe.
    // P1: the scene cache's own surface.
    window.__sceneCache = () => JSON.stringify({
      scene: currentInteriorScene(),
      cached: [...(playerEntity.sceneCache?.scenes?.keys?.() ?? [])],
      permanent: [...(playerEntity.sceneCache?.permanent ?? [])],
      shelves: (interiorCtx?.shelves ?? []).map((sh) => sh.items?.length ?? null),
    });
    /** Take one item off a shelf, so a probe can prove a CHANGE
     *  survives rather than reading the same number twice. */
    window.__takeFromShelf = (i) => {
      const sh = interiorCtx?.shelves?.[i];
      if (!sh?.items?.length) return null;
      sh.items.pop();
      return sh.items.length;
    };
    // M4: the item maker, opened through the REAL guild-service
    // dispatcher rather than a private shortcut - the destination
    // string is the seam M4 filled (ItemMakerWindow, mounted at the
    // `guildServiceItemMaker` arm), and a probe that bypassed it would
    // prove nothing about it.
    /** G4 probe seams: drop whatever overlay is up, and move the one
     *  clock (a holiday is a DAY OF YEAR, so a probe cannot reach one
     *  by waiting). */
    window.__closeOverlay = () => { interiorOverlay = null; return true; };
    window.__setWorldMinutes = (m) => setWorldMinutes(m);
    // P1: write the deed directly, so a probe can walk into a house it
    // owns without also having to walk the bank's purchase window (H2
    // probes that separately). AllocateHouseToPlayer is H1's own door.
    // P1: PlayerActivate.currentMode, set directly. The R1 door ladder
    // only offers a lockpick in STEAL mode, and the closed-shop arm of
    // the people gate lives behind that pick - so a probe that cannot
    // reach the mode cannot reach the law.
    window.__setInteractionMode = (m) => setInteractionMode(m);
    window.__ownHouse = (buildingKey, regionIndex = null) => {
      // The region has to be the BUILDING's, not "whatever the host
      // last looked at". The deed is filed per region and the gate
      // reads it back with the entered building's own regionIndex, so
      // a deed written into the wrong slot self-confirms and then does
      // nothing - which is precisely what the first live run showed.
      const region = regionIndex ?? interiorBuilding?.regionIndex ?? buildingDirectory?.()?.regionIndex ?? 0;
      // the registry is BANK_REGION_COUNT slots, not a bare array -
      // allocateHouseToPlayer writes into houses[regionIndex] and an
      // empty [] has no slot to write
      if (!playerEntity.houses?.length) playerEntity.houses = createHouses(BANK_REGION_COUNT);
      allocateHouseToPlayer(playerEntity.houses, region,
        { buildingKey, mapId: 0, location: '' },
        { ...houseSideEffects(), playerName: playerEntity.name ?? '', regionName: '' });
      return isHouseOwned(playerEntity.houses, region, buildingKey);
    };
    /** G4: open ANY guild-service destination through the real
     *  dispatcher, at the Mages Guild by default - the four store
     *  arms all price off the guild's own faction id, so a probe that
     *  faked the guild would not be testing the thing that was
     *  broken. */
    window.__openGuildService = (destination, group = GUILD_GROUPS.MagesGuild, buildingFactionId = 0) => {
      const dict = townTalk?.factionDict ?? null;
      const guild = createGuildForGroup(group, buildingFactionId, dict);
      const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book
      // The real caller assigns what openServiceFlow RETURNS - the
      // trade arms hand back a flow for the popup to mount, where the
      // maker windows mount themselves and answer null. A probe that
      // dropped the return value would test only half of them.
      const flow = openServiceFlow(destination, { guild, memberships, store: null, rows: null, route: null });
      // the same contract the real caller keeps: a window mounts, a
      // BOX does not (it belongs on the popup that asked)
      if (flow && !flow.rows) interiorOverlay = flow;
      return guild?.factionId ?? null;
    };
    /** Join a guild at a chosen rank, so a probe can reach the
     *  member-only half of a service (the gem run on the magic shelf
     *  is gated on CanAccessService, which is false for a stranger). */
    window.__joinGuild = (group = GUILD_GROUPS.MagesGuild, rank = 6, buildingFactionId = 0) => {
      const guild = createGuildForGroup(group, buildingFactionId, townTalk?.factionDict ?? null);
      const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book
      const m = joinGuild(memberships, guild, Math.floor(worldMinutes()));
      m.rank = rank;
      return JSON.stringify(m);
    };
    window.__knightlyGroup = GUILD_GROUPS.KnightlyOrder;
    // A knightly order is VARIANT-keyed: createGuildForGroup needs the
    // hall's own faction id to know WHICH order, so a probe has to
    // name one (the Order of the Candle, 408).
    window.__knightlyFaction = ORDERS.Candle;
    /** G6: the inventory overlay's live state, and its two pick
     *  doors - the choose-one law is entirely in what a click on
     *  either list does.
     *
     *  Recognised by SHAPE rather than by type: this host constructs
     *  no inventory window of its own (U26's four-hosts pin), it
     *  mounts the one its host builds, so importing the class here
     *  purely to name it would make that pin read false. */
    const isInventory = (w) => !!w && typeof w._pickRemote === 'function' && typeof w._remote === 'function';
    window.__inventoryOverlay = () => JSON.stringify(isInventory(interiorOverlay) ? {
      inventory: true,
      mode: interiorOverlay.mode,
      chooseOne: !!interiorOverlay.chooseOne,
      remote: interiorOverlay._remote().map((i) => ({ t: i.templateIndex, m: i.material })),
      local: interiorOverlay._filtered().length,
    } : null);
    window.__inventoryPickLocal = (slot) => {
      if (!isInventory(interiorOverlay)) return null;
      interiorOverlay._pick(slot);
      return window.__inventoryOverlay();
    };
    window.__inventoryPickRemote = (slot) => {
      if (!isInventory(interiorOverlay)) return null;
      const w = interiorOverlay;
      w._pickRemote(slot);
      if (w.done && interiorOverlay === w) interiorOverlay = null;
      return window.__inventoryOverlay();
    };
    window.__openItemMaker = () => {
      window.__openGuildService('guildServiceItemMaker');
      return window.__itemMakerOverlay();
    };
    /** What the trade window is showing, and the price context it is
     *  pricing with - the guildFactionId in particular, the null G4
     *  closed, threaded from openTradeWindow's priceCtx to every guild
     *  call site. */
    window.__tradeOverlay = () => JSON.stringify(_liveTrade() ? (() => {
      const w = _liveTrade();
      return {
        trade: true,
        mode: w.mode,
        remote: w.remoteList().map((i) => ({
          name: i.name, value: i.value, identified: !!i.isIdentified,
          soul: i.trappedSoulType === undefined ? undefined : i.trappedSoulType,
        })),
        local: w.localList().length,
        localNames: w.localList().map((i) => i.name),   // X11c: a probe cannot aim at art, and slot 0 is rarely the one it means
        priceCtx: (() => { const c = w.hooks.priceCtx(); return { quality: c.quality, holidayId: c.holidayId, guildFactionId: c.guildFactionId }; })(),
        // T2: the window's OWN weighing input - what ConfirmTrade's
        // sell arm tests the proceeds against (:1039). Without it a
        // probe cannot tell a sale that refused to pay from a sale
        // correctly paid in parchment, and tools/tradeModeProbe.mjs
        // spent its whole life reporting the first for the second.
        weight: w.hooks.weight?.() ?? null,
        cost: w.cost(),
        usingIdentifySpell: !!w.hooks.usingIdentifySpell,   // X11c
        box: w.box ? { buttons: w.box.buttons, rows: w.box.rows?.map((r) => r.text ?? r) } : null,   // X11c: the confirmation the deal raises
      };
    })() : null);
    window.__itemMakerOverlay = () => JSON.stringify(interiorOverlay instanceof ItemMakerWindow ? {
      itemMaker: true,
      done: interiorOverlay.done,
      tab: interiorOverlay.tab,
      listed: interiorOverlay.items().map((it) => it.name),
      selected: interiorOverlay.selected?.name ?? null,
      labels: interiorOverlay.labels(),
      powers: interiorOverlay.powers.map((e) => ({ type: e.type, param: e.param, cost: e.enchantCost, parent: e.parentEnchantment })),
      sideEffects: interiorOverlay.sideEffects.map((e) => ({ type: e.type, param: e.param, cost: e.enchantCost, parent: e.parentEnchantment })),
      picker: interiorOverlay.picker ? interiorOverlay.picker.items : null,
      box: interiorOverlay.box ? interiorOverlay.box.rows?.map((r) => r.text ?? r) : null,
    } : null);
    window.__itemMakerClick = (key) => {
      const [x, y, w, h] = ITEM_RECTS[key];
      return interiorOverlay?.click?.(x + w / 2, y + h / 2) ?? false;
    };
    /** Click a row of whichever list picker is up, by its LABEL - so a
     *  probe names the enchantment it wants rather than an index that
     *  the alpha sort would silently move. */
    /** Click item SLOT i of the scroller, at the middle of that
     *  slot's own cell - the rect centre lands on slot 1, which is a
     *  fine way to prove nothing. */
    window.__itemMakerSlot = (i) => {
      const [x, y] = ITEM_RECTS.itemList;
      interiorOverlay?.click?.(x + 9 + 20, y + i * 38 + 19);
      return window.__itemMakerOverlay();
    };
    /** Click a ROW of one of the two enchantment lists, by its key -
     *  through the window's own click(), at the rect rowLayout puts
     *  that row at, so the probe exercises the real hit test. */
    window.__itemMakerRemoveRow = (which, key) => {
      const w = interiorOverlay;
      if (!(w instanceof ItemMakerWindow)) return null;
      const rect = which === 'powers' ? ITEM_RECTS.powersList : ITEM_RECTS.sideEffectsList;
      const row = itemMakerRowLayout(which === 'powers' ? w.powers : w.sideEffects)
        .find((r) => r.entry.key === key);
      if (!row) return null;
      w.click(rect[0] + 2, rect[1] + row.y + 1);
      return window.__itemMakerOverlay();
    };
    window.__itemMakerPick = (label) => {
      const p = interiorOverlay?.picker;
      const i = p?.items?.indexOf(label) ?? -1;
      if (i < 0) return null;
      p._pick(i);
      // the CURRENT picker, not the one just used: picking a primary
      // effect opens a SECOND picker from inside onPick, and testing
      // the old one (which is now done) would close the new one.
      if (interiorOverlay.picker?.done) interiorOverlay.picker = null;
      return window.__itemMakerOverlay();
    };
    // H3: the market the purchase window lists, priced. A probe that
    // wants to OWN a house has to take a key the directory actually
    // knows, or the sell price it later reads has nothing to measure.
    window.__housesForSale = () => pricedHousesForSale().map((h) => ({
      buildingKey: h.buildingKey,
      regionIndex: buildingDirectory?.()?.regionIndex ?? 0,
      meshRadius: +(h.meshRadius ?? 0).toFixed(3),
    }));
    window.__openBank = () => { openBank(); return window.__bankOverlay(); };
    window.__bankOverlay = () => JSON.stringify(interiorOverlay instanceof BankWindow ? {
      bank: true,
      done: interiorOverlay.done,
      type: interiorOverlay.transactionType,
      value: interiorOverlay.value,
      labels: interiorOverlay.labels(),
      region: interiorOverlay.region,
      box: interiorOverlay.box ? {
        buttons: interiorOverlay.box.buttons,
        rows: interiorOverlay.box.rows?.map((r) => r.text ?? r),
      } : null,
      enabled: Object.fromEntries(['depositGold', 'withdrawGold', 'loanRepay', 'loanBorrow']
        .map((k) => [k, interiorOverlay.enabled(k)])),
      // H3: what the two DEED buttons can see. A probe that could only
      // read the box could not tell an offer of the right price from
      // an offer of zero, which is what the sell arm used to quote.
      deeds: {
        ownsHouse: !!interiorOverlay.hooks.ownsHouse?.(),
        houseSellPrice: interiorOverlay.hooks.houseSellPrice?.() ?? 0,
        ownsShip: !!interiorOverlay.hooks.ownsShip?.(),
        ownedShip: interiorOverlay.hooks.ownedShip?.() ?? -1,
        isPortTown: !!interiorOverlay.hooks.isPortTown?.(),
        accountGold: playerEntity.bankAccounts?.[interiorOverlay.region]?.accountGold ?? 0,
      },
    } : null);
    // H3: the window's own keyboard. `__bankClick` drives the panel's
    // hit rects, but a Yes/No box answers KEYS - and the world host
    // does not route a real keypress into interiorOverlay unless the
    // player is inside a building, so a probe that opened the bank
    // through __openBank could click the offer up and never accept it.
    window.__bankKey = (code) => { interiorOverlay?.input?.(code, null); return window.__bankOverlay(); };
    window.__bankClick = (key) => {
      const [x, y, w, h] = BANK_RECTS[key];
      return interiorOverlay?.click?.(BANK_PANEL_X + x + w / 2, BANK_PANEL_Y + y + h / 2) ?? false;
    };
    window.__dungeon = () => dungeonCtx ? JSON.stringify({
      exits: dungeonCtx.exitDoors.map((d) => ({ pos: doorWorldPosition(d).map((v) => +v.toFixed(2)), normal: doorWorldNormal(d).map((v) => +v.toFixed(3)) })),
      actions: dungeonCtx.actions.objects.size,
    }) : null;
    window.__dungeonExit = () => tryExitDungeon();

    // V4 (the first-hour playthrough probe): THE WORLD HOST'S DUNGEON
    // MODE HAD NO COMBAT OR LOOT SURFACE AT ALL. worldModes mounts a
    // real dungeonContext but installed none of the hooks
    // scenes/dungeon.js:279-305 carries, so a probe could take the
    // classic start into Privateer's Hold and then see nothing inside
    // it - no foes, no vitals, no corpses. Same names and same shapes
    // as the standalone host's, so one probe reads either.
    window.__hp = () => JSON.stringify({
      health: playerEntity.health, maxHealth: playerEntity.maxHealth,
      fatigue: playerEntity.fatigue ?? null, magicka: playerEntity.magicka ?? null,
    });
    window.__foes = () => (dungeonCtx ? JSON.stringify(dungeonCtx.foes.map((f, i) => ({
      i, type: f.mobileType, dead: !!f.dead, health: f.entity?.health,
      corpse: !!f.corpseBatch,   // V1's DESTROY-vs-KILL discriminator
      pos: f.ai ? f.ai.feet.map((v) => +v.toFixed(2)) : null,
    }))) : null);
    // The REAL damage door, where the Soul Trap intercept and the
    // corpse spawn sit (V3's seam, this host's copy).
    window.__damageFoe = (i, n) => {
      const f = dungeonCtx?.foes?.[i];
      if (!f) return null;
      dungeonCtx.damageFoe(f, n ?? (f.entity?.health ?? 1), null, null);
      return JSON.stringify({ dead: !!f.dead, health: f.entity?.health, corpse: !!f.corpseBatch });
    };
    window.__piles = () => (dungeonCtx
      ? JSON.stringify((dungeonCtx.dropped?.() ?? []).map((p) => ({ n: p.items.length, flat: !!p.batch })))
      : null);
    // ...and the OTHER loot door, which is the one a kill uses. An
    // enemy's loot rides its OWN entity (GenerateItems(lootTableKey) at
    // spawn) and its CORPSE becomes the container; nothing is ever
    // dropped on the floor. The playthrough probe asserted __piles
    // after a kill, got nothing, and briefly called the game broken.
    window.__lootTargets = () => (dungeonCtx ? JSON.stringify(dungeonCtx.lootTargets().map((t) => t.key)) : null);
    window.__takeLoot = (k) => (dungeonCtx ? dungeonCtx.takeLoot(k) : null);
    /** Move remote slot `slot` into the pack through the window's own
     *  pick (the __inventoryPickRemote idiom, dungeon side). */
    window.__dungeonPickRemote = (slot) => {
      const w = dungeonCtx?.overlayWindow?.();
      if (!w?._pickRemote) return null;
      w._pickRemote(slot);
      return JSON.stringify({ kind: w.constructor.name, local: w._filtered?.().length ?? null, remote: w._remote?.().length ?? null });
    };
    // One read that answers "is a window up, and which" - in ALL THREE
    // modes since X11c. It used to cover only the two this module owns
    // and send a probe to __talk() for the exterior, on the reasoning
    // that the exterior slot belongs to world.js. That stopped being
    // safe the moment spell windows started mounting there: a probe
    // reading this outdoors got `interiorOverlay`, which is null, and
    // reported "no window" for a window plainly up.
    window.__overlayKind = () => (mode === 'dungeon'
      ? (dungeonCtx?.overlayWindow?.()?.constructor?.name ?? null)
      : mode === 'interior'
        ? (interiorOverlay?.constructor?.name ?? null)
        : (townTalk?.overlay?.constructor?.name ?? null));
    // U31: probe-only warp. The dungeon EXIT is a raycast pick against
    // the real exit door (tryExitDungeon), so proving the classic start
    // can get out means standing the player at that door the way a
    // player who walked there would - not calling a shortcut that
    // bypasses the pick. Lives inside installShotProbes, so it exists
    // only under ?shot and never in a played build.
    window.__warpTo = (pos, yaw) => {
      player.spawn(pos[0], pos[1], pos[2]);
      cam.pos = [...player.eye];
      if (yaw !== undefined) cam.yaw = yaw;
      return JSON.stringify({ pos: player.eye.map((v) => +v.toFixed(2)), yaw: +cam.yaw.toFixed(3) });
    };
    window.__pickInterior = () => {
      if (!interiorCtx) return null;
      const dir = eyeDir();
      const rows = [];
      interiorCtx.ladders.forEach((l, i) => {
        const aabb = objAabb(l);
        rows.push({ key: `ladder:${i}`, aabb: aabb.min.map((v) => +v.toFixed(2)).concat(aabb.max.map((v) => +v.toFixed(2))), hit: rayAabbProbe(player.eye, dir, aabb) });
      });
      return JSON.stringify({ eye: player.eye.map((v) => +v.toFixed(2)), dir: dir.map((v) => +v.toFixed(2)), occluder: +interiorCtx.collider.raycast(player.eye, dir, 50).toFixed(2), rows });
    };
    window.__markers = () => interiorCtx ? JSON.stringify(interiorCtx.markers.filter((m) => m.type === 21 || m.type === 22).map((m) => ({ t: m.type, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2) }))) : null;
    window.__ladders = () => interiorCtx ? JSON.stringify(interiorCtx.ladders.map((l) => ({ x: +l.matrix[12].toFixed(2), y: +l.matrix[13].toFixed(2), z: +l.matrix[14].toFixed(2) }))) : null;
    window.__people = () => interiorCtx ? interiorCtx.people.length : null;
    // P1: the visibility gate's live answer. `__people` counts the
    // people the block DECLARES; this says how many of them AddPeople
    // actually stood, and names the inputs the gate read - a probe
    // that only saw the count could not tell a closed shop from an
    // empty one.
    window.__peopleGate = () => (interiorCtx ? JSON.stringify({
      declared: interiorCtx.people.length,
      standing: interiorCtx.people.filter((pn) => pn.active).length,
      questWired: interiorCtx.people.filter((pn) => pn.questBehaviour).length,
      buildingType: interiorBuilding?.buildingType ?? null,
      factionId: interiorBuilding?.factionId ?? null,
      buildingKey: interiorBuilding?.buildingKey ?? null,
      hour: Math.floor((Math.floor(worldMinutes()) % 1440) / 60),
    }) : null);
    window.__peopleList = () => interiorCtx ? JSON.stringify(interiorCtx.people.map((pn) => ({ a: pn.textureArchive, r: pn.textureRecord, x: +pn.x.toFixed(1), y: +pn.y.toFixed(1), z: +pn.z.toFixed(1) }))) : null;
    // U23: the static-NPC seam, probe-side. __staticNpcs surfaces the
    // faction id and the resolved billboard extent (no extent, no
    // activation target); __activateNpc runs the click without needing
    // the probe to aim a ray; __guildOverlay reads the open popup.
    window.__staticNpcs = () => (interiorCtx ? JSON.stringify(interiorCtx.people.map((pn, i) => ({
      i, faction: pn.factionID, service: npcServiceKind(pn.factionID),
      w: pn.width ? +pn.width.toFixed(2) : null, h: pn.height ? +pn.height.toFixed(2) : null,
    }))) : null);
    window.__activateNpc = (i) => { activateStaticNpc(interiorCtx?.people[i]); return true; };
    window.__guildOverlay = () => JSON.stringify(interiorOverlay?.hooks?.service ? {
      guild: true, member: interiorOverlay.hooks.member(), service: interiorOverlay.hooks.service(),
      boxes: interiorOverlay.boxes.map((b) => b.textId ?? (b.rows?.[0]?.text ?? b.rows?.[0])),
    } : null);
    // U24: the service flow's own surface (the guild popup is gone by
    // the time one is open, so __guildOverlay reads null).
    window.__serviceFlow = () => JSON.stringify(interiorOverlay?.boxes && !interiorOverlay.hooks ? {
      flow: true,
      box: interiorOverlay.top?.rows?.map((r) => r.text ?? r).join(' | ') ?? null,
      buttons: interiorOverlay.top?.buttons ?? null,
      picker: interiorOverlay.top?.picker ?? null,
      field: !!interiorOverlay.top?.field,
      value: interiorOverlay.value ?? null,
      queued: interiorOverlay.boxes.length,
    } : null);
    // U39: the tavern panel and, once a button is pressed, the chain
    // it raised - one reader, because the chain lives INSIDE the
    // window (both buttons close the tavern before it runs, so the
    // panel and the box are never both on screen).
    window.__tavernOverlay = () => JSON.stringify(interiorOverlay instanceof TavernWindow ? {
      tavern: true,
      done: interiorOverlay.done,
      rooms: (playerEntity.rentedRooms ?? []).length,
      gold: goldAmount(playerEntity),
      box: interiorOverlay.flow?.top?.rows?.map((r) => r.text ?? r).join(' | ') ?? null,
      buttons: interiorOverlay.flow?.top?.buttons ?? null,
      picker: interiorOverlay.flow?.top?.picker ?? null,
      field: !!interiorOverlay.flow?.top?.field,
      value: interiorOverlay.flow?.value ?? null,
    } : null);
    window.__tavernClick = (key) => {
      const [x, y, w, h] = TAVERN_RECTS[key];
      return interiorOverlay?.click?.(TAVERN_PANEL_X + x + w / 2, TAVERN_PANEL_Y + y + h / 2) ?? false;
    };
    window.__building = () => JSON.stringify(interiorBuilding ? {
      type: interiorBuilding.buildingType, faction: interiorBuilding.factionId, name: interiorBuilding.name,
    } : null);
    window.__enemies = () => dungeonCtx ? JSON.stringify(dungeonCtx.enemies.slice(0, 8).map((e) => ({ t: e.mobileType, x: +e.x.toFixed(1), y: +e.y.toFixed(1), z: +e.z.toFixed(1), fixed: e.fixed }))) : null;
    window.__interiorActions = () => interiorCtx ? JSON.stringify(
      [...interiorCtx.actions.objects.values()].map((o) => ({ key: o.key, state: o.state, pos: [o.matrix[12], o.matrix[13], o.matrix[14]].map((v) => +v.toFixed(2)), fwd: [o.matrix[8], o.matrix[9], o.matrix[10]].map((v) => +v.toFixed(3)) }))) : null;
    window.__interiorActivate = (k) => interiorCtx.actions.activate(k);
    window.__interiorRay = () => {
      const dir = eyeDir();
      return interiorCtx.collider.raycast(player.eye, dir, 50);
    };
    window.__mode = () => mode;
  }

  // C8 E3c: RMB drag-to-swing forwarded to the active dungeon context
  // (the shared machine consumes deltas once per frame). contextmenu
  // suppressed so the right button is a weapon control, as classic.
  // U45: Actions.ActivateCursor (Enter) frees the mouse during play.
  /** A window owned by the mode this host is drawing is up. ONE
   *  expression: the cursor toggle and the attack seam below read it. */
  const modalWindowUp = () => (mode === 'dungeon' ? !!dungeonCtx?.uiOverlayActive : !!interiorOverlay);
  bindCursorToggle(canvas, modalWindowUp, actionOf);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // C9: interior mode routes the same RMB seam to its weapon rig.
  const modalAttackSink = () =>
    (mode === 'dungeon' && dungeonCtx) ? dungeonCtx.playerAttackInput
      : mode === 'interior' ? ((dx, dy, held) => { if (held && magic?.interceptAttack(true)) return; interiorWeapon.attackInput(dx, dy, held); })   // M2: an armed cast eats the click
        : null;
  addEventListener('mousemove', (e) => {
    const sink = modalAttackSink();
    if (sink && document.pointerLockElement === canvas && (e.buttons & 2)) {
      sink(e.movementX, e.movementY, true);
    }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 2) modalAttackSink()?.(0, 0, false);   // the RELEASE is never gated - a window opened mid-swing must still let go
  });
  addEventListener('mousedown', (e) => {
    // I4: a right-click on a window is the WINDOW's (the remove
    // gesture), never a swing - dungeon.js:195 and both exterior slots
    // have always said so, and this host's modal arm had no gate at
    // all. DFU pauses the game under any PauseWhileOpen window
    // (UserInterfaceManager.cs:179-185), so the click never reaches
    // WeaponManager - and here it reached interceptAttack first, so a
    // readied spell was CAST by a right-click meant to remove an item.
    if (e.button === 2 && !modalWindowUp()) modalAttackSink()?.(0, 0, true);
  });

  /** U43: the interior host's routeKey context - the same shape the
   *  dungeon context answers, so ONE table (ui/input.js) drives both.
   *
   *  Its windows are the OUTER host's: `host.makeInventory`,
   *  `host.makeCharSheet` and `host.makeJournal` are that host's own
   *  builders, riding in the way G6's gift window already did. The
   *  interior host builds nothing of its own here - THE ONE
   *  CONSTRUCTION SEAM - it only decides which slot the window lands
   *  in, because this mode draws `interiorOverlay` and not townTalk's.
   *
   *  IS1 closed the last absent arms: quickSave/quickLoad land on the
   *  world host's ONE composer (GameManager.cs:570-586 dispatches the
   *  quick keys scene-free; the interior was the one mode still
   *  answering nothing). */
  /** PUSH a window onto this host's stack - UserInterfaceManager
   *  .PushWindow (:79-91) through its AddWindow (:179-186).
   *
   *  ROAD-B B1 RETIRED THE FLAG THAT STOOD HERE. It read: "pause-and-
   *  resume is the DFU behaviour and a single-slot host cannot have
   *  it; ending cleanly is the honest approximation, not a claim to
   *  have ported it." The single slot is now the TOP of a real stack
   *  (ui/windowStack.js), so the honest approximation is retired with
   *  it and the behaviour is the ported one:
   *
   *  DFU pauses a rest while another window is on top - TickRest's
   *  `uiManager.TopWindow != this` at :364, and again at :399 because
   *  "quest tick above can perfectly align with rest ending" - and
   *  RESUMES it when that window pops. Here the pushed box becomes the
   *  slot, so the frame's one tick reaches the box and not the rest
   *  (the rest is not top, so it does not advance); when the box
   *  drains, `reconcile` pops and the rest is back in the slot with its
   *  session, its hours and its IsResting intact.
   *
   *  What the old replace-and-dispose bought - a rest that could not
   *  leave `IsResting` raised for the session - the stack keeps for
   *  free: the rest is never abandoned, so there is nothing to leak.
   *  Nothing is disposed on the way IN any more; a window is disposed
   *  when it actually closes, on the drain paths that already do it. */
  const mountInterior = (w) => {
    if (!w) return;
    interiorWindows.reconcile(interiorOverlay);   // whatever the slot holds NOW is the top
    if (interiorWindows.containsWindow(w)) return;   // re-mounting the open window is not a push
    interiorWindows.pushWindow(w);
  };

  // CanRest's argument bag for INSIDE A BUILDING. `inTownOutside`
  // is a constant false here and that is the law, not a shortcut:
  // IsPlayerInTown(true, true) passes `mustBeOutside`, and the player
  // is by definition not. `inTown` is the bare IsPlayerInTown() -
  // location TYPE only, no rect test and no inside test, because both
  // of its optional flags default off (PlayerGPS.cs:504-527).
  const interiorRestPlaceHere = () => {
    const b = interiorBuilding;
    const mapId = questSceneCtx?.()?.mapId ?? 0;
    const buildingKey = b?.buildingKey ?? 0;
    const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book
    const dict = townTalk?.factionDict ?? null;
    const guild = b?.factionId ? guildOfFaction(b.factionId, resolveVariantGuild(dict), dict) : null;
    // The SHAPE is systems/restSession.js' (a review round showed a bag
    // built in a closure can only be pinned by a regex over its own
    // source, and proved that hollow); this reads the live values.
    const scene = currentInteriorScene();
    return interiorRestPlace({
      inTownLocation: host.inTownLocation?.() ?? false,
      building: b,
      nowMinutes: Math.floor(worldMinutes()),
      // Interior.FindMarkers(InteriorMarkerTypes.Rest) - the same read
      // rentRoom's bedCount makes, so the stored index lines up with
      // the list it indexes. canRest wants the COUNT and answers an
      // index; the marker itself is resolved at MoveToBed.
      restMarkers: interiorRestMarkers().length,
      permanentScene: !!scene && containsPermanentScene(sceneCache(), scene),
      // H1 CLOSED THIS. Both rest lanes left it false with a note
      // saying "the moment a house can be bought, this is the line
      // that lets you sleep in it" - and that moment arrived in the
      // same merge: DaggerfallBankManager.IsHouseOwned is live over
      // the region's own registry slot.
      houseOwned: isHouseOwned(playerEntity.houses ?? [], b?.regionIndex ?? 0, b?.buildingKey ?? 0),
      // GetRentedRoom(mapId, buildingKey), through the SAME finder the
      // tavern window rents with - so the bed this answers is the bed
      // that was sold (tavern.js's own flag, retired here).
      room: findRentedRoom(playerEntity.rentedRooms ?? [], mapId, buildingKey),
      // GuildManager.GetGuild(factionID).CanRest() - THIS building's
      // faction, not the player's chosen guild. canRest() applies the
      // tavern exclusion itself.
      guildCanRest: !!guild && guildCanRest(guild, membershipOf(memberships, guild)),
    });
  };
  /** The Rest markers this interior has, resolved once - canRest wants
   *  the count, MoveToBed wants the list. */
  const interiorRestMarkers = () =>
    (interiorCtx?.markers ?? []).filter((m) => m.type === INTERIOR_MARKER.REST);

  // The interior host's RestWindow deps: the shared composition plus
  // what only this host knows. MoveToBed lands the player on the bed
  // marker CanRest picked (PlayerMotor.transform.position +
  // FixStanding; the port's spawn does the standing fix).
  const interiorRestDeps = createRestDeps(playerEntity, {
    // ROAD-B B5: `uiManager.TopWindow` for TickRest's two top-window
    // tests (:364, :399). B1 made this host's slot the MIRROR OF THE
    // TOP of its window stack, so the slot IS the answer - and the
    // reachable test is the second one, where a quest popup pushed by
    // the rest's own sub-tick suspends it mid-hour.
    topWindow: () => interiorOverlay,
    // The MASTERY box (RaiseSkills :1390-1401) - TEXT.RSC 4020.
    box: (rows) => mountInterior(new ActionTextBox(rows)),
    advanceMinutes: (n) => interiorTicker.advance(n),
    // TickRest :379 - QuestMachine.Instance.Tick() rides the same
    // sub-tick as the clock, UNPACED (DFU calls the machine directly,
    // not through QuestMachine.Update's ticksPerSecond timer). This
    // host's ordinary quest tick is gated on "no overlay up", so
    // without this a rested night ran none at all.
    tickQuests: () => questBridge?.machine?.tick?.(),
    enemiesNearby: () => interiorEnemiesNearby({ resting: true }),   // IF: the pool IS this host's scan (S40's resting variant)
    place: interiorRestPlaceHere,
    // MoveToBed (:601-609) is `transform.position = allocatedBed` and
    // then FixStanding(0.4, 0.4) - the snap is NOT optional. floorLanding
    // is this port's FixStanding, and skipping it is the exact failure
    // the dungeon's own start-marker comment records: a marker in tight
    // geometry leaves the capsule inside the collider and the player
    // wedges. The +1.08 lifts the marker point to the capsule centre,
    // the same offset startSpawn uses.
    moveToBed: (bedIndex) => {
      const m = bedIndex >= 0 ? interiorRestMarkers()[bedIndex] : null;
      if (!m || !interiorCtx) return;
      const f = floorLanding(interiorCtx.collider, [m.x, m.y + 1.08, m.z]);
      player.spawn(f[0], f[1], f[2]);
      cam.pos = [...player.eye];
    },
    endLines: (id) => townTalk?.lines?.(id) ?? null,
    // EndRest's expired arm calls RemoveExpiredRentedRooms as it prints
    // the line (:485) - the SAME sweep the tavern runs before a rental,
    // so a room slept to the last hour is gone by the time the
    // innkeeper is asked again, and its held scene goes with it.
    onRentExpired: () => {
      playerEntity.rentedRooms = removeExpiredRooms(
        playerEntity.rentedRooms ?? [], Math.floor(worldMinutes()), sceneCache());
    },
    // ROAD-B B5 - OnPop's UpdateNpcPresence (DaggerfallRestWindow.cs
    // :277-280). DFU's guard is `IsPlayerInsideBuilding && interior !=
    // null`, which is this host's `interiorBuilding` and `interiorCtx`
    // - and this is the ONLY host that can be inside a building, so it
    // is the only one that owes the dep.
    //
    // The walk is DaggerfallInterior.cs:355-358, and it is
    // `SetActive(true)` and nothing else: no one is removed, and the
    // quest machine is NOT re-run over the people it stands (DFU's
    // AddPeople hands SetupIndividualStaticNPC only to the people its
    // own visibility tail let through, :1224). A shopkeeper who
    // appears because you slept until opening time is a billboard, not
    // a quest individual, in DFU exactly as here.
    updateNpcPresence: () => {
      if (!interiorBuilding || !interiorCtx) return;
      const hour = Math.floor((Math.floor(worldMinutes()) % 1440) / 60);
      if (!updateNpcPresence(interiorBuilding?.buildingType ?? BUILDING_TYPES.None, {
        hour, insideOpenShop: !!interiorBuilding.insideOpenShop,
      })) return;
      for (const pn of interiorCtx.people) pn.host?.setActive(true);
    },
    // PopToHUD, before RaiseSkills can want the slot for a level-up
    // screen. The U24 identity guard: a window that dispatches to
    // another must not be nulled by its OWN onClose.
    onClose: () => { if (interiorOverlay?.isRestWindow) interiorOverlay = null; },
    say,
    onLevelUp: () => {
      say('You have gained a level!');
      // dfuiOpenCharacterSheetWindow (RaiseSkills :1414): the SHEET
      // levels the player in classic. This host builds no windows -
      // host.makeCharSheet is the outer host's own builder, the same
      // one toggleCharSheet mounts.
      if (!interiorOverlay) interiorOverlay = host.makeCharSheet?.() ?? new LevelUpScreen(playerEntity);
    },
    day: () => false, inside: () => true,   // a building interior, always
  });

  const interiorKeyCtx = {
    get uiOverlayActive() { return !!interiorOverlay; },
    // AUDIT 21 (hosts lane, F3): a ChoiceWindow wants the raw CODE and
    // a LevelUpScreen wants up/down and plus/minus. routeKey's overlay
    // branch already makes exactly that choice - raw code for a
    // "native" window, the shared overlayAction map for anything else
    // - so this answers its question and forwards whatever it decided.
    // The interior arm used to re-do the mapping itself, which is the
    // duplication F3 was written about.
    get overlayIsNative() { return !!interiorOverlay?.isChoiceWindow; },
    overlayInput(code, e) {
      const w = interiorOverlay;
      if (!w) return;
      w.input(code, e);
      if (w.done && interiorOverlay === w) interiorOverlay = null;
      // ROAD-B B1: that drain is PopWindow - reconciled in the same
      // event, so a key that closes the top window hands the screen
      // straight back to the one beneath it.
      interiorWindows.reconcile(interiorOverlay);
    },
    // PX26 (Mac: "the north option should be the new journal we
    // developed" / "the skill ui opens on the lefthand side when it
    // should be center"): ONE FIX FOR BOTH. The dial's north was the
    // F5 overlay - the last pre-PX surface, and the one that lays its
    // three columns against the left edge. The pause window's Stats
    // page IS that sheet, off the same sheetModel, and is centred by
    // construction. This host's own pause flow, landed on it.
    openSheetPage() { this.togglePause({ at: 'stats' }); },
    togglePause(opts = {}) {
      if (!pauseDoorReady()) return;
      // IS1: the interior saves like anywhere else - DFU's ONE
      // standing save block is mid-rappel (RappelMotor.cs:66,
      // RegisterPreventSaveCondition's only caller); a building was
      // never one, and the port's gate here was a stopgap for the
      // unbuilt serialization, not a law. The doors are the WORLD
      // host's own composer, riding in on the host bag.
      openPauseFlow((w) => { interiorOverlay = w; }, {
        at: opts.at ?? null,   // PX26: the page the door was pressed for
        // PX25: the sheet's own doors, through this host's own arms.
        openPack: () => mountInterior(interiorInventory()),
        openSpellbook: () => { if (magic) mountInterior(makeSpellbookWindow()); },
        openChronicle: () => mountInterior(host.makeJournal?.('notebook')),
        quickSave: host.quickSave,
        quickLoad: host.quickLoad,
        playerName: host.playerName,
        saveAs: host.saveAs,
        loadKey: host.loadKey,
        // ROAD-C C1: the slot window is PUSHED over the pause window
        // (DaggerfallPauseOptionsWindow.cs:302/:308), not swapped for
        // it - mountInterior is this host's PushWindow.
        pushWindow: mountInterior,
        exitToMenu: exitToTitleMenu,
        textLines: (id) => townTalk?.lines?.(id) ?? null,
        // PX17c: the journal seams the host now carries (world.js) -
        // the PX3 flag paid; a tavern pause shows the developed
        // journal, separators, timers and all.
        questMessages: () => host.pauseQuestMessages?.() ?? [],
        questLog: () => host.pauseQuestLog?.() ?? { active: [], finished: [] },
      });
    },
    /** ROAD-C c2/S9: THE M WINDOW INSIDE A BUILDING, in the same one
     *  overlay slot every other interior window uses. DFU has no scene
     *  gate on the automap at all - GameManager's dispatch is one flat
     *  chain (:509-557) and Automap's own geometry arm covers
     *  IsPlayerInsideBuilding beside IsPlayerInsideDungeon (:1155) - so
     *  the only reason this host had no map was that the arm was
     *  unbuilt. The deps are the dungeon host's, with the three
     *  interior differences DFU itself makes: no micro-map blocks
     *  (:1724-1731), `insideBuilding` true (which selects the cutout
     *  default on reset, forces the always-colour tier and closes the
     *  note/teleporter click arm at window :1871), and the entrance
     *  beacon at the entered door rather than a dungeon start marker. */
    toggleAutomap() {
      if (interiorOverlay || !interiorCtx) return;
      interiorOverlay = new AutomapWindow({
        record: () => interiorCtx.automapRecord(),
        drawList: interiorCtx.drawList, dynamicDraws: interiorCtx.dynamicDraws, texRemap: interiorCtx.texRemap,
        player: () => ({ feet: player.pos, eye: cam.pos, yaw: cam.yaw }),
        startMarker: (() => { const e = interiorCtx.automapEntrance(); return e ? { x: e[0], y: e[1], z: e[2] } : null; })(),
        blocks: null,   // there is no dungeon block grid in a building - the micro-map is null indoors
        arrowMesh: interiorCtx.automapArrow,
        arrowBounds: interiorCtx.automapArrowBounds,
        dungeonName: interiorBuilding?.name ?? 'Interior',
        indexSize: interiorCtx.automapModel.length,
        model: interiorCtx.automapModel,
        insideBuilding: true,   // IsPlayerInsideBuilding (window :587-596, :1871)
      });
    },
    // PX15b: THE DIAL - four arms now that the interior ctx has four
    // doors (ROAD-C c2/S9 gave a building its automap); the rose never
    // draws a dead arm.
    toggleDial() {
      return openPixelDial([
        { id: 'skills', label: 'Skills', dir: 'n', open: () => interiorKeyCtx.openSheetPage() },
        { id: 'items', label: 'Items', dir: 'e', open: () => interiorKeyCtx.toggleInventory() },
        { id: 'magic', label: 'Magic', dir: 'w', open: () => interiorKeyCtx.toggleSpellbook() },
        { id: 'map', label: 'Map', dir: 's', open: () => interiorKeyCtx.toggleAutomap() },
      ]);
    },
    toggleCharSheet() { mountInterior(host.makeCharSheet?.()); },
    // BS1/F198: the Status action's health box (the four-hosts seam).
    showStatus() {
      // ST1: the record-22 chain (DisplayStatusInfo), through the
      // bridge world.js hands down
      const rows = (id) => townTalk?.lines?.(id) ?? [];
      mountInterior(new ActionTextBox(statusInfoRows(rows, questBridge?.machine?.macroContext?.() ?? null))
        .addNext(healthStatusRows(playerEntity, rows)));
    },
    toggleInventory() { mountInterior(interiorInventory()); },
    // M2/I2: the CastSpell action opens the spellbook
    // (GameManager.cs:550-553); the cast itself is the attack click.
    toggleSpellbook() { if (magic) mountInterior(makeSpellbookWindow()); },
    /** TR5: dfuiOpenTransportWindow's INDOORS arm (DaggerfallUI.cs
     *  :691-694) - inside, the key refuses with a HUD line instead of
     *  opening the picker. Both interior modes are inside. */
    openTransport() { townTalk?.say?.(CANNOT_CHANGE_INDOORS); },
    // UI1: the U key indoors. Nothing usable, no window (DaggerfallUI
    // :581-583); the use itself is the host's own inventory use path.
    openUseMagicItem() {
      const win = createUseMagicItemWindow({
        items: playerEntity.items ?? [],
        onUse: (item) => host.useMagicItem?.(item),
      });
      if (win) mountInterior(win);
    },
    toggleLogbook() { mountInterior(host.makeJournal?.('activeQuests')); },
    toggleNotebook() { mountInterior(host.makeJournal?.('notebook')); },
    // IS1: F9/F11 inside a building - the world host's composer
    // (the routeKey table's own arms; quickLoad's setPlayerPos arg is
    // the dungeon context's concern, not this host's, so it drops).
    quickSave() { host.quickSave?.(); },
    quickLoad() { host.quickLoad?.(); },
    // THE REST KEY, INSIDE - the last dead arm of this ctx. U43 routed
    // the Rest action in here and `ctx.toggleRest?.()` (ui/input.js)
    // then optional-chained into nothing, because no host outside
    // dungeonContext had ever built one. That is what the first-hour
    // probe hit: a room rented in Burgley for five gold, and R opening
    // nothing in it.
    //
    // THE OPEN GATE runs here too - DFU raises it from one scene-free
    // handler (DaggerfallUI.cs:651-687). This host mounts no foe pool
    // and has no water, but StartRestGroundedCheck is very much live
    // indoors: a levitating player cannot lie down in a shop any more
    // than in a dungeon.
    //
    // CanRest itself does NOT run here. It runs on the WHILE and
    // HEALED buttons inside the window (:641-690), which is what keeps
    // LOITER free of the camping refusal and the Vagrancy charge -
    // LoiterButton never calls it (:693-706). Gating at open would
    // have made loitering in a city a crime.
    toggleRest() {
      if (interiorOverlay) return;
      const rb = racialRestBlock(playerEntity, Math.floor(interiorTicker.classicMinutes));   // V2b
      const d = restDecision({
        enemiesNearby: interiorEnemiesNearby({ resting: true }),   // IF: rest asks the pool now
        swimming: false,        // nor water
        grounded: startRestGroundedCheck(!!player.grounded, player.pos, interiorCtx?.collider),
        // ROAD-B B5: the gate's third arm has a producer now. ROAD
        // review-p: the PRODUCER, not a poll - :667-669 fetches it
        // inside the third `else`, after the other two arms have
        // returned.
        preventedMessage: getPreventedRestMessage,
        racialOverrideBlocks: !!rb,
      });
      if (d.kind !== 'rest') {
        if (d.kind === 'blocked') {
          const lines = plainLines(townTalk?.lines?.(rb.textId));   // V2b: the unfed vampire's own box
          if (lines) mountInterior(new ActionTextBox(lines));
          return;
        }
        const lines = d.message ? [d.message] : plainLines(townTalk?.lines?.(d.textId));
        if (lines) mountInterior(new ActionTextBox(lines));
        return;
      }
      mountInterior(new RestWindow(interiorRestDeps));
    },
  };

  addEventListener('keydown', (e) => {
    // U47: FIRST, before any early return. F5, F6 and F11 are DFU
    // bindings AND browser gestures, and this host's keydown returns
    // in a dozen places - so a swallow anywhere else is a swallow
    // that some mode skips. Pressing F5 in a building used to reload
    // the page (AUDIT 17e F41); F11 still went fullscreen here.
    swallowBrowserKey(e);
    // U43: an overlay held in the OUTER host's slot owns the keyboard.
    // townTalk draws its overlay above the modal render in every mode
    // (world.js's frame, AUDIT F2-I1), so a window opened out there
    // is live in here - and both hosts register their own listener on
    // the same target with neither stopping propagation, so without
    // this the interior arm answered keys aimed at that window.
    //
    // V4 arrived at the same line from the other end, and its evidence
    // is worth keeping: the first-hour probe's opening screenshot of
    // the starting DUNGEON was the automap, over a 0%-explored
    // Privateer's Hold, on a game one minute old. The classic start
    // runs the chargen wizard with the player already inside, and the
    // character's name was MAC - inputActions binds KeyM to AutoMap.
    // Any letter in a name is a keybinding: R starts a rest, N the
    // notebook, L the logbook, F9 quicksaves a half-made character,
    // and whatever opened was still up when the wizard closed. So the
    // rule covers the DUNGEON arm below as much as the interior one:
    // this return is the only thing standing between a typed name and
    // the bindings. Pinned in test/modalkeys.test.js, red-proofed both
    // ways.
    if (townTalk?.overlayActive) return;
    // U43: THE ONE DISPATCH. GameManager.Update (:509-557) is a single
    // flat chain with no scene gate at all - the window a key opens
    // does not care where the player is standing. The port had three
    // divergent chains, and the interior one answered exactly two
    // actions: F5, F6, L, N and R all died the moment you stepped
    // through a shop door. This routes the same ui/input.js table the
    // dungeon arm has always used, over an interior ctx.
    if (mode === 'interior') {
      if (routeKey(e, interiorKeyCtx)) e.preventDefault();
      return;
    }
    // The input map (ui/input.js) owns all bindings.
    if (mode !== 'dungeon' || !dungeonCtx) return;
    if (routeKey(e, dungeonCtx, (p) => player.spawn(p[0], p[1], p[2]))) e.preventDefault();   // P14 (AUDIT 23): a load clears motion state, same applier as dungeon.js
  });

  // U8c: pointer routing for interior native windows (the townTalk
  // shape) - hosts call this before requestLook.
  function pointerdown(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    // AUDIT 17j F6 / THE FOUR HOSTS RULE: this gated on interior mode
    // alone, so the DUNGEON overlay seam U14 added to dungeonContext
    // reached exactly one of the two hosts that mount a dungeon
    // context. dungeon.js wired it; worldModes DRAWS the same overlay
    // (the uiOverlayActive branch of its dungeon frame) and could not
    // click it. Latent rather than live today - chargen is the only
    // overlay with a clickNative, and it runs at boot where this host
    // already has a player - but a seam one host cannot reach is the
    // shape that has bitten this flow four times.
    if (mode === 'dungeon' && dungeonCtx?.uiOverlayActive) {
      const vd = pointToNative(nativeMetrics(canvas), px, py);
      // ROAD-C c2/S4: the pointer seam first and always (the automap
      // chrome is press-HOLD and drag driven), then the click seam.
      // c2/S8: the DOWN route carries the modifiers with it - DFU's
      // double-click and debug-teleport handlers poll Input.GetKey at
      // the click, and this seam is the port's only reader of that.
      if (vd) dungeonCtx.overlayPointer?.('down', vd[0], vd[1], e.button, { ctrl: !!e.ctrlKey, shift: !!e.shiftKey });
      if (vd) dungeonCtx.overlayClick?.(vd[0], vd[1], e.button === 2);
      return true;   // an open window withholds the pointer lock, as in dungeon.js
    }
    // The guard is on the WINDOW, not on its click method: an open
    // window with no click handler must still withhold the pointer
    // (DFU's top window consumes the click), or a pointerdown escapes
    // to requestLook and grabs pointer lock from under the menu.
    // U45: the large HUD's panels, in BOTH of this host's modes and
    // before either falls through to the world. Each mode's ctx is the
    // one U43's dispatch already built - dungeonCtx below ground,
    // interiorKeyCtx inside a building - so a panel and a key reach
    // the same door here too, and there is no third object.
    // ...but ONLY in a mode this host actually draws. `mode` starts
    // at 'exterior' and the outer host calls this before its own
    // routeLargeHudClick, so without the gate every panel click above
    // ground reached interiorKeyCtx and mounted a window into
    // `interiorOverlay` - a slot the frame never draws and the
    // keydown arm (`if (mode === 'interior')`) never feeds. The
    // orphan then sat there until the player walked through a door.
    // Harmless-looking before S40 only because interiorKeyCtx had no
    // toggleRest and routeAction's `?.()` no-opped; the S40 review
    // found it the moment it did.
    if (mode === 'dungeon' || mode === 'interior') {
      if (routeLargeHudClick(px, py, e.button,
        mode === 'dungeon' ? dungeonCtx : interiorKeyCtx,
        { windowUp: mode === 'dungeon' ? !!dungeonCtx?.uiOverlayActive : !!interiorOverlay })) return true;
    }
    if (mode !== 'interior' || !interiorOverlay) return false;
    const v = pointToNative(nativeMetrics(canvas), px, py);
    // ROAD-C c2/S9: THE POINTER SEAM REACHES THE INTERIOR SLOT TOO. The
    // automap chrome is press-HOLD and drag driven, and c2/S9 puts that
    // window in THIS slot - so a host that delivered only `click` here
    // would give a building's map buttons that never repeat and a pan
    // drag that never starts. Down/move/up are all three or none (the
    // c2/S4 rule, and the reason its pin counts routes per host).
    if (v) interiorOverlay.pointer?.('down', v[0], v[1], e.button, { ctrl: !!e.ctrlKey, shift: !!e.shiftKey });
    if (v) interiorOverlay.click?.(v[0], v[1], e.button === 2);   // I4: the remove gesture rides the button
    if (interiorOverlay?.done) interiorOverlay = null;
    interiorWindows.reconcile(interiorOverlay);   // ROAD-B B1: the click's drain is PopWindow too
    return true;
  }

  /** ROAD-C c2/S4: the other TWO THIRDS of the pointer seam. THE FOUR
   *  HOSTS RULE again, and this time with teeth: a host that routes
   *  `down` but not `up` latches an automap drag that spins the map
   *  forever and nothing errors. These are exported beside
   *  `pointerdown` so world.js and exterior.js - which own the DOM
   *  listeners for this host - deliver all three phases or none. */
  function pointerNative(e) {
    const r = canvas.getBoundingClientRect();
    return pointToNative(nativeMetrics(canvas),
      (e.clientX - r.left) * (canvas.width / r.width),
      (e.clientY - r.top) * (canvas.height / r.height));
  }
  function pointermove(e) {
    if (mode === 'interior' && interiorOverlay) {
      const vi = pointerNative(e);
      if (vi) interiorOverlay.pointer?.('move', vi[0], vi[1], 0);
      return true;
    }
    if (mode !== 'dungeon' || !dungeonCtx?.uiOverlayActive) return false;
    const v = pointerNative(e);
    if (v) dungeonCtx.overlayPointer?.('move', v[0], v[1], 0);
    return true;
  }
  function pointerup(e) {
    // ROAD-C c2/S9: the release, in BOTH modes. A move without an up is
    // the defect this seam exists to make impossible - the drag latches
    // and the map spins for ever - so the interior arm lands in the
    // same three functions, not in a fourth one.
    if (mode === 'interior' && interiorOverlay) {
      const vi = pointerNative(e);
      interiorOverlay.pointer?.('up', vi ? vi[0] : -1, vi ? vi[1] : -1, e.button);
      return true;
    }
    if (mode !== 'dungeon' || !dungeonCtx?.uiOverlayActive) return false;
    const v = pointerNative(e);
    dungeonCtx.overlayPointer?.('up', v ? v[0] : -1, v ? v[1] : -1, e.button);
    return true;
  }

  /** The wheel seam (U-scroll), the pointerdown shape: an open
   *  mode-owned window owns the wheel. */
  function wheel(e) {
    if (mode === 'dungeon' && dungeonCtx?.uiOverlayActive) {
      dungeonCtx.overlayWheel?.(Math.sign(e.deltaY));
      return true;
    }
    if (mode !== 'interior' || !interiorOverlay) return false;
    interiorOverlay.wheel?.(Math.sign(e.deltaY));
    return true;
  }

  /** U37: THE HOVER SEAM, the wheel seam's shape - both mode-owned
   *  windows and the mounted dungeon context's. */
  function hover(e) {
    trackHudPointer(canvas, e);   // U46: the spell-icon rows' tooltip, in BOTH modes
    trackLargeHudPointer(canvas, e);   // ROAD-Ar: HUDLarge's MouseEnter/MouseLeave (:361-372), for the activate gate's HUD guard
    const at = () => {
      const r = canvas.getBoundingClientRect();
      return pointToNative(nativeMetrics(canvas),
        (e.clientX - r.left) * (canvas.width / r.width),
        (e.clientY - r.top) * (canvas.height / r.height));
    };
    if (mode === 'dungeon' && dungeonCtx?.uiOverlayActive) {
      const v = at();
      dungeonCtx.overlayHover?.(v ? v[0] : -1, v ? v[1] : -1, e);   // ROAD-A7: e.buttons drives the scroll-bar drag
      return true;
    }
    if (mode !== 'interior' || !interiorOverlay?.hover) return false;
    const v = at();
    interiorOverlay.hover(v ? v[0] : -1, v ? v[1] : -1, e);   // ROAD-A7: e.buttons drives the scroll-bar drag
    return true;
  }

  return {
    get mode() { return mode; },
    get dungeonLocation() { return dungeonLoc; },   // B2: playerInside's dungeon arm
    /** X7: the Identify SPELL's window (Identify.cs:71-76 pushes the
     *  trade window itself). The spell can be cast anywhere, but the
     *  window lives here with the rest of the interior overlay stack,
     *  so the world host routes its onIdentify seam through this -
     *  the same direction its onTeleport already runs.
     *
     *  Answers false when the window cannot open (no art, or an
     *  overlay already holds the slot), so the caller can say so
     *  rather than silently swallowing the cast. */
    /** X10: the DISPEL MAGIC picker. DFU pushes a
     *  DaggerfallListPickerWindow listing the player's live bundles by
     *  name; picking one removes it, and cancelling wastes the cast.
     *  The port's ListPickerWindow is the same widget the guild flows
     *  and the item maker already use. */
    openDispelPicker({ chance } = {}) {
      if (!listPickerArtLoaded()) return false;
      const bundles = dispellableBundles(liveBundles(playerEntity));
      if (!bundles.length) { townTalk?.say?.('You have no magic to dispel.'); return true; }
      let win = null;
      win = new ListPickerWindow({
        items: bundles.map((b) => b.name || '(unnamed)'),
        onPick: (i) => {
          const b = bundles[i];
          if (b) {
            const r = dispelBundle(playerEntity, b.bundleId, {
              // The one asymmetry: the player's OWN casts always come
              // off; only something cast AT them gets a roll.
              selfCast: b.bundleType === 'Spell' && b.selfCast !== false,
              roll01: Math.random(), chance,
            });
            if (r.alert) townTalk?.say?.(DISPEL_MAGIC_TEXT[r.alert]);
          }
          closeSpellWindow(win);
        },
        onCancel: () => closeSpellWindow(win),
      });
      return mountSpellWindow(win);
    },
    /** X11b, AND A BUG IT FOUND. A SPELL WINDOW has to land in the
     *  slot the CURRENT mode actually draws, and the three openers
     *  below all wrote straight into `interiorOverlay` - which this
     *  host draws in INTERIOR mode only (the frame returns at
     *  `mode === 'exterior'` before any of it, and the dungeon branch
     *  draws dungeonCtx's slot instead). So Identify and Dispel Magic,
     *  cast outdoors or in a dungeon through the world host, mounted a
     *  window nothing ever drew: `overlayHeld` did not even see it
     *  (`mode === 'interior' && !!interiorOverlay`), so the game did
     *  not pause, the player got no picker, and the magicka was gone.
     *  Both spells can be cast anywhere, which is the whole point of
     *  carrying them.
     *
     *  One slot-picker for all three, per mode:
     *    interior -> interiorOverlay (this host draws it)
     *    dungeon  -> dungeonCtx.showOverlay (that context draws its own)
     *    exterior -> townTalk.showOverlay (the outer host's slot, which
     *                is the one it draws and holds above ground)
     *  Answers false when no slot is free, so the caller can say so. */
    /** X11b: THE CREATE ITEM PICKER. DFU's CreateItem constructs a
     *  DaggerfallListPickerWindow in its own ctor, fills it with the
     *  29 CreateItemSelection rows, sets AllowCancel FALSE and selects
     *  the STATIC lastSelectedIndex, then pushes it from Start
     *  (:64-77, :96-110). The picker is the whole effect.
     *
     *  lastSelectedIndex lives at module scope in this host for the
     *  same reason it is static in DFU: it survives between casts. */
    openCreateItemPicker({ rounds } = {}) {
      if (!listPickerArtLoaded()) return false;
      let win = null;
      win = new ListPickerWindow({
        items: createItemLabels(),
        allowCancel: false,           // CreateItem.cs:70 - the magicka is already spent
        selectedIndex: lastCreateItemIndex(),
        onPick: (i) => {
          setLastCreateItemIndex(i);   // the static, updated in ItemPicker_OnItemPicked (:113)
          const made = grantCreatedItem(playerEntity, i, {
            gender: playerEntity.gender ?? 'male',
            nowMinutes: Math.floor(worldMinutes()),
            rounds: rounds ?? 0,
          });
          if (made) townTalk?.say?.(`${made.name}${made.stackCount > 1 ? ` (${made.stackCount})` : ''} conjured.`);
          closeSpellWindow(win);
        },
        onCancel: () => closeSpellWindow(win),   // only reachable when the art is missing
      });
      return mountSpellWindow(win);
    },
    /** X11c CLOSES X11b's ROUTED HALF. Identify can be cast anywhere,
     *  and until now it mounted its window into `interiorOverlay` -
     *  which this host draws in INTERIOR mode only. Outdoors or in a
     *  dungeon the window was never drawn, ticked or clicked, did not
     *  register as overlayHeld, and the magicka was gone. X11b stopped
     *  the loss by REFUSING outside the interior; this opens it
     *  properly, in whatever slot the current mode actually draws.
     *
     *  What made it a separate lane was the latch: the per-cast
     *  { chance, cost } lived in MODULE state and died in four
     *  different `interiorOverlay?.done` drains. It lives on the
     *  window's own commit closure now, so its lifetime is the
     *  window's and no slot has to remember it. */
    openIdentifyWindow({ chance, refund } = {}) {
      if (!tradeArtLoaded()) return false;
      // The magicka the window will charge on the Identify click IS
      // the cost the effect just refunded (Identify.cs:74's
      // IdentifySpellCost = cost.spellPointCost) - the refund and the
      // charge are the same number, which is what makes the round trip
      // free when the player closes the window without identifying.
      const win = openTradeWindow({ items: [] }, interiorBuilding ?? {}, 'Identify',
        { identifySpell: { chance: chance ?? 0, cost: refund ?? 0 } });
      win.hooks.usingIdentifySpell = true;
      return mountSpellWindow(win);
    },
    startInDungeon,
    /** B1: CreateFoe's TryPlacement, this host's two INSIDE arms
     *  (CreateFoe.cs:194-211); false = retry next machine tick,
     *  verbatim.
     *
     *  IF: BOTH arms are live now, and they are the SAME LAW - DFU's
     *  PlaceFoeBuildingInterior (:220-234) does not use interior spawn
     *  points at all, it calls PlaceFoeFreely with the interior as
     *  parent, and says why in its own comment: "Spawn points work
     *  well for 'interior hunt' quests but less so for 'directly
     *  attack the player'. Feel just placing freely will yield best
     *  results overall." So the interior arm differs from the dungeon
     *  arm in exactly one term, the collider it probes. */
    /** MT-iv: the INSIDE pool's half of DFU's one
     *  ActiveGameObjectDatabase (ChangeFoeInfighting.cs:59 /
     *  ChangeFoeTeam.cs:77 walk it globally). world.js unions this
     *  into questFoeInstances, so `change foe X team 1` finally
     *  reaches a quest foe standing in a dungeon - before this the
     *  action never found an instance, and since SetComplete sits
     *  inside the instance walk it re-ran every machine tick for
     *  ever. The INTERIOR arm stays empty: that host has no enemy
     *  pool (the Q4-v flag above). */
    liveQuestFoes() {
      if (mode !== 'dungeon' || !dungeonCtx) return [];
      return dungeonCtx.foes.filter((f) => !f.dead && f.questBehaviour);
    },
    /** ROAD-B: PlayerEntity.SpawnCityGuards' INDOOR arm
     *  (:628-642). Answers TRUE when it took the call, which is what
     *  DFU's unconditional `return` at :641 means - a crime committed
     *  in an open shop, a tavern or a residence is answered by that
     *  building's own front door and the street arm never runs. Every
     *  other case (outdoors, or inside a temple / guild hall / palace)
     *  answers false and falls through to the exterior host's pool,
     *  which is exactly the fall-through C# makes.
     *
     *  The three flags are PlayerEnterExit's, all latched at the door
     *  (PlayerActivate.cs:1120-1122): IsPlayerInsideOpenShop rides the
     *  building record (AUDIT 26 F066 put it there), and Tavern and
     *  Residence are the bare RMBLayout type predicates. */
    spawnCityGuardsInside(immediate) {
      if (mode !== 'interior' || !interiorCtx || !interiorGuards) return false;
      const b = interiorBuilding;
      const eligible = !!b && (!!b.insideOpenShop
        || b.buildingType === BUILDING_TYPES.Tavern   // RMBLayout.IsTavern (:803)
        || isResidence(b.buildingType));              // RMBLayout.IsResidence
      if (!eligible) return false;
      interiorGuards.spawnCityGuards(!!immediate, {
        playerFeet: [...player.pos],
        playerFwd: [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)],
        pool: [],   // there is no street population in here to convert
        interior: { doors: interiorCtx.doors, origin: interiorCtx.parentPt(0, 0, 0), eligible: true },
      }).catch((e) => console.error('[guards]', e));
      return true;
    },
    /** ROAD-B: the INSIDE half of ActiveGameObjectDatabase's enemy
     *  join - every live enemy standing in whichever interior the
     *  player is in, quest-spawned or not. `liveQuestFoes` above is
     *  the same walk narrowed to QuestResourceBehaviour carriers,
     *  which is what its one caller (questFoeInstances) asks;
     *  GameManager.MakeEnemiesHostile asks the unnarrowed question,
     *  and both interiors carry a real pool - the interior one since
     *  IF gave buildings enemies. Outdoors both are empty and the
     *  world host's own two pools are the whole database. */
    insideFoes() {
      if (mode === 'dungeon' && dungeonCtx) return dungeonCtx.foes.filter((f) => !f.dead);
      // ROAD-B: a building holds TWO pools - the encounter/quest foes
      // and the watch that can be called in through its front door.
      if (mode === 'interior') {
        return [...(interiorFoes?.foes ?? []), ...(interiorGuards?.guards ?? [])].filter((f) => !f.dead);
      }
      return [];
    },
    tryPlaceQuestFoe(handle) {
      if (mode === 'interior') return tryPlaceInteriorQuestFoe(handle);
      if (mode !== 'dungeon' || !dungeonCtx) return false;
      const feet = player.pos;
      // origin lifted to the controller centre - DFU casts from
      // PlayerObject.transform.position, not the feet
      const env = placeFoeEnv({
        collider: dungeonCtx.collider,
        playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
        playerYawRad: cam.yaw,
        // MERGE (the S-A lane's catch): fieldOfView() answers RADIANS
        // and the law speaks DEGREES (MainCamera.fieldOfView) - raw,
        // the direction angle was ~1 degree and every foe placed dead
        // ahead INSIDE the view instead of just outside the cone.
        fovDegrees: fieldOfView() * 180 / Math.PI,
        isOccupied: entityOccupancy((f) => f.ai?.feet, () => dungeonCtx.foes, feet),
      });
      const spot = placeFoeFreely(env);
      if (!spot) return false;
      const foe = handle.foe;
      // FinalizeFoe (CreateFoe.cs:341-359): a walker aligns back onto
      // the floor it found (the pool's own landing does that); a
      // FLYING foe is lifted 1.5 from the test point instead - and
      // only Flying, not Spectral (FinalizeFoe reads the one flag).
      const _fly = (ENEMY_BASICS[foe.foeType]?.behaviour ?? 'General') === 'Flying';
      dungeonCtx.spawnQuestFoe({
        mobileType: foe.foeType, gender: questFoeGender(foe),
        position: [spot.x, _fly ? spot.y + 1.5 : spot.y, spot.z],
        yawRad: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player (CreateFoe.cs:328)
        behaviour: handle.behaviour,
      }).catch((e) => console.error('[quest] dungeon foe stand failed:', e?.message ?? e));
      return true;
    },
    /** B1: GameManager.RaiseOnEncounterEvent's one core consumer is
     *  the rest window's AbortRestForEnemySpawn - the machine raises
     *  it per pending CreateFoe tick and this routes it to the live
     *  rest overlay. S40: in DFU the subscription is on the WINDOW
     *  (OnPush at :264, OnPop at :275), not on a scene, so it follows
     *  the window into whichever slot holds it - the parenthetical
     *  that stood here saying dungeon mode is the only mode with a
     *  rest window was true until this slice and is not now. */
    raiseOnEncounterEvent() {
      if (mode === 'dungeon') { dungeonCtx?.abortRestForEnemySpawn?.(); return; }
      if (interiorOverlay?.isRestWindow) { interiorOverlay.abortForEnemySpawn?.(); return; }
      // ...and the OUTER host's slot, which is where an outdoor rest
      // window lives (townTalk's). The first S40 pass routed the two
      // slots this module owns and wrote a comment saying the
      // subscription follows the window - which was only two thirds
      // true, and outdoors is exactly where a quest CreateFoe wave
      // lands next to a sleeping player.
      host.abortRestForEnemySpawn?.();
    },
    /** B3: TeleportPc's marker landing (:120-135) - the marker's
     *  scene position in whichever frame the mounted mode speaks
     *  (markerScenePosition already spans dungeon blocks; the
     *  interior parents exactly as its own flats are). */
    setPlayerScenePosition(p) {
      if (mode === 'interior' && interiorCtx) {
        const [x, y, z] = interiorCtx.parentPt(p.x, p.y, p.z);
        player.spawn(x, y, z);
      } else {
        player.spawn(p.x, p.y, p.z);
      }
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
    },
    /** A10: RestorePosition's inside arm - `transform.position = the
     *  saved value`, RAW. Distinct from setPlayerScenePosition above,
     *  which parents a MARKER's block-local point into the mounted
     *  frame: a Recall anchor was taken from `player.pos`, so it is
     *  already in that frame and parenting it a second time would
     *  land the player one building offset away from where they set
     *  it. Same distinction the interior save half draws (IS1's
     *  `restore.pos` lands raw over the door landing). */
    setPlayerLocalPosition(p) {
      player.spawn(p[0], p[1], p[2]);
      cam.pos = player.eyeAt();   // EV1: the interpolated render eye
    },
    /** TP-slice: the Teleport effect leaves ANY mode - the exit
     *  cores of the door flows minus the landing (the caller owns
     *  the spawn; DFU's cross-scene arm transitions immediately,
     *  TransitionDungeonExteriorImmediate at Teleport.cs:151). */
    /** The anchor-recall door out of any mode. AUDIT 24 (the
     *  seven-slice sweep): it used to destroy the interior context
     *  RAW - no teardownQuestFlats, no bridge notification - where
     *  tryExit does both, and its comment says why: the stands must
     *  leave the context's batch list FIRST "so ctx.destroy() cannot
     *  free them a second time". Skipping it left questFlats holding
     *  live-looking entries (`dead` false, `batch` set) over batches
     *  the context had already freed, so the NEXT building's teardown
     *  double-freed them - and every quest behaviour missed its
     *  OnDestroy, so the resource side never decoupled. */
    forceExitToExterior({ cacheScene = true } = {}) {
      const wasInside = mode !== 'exterior';
      if (interiorCtx) {
        // Teleport.cs:145-148, "Cache scene before departing": inside a
        // building that is CacheScene(playerEnterExit.Interior.name) -
        // the same write the real door makes (PlayerEnterExit.cs:860,
        // tryExit's :2434). Without it a recall out of a shop discarded
        // everything done inside and the next visit restored the stale
        // pre-entry cache. (The dungeon arm has no counterpart: DFU
        // takes TransitionDungeonExteriorImmediate there, :151.)
        // IS1: the LOAD path alone passes cacheScene false - by then
        // the entity's cache is the SAVE's own (restorePlayer ran),
        // and DFU's load deregisters the dying scene rather than
        // serializing it (RespawnPlayer :464).
        if (cacheScene) cacheInteriorScene();
        // OnPop runs on every window the manager removes
        // (UserInterfaceManager.cs:189-196). A door that drops the slot
        // RAW skips it, and RestWindow raises IsResting on open and
        // clears it in OnPop alone - so a quest teleport taken mid-rest
        // left the player permanently "resting": no per-minute fatigue
        // drain and held enchantments eating their items 15x.
        //
        // ROAD-B B1: and now EVERY window on the stack, not just the
        // top one - the door that mounts (mountInterior) pushes rather
        // than replacing, so a suspended rest under a message box is a
        // real thing to drop. The clear() below carries the dispose.
        teardownQuestFlats();
        interiorCtx.destroy();
        interiorFoes?.destroy?.();
        interiorFoes = null;
        interiorGuards?.clearLive?.();   // ROAD-B: same teardown, the quest-teleport / load arm
        interiorGuards = null;
        interiorDropped.restorePiles(null);   // ID1: same teardown, the quest-teleport / load arm
        interiorHitEffects.clear();   // HE1: the same
        // ...and the OnPop the comment above is about, on every window
        // the stack holds (ROAD-B B1).
        interiorWindows.reconcile(interiorOverlay);
        interiorWindows.clear((w) => w.dispose?.());
        interiorCtx = null; interiorBuilding = null; interiorOverlay = null; exteriorDoor = null;
        _insideTavern = false;   // ROAD-B B4: PlayerEnterExit.cs:874, the same latch on the teleport/load arm
      }
      if (dungeonCtx) {
        teardownDungeonQuestFlats();
        dungeonCtx.overlayWindow?.()?.dispose?.();   // the same OnPop, for the dungeon context's own slot
        dungeonCtx.destroy(); dungeonCtx = null; dungeonLoc = null;
      }
      player.collider = baseCollider();
      mode = 'exterior';
      if (wasInside) questBridge?.onExteriorTransition();   // CreateFoe's pending-wave invalidation, as both real doors do
    },
    // M2: the cast engine's mode-aware raycast reads the INTERIOR's
    // collider while a building is mounted.
    get interiorCollider() { return interiorCtx?.collider ?? null; },
    /** AUDIT 19 / 1:1: what THIS host contributes to the music context.
     *  The outer host owns the clock, the weather and the location; the
     *  mode host owns whether the player is inside, in a dungeon, and
     *  which building. DFU reads all of it off PlayerEnterExit in one
     *  place; here it is split across two, so each reports its own half
     *  rather than either guessing the other's. */
    musicContext() {
      if (mode === 'dungeon') {
        return {
          inside: true,
          insideDungeon: true,
          // AUDIT 21 (music lane, F3): IsPlayerInsideDungeonCastle, LIVE.
          // The flag that stood here said "no castle-block detection yet" -
          // rdbLayout has computed castleBlock verbatim on every block all
          // along, and five real castle blocks are already pinned in the
          // archive. MUSIC_ENV.Castle was unreachable and CASTLE_SONGS a dead
          // constant: the non-hostile wing of Castle Daggerfall played a
          // random dungeon track instead of GPALAC.
          insideDungeonCastle: dungeonCtx?.inCastle ?? false,
          dungeonKey: dungeonCtx?.musicSeed ?? null,
        };
      }
      if (mode === 'interior') {
        return {
          inside: true,
          buildingType: interiorBuilding?.buildingType ?? -1,
          factionId: interiorBuilding?.factionId ?? 0,
        };
      }
      return null;                       // exterior: the host's own context stands
    },
    pointerdown,
    pointermove,   // ROAD-C c2/S4 - all three phases, or the drag latches
    pointerup,
    hover,
    wheel,
    /** A mode-owned window is up (the hosts' look gate reads this
     *  alongside townTalk.overlayActive). */
    // ROAD-B B1: `|| depth` because this getter is read from the outer
    // hosts' EVENT handlers, which run between frames - a window that
    // closed itself since the last reconcile leaves the slot empty with
    // another still suspended under it, and answering "no window" for
    // those few milliseconds would free the cursor and re-grab pointer
    // lock under the window that is about to be painted again.
    get overlayHeld() { return (mode === 'interior' && (!!interiorOverlay || interiorWindows.depth() > 0)) || (mode === 'dungeon' && !!dungeonCtx?.uiOverlayActive); },
    get transitioning() { return transitioning; },
    /** ROAD-B B4: PlayerEnterExit.IsPlayerInsideDungeonCastle (:136-139),
     *  which GameManager.IsPlayerInsideCastle (GameManager.cs:420-423) is
     *  a bare pass-through of. The flag is written in exactly one place -
     *  PlayerEnterExit.Update :338 `isPlayerInsideDungeonCastle =
     *  playerDungeonBlockData.CastleBlock` - and cleared with the dungeon
     *  (:344 off-block, :488 and :1194 on the exterior transition), so it
     *  is per-BLOCK and it is false everywhere outside a dungeon. That is
     *  the whole law: there is no building-side castle check anywhere in
     *  DFU (a palace INTERIOR reaches TalkManager through buildingType
     *  Palace, not through this flag).
     *
     *  The mode host is where the two halves meet - the dungeon context
     *  answers which block the player stands in, the mode answers whether
     *  a dungeon stands at all - so it publishes the flag once and the
     *  world host's talk/quest mounts read it instead of hardcoding false. */
    get insideDungeonCastle() { return mode === 'dungeon' ? (dungeonCtx?.inCastle ?? false) : false; },
    /** ROAD-B B4: PlayerEnterExit.IsPlayerInsideTavern (:162-164) and
     *  IsPlayerInsideResidence (:168-170), latched at the door by
     *  PlayerActivate.TransitionInterior (:1121-1122). Published raw -
     *  the consumer (SpawnCityGuards, PlayerEntity.cs:628-641) ANDs them
     *  with IsPlayerInside itself, and the residence latch outlives its
     *  interior by DFU's own omission, so a getter that quietly folded
     *  in `mode === 'interior'` would not be the flag. */
    get insideTavern() { return _insideTavern; },
    get insideResidence() { return _insideResidence; },
    /** PlayerEnterExit.IsPlayerInsideOpenShop (:152-157), the third of
     *  the trio - already latched onto the building record at AUDIT 26
     *  F066; published here so the guard gate can read all three the way
     *  PlayerEntity.cs:630 does. */
    get insideOpenShop() { return !!interiorBuilding?.insideOpenShop; },
    get interiorCtx() { return interiorCtx; },
    get dungeonCtx() { return dungeonCtx; },
    // Q4-v: the world seam's playerInside half + the machine's
    // hot-place callback (deps.world.mountCurrentSiteQuestResources).
    get interiorBuilding() { return interiorBuilding; },
    mountQuestResources,
    /** Q4-v: a quest parchment box lands in the interior overlay slot
     *  while a building is mounted (the host routes exterior popups to
     *  its own overlay). */
    /** U43-ii: the quest machine's popup, in EVERY modal mode. The
     *  dungeon arm was missing, so world.js's showQuestBox fell
     *  through to a console.warn - and the CLASSIC START runs
     *  _TUTOR__ and _BRISIEN inside Privateer's Hold, which meant the
     *  first ten minutes of a new game were silent. The dungeon
     *  context has had an overlay slot since U14; nothing exported a
     *  way in. */
    showQuestOverlay(win) {
      // Through mountInterior, which is PushWindow (ROAD-B B1). A quest
      // popup is the one thing that can take the slot from a running
      // rest - the rest sub-tick calls QuestMachine.Tick, which is
      // exactly what DFU's second `TopWindow != this` check (:397-400)
      // exists for - and it is now the two-deep case it is in DFU: the
      // box goes ON TOP, the rest stops advancing because it is no
      // longer the top window, and closing the box hands the rest back
      // its slot, its hours and its IsResting.
      if (mode === 'interior') { mountInterior(win); return true; }
      if (mode === 'dungeon' && dungeonCtx?.showOverlay) return dungeonCtx.showOverlay(win);
      return false;
    },
    /** RW1: GivePc's reward container in the MODE that owns the
     *  ground. GivePc mints through the SAME CreateDroppedLootContainer
     *  the inventory's drop does (GivePc.cs:168), so it picks its
     *  parent by the same context - and ID1 gave this host the
     *  interior arm it was missing. The dungeon mints through its own
     *  pool and answers the open thunk; the interior mints through
     *  ITS pool now; exterior alone falls through to the world host. */
    mintRewardPile(dfItem) {
      if (mode === 'dungeon' && dungeonCtx?.offerRewardLoot) return dungeonCtx.offerRewardLoot(dfItem);
      if (mode === 'interior' && interiorCtx) {
        // The world host's own shape, on this host's ground: the mint
        // is INSIDE the thunk so a reward offered behind a quest box
        // lands where the player is standing when the box closes, not
        // where they stood when it opened.
        return () => {
          const pile = interiorDropped.dropPile([dfItem], interiorDropFeet());
          if (!pile) return;
          mountInterior(interiorInventory({ loot: { items: () => pile.items } }));
        };
      }
      return undefined;   // not this mode's ground - the world host mints
    },
    // wave 21: the host asks whether the box it pushed is still the
    // one in the slot before it stacks another onto it
    get questOverlay() {
      if (mode === 'interior') return interiorOverlay;
      return mode === 'dungeon' ? (dungeonCtx?.overlayWindow?.() ?? null) : null;
    },
    /** IS1 - the inside-building save half (SerializablePlayer
     *  .cs:183-187): the entered exterior door's identity + the
     *  building discovery record (its insideOpenShop latch riding on
     *  it, F066's field), with the LIVE scene written into the
     *  entity's P1 cache first so the envelope's sceneCache carries
     *  what the shelves and containers hold right now - the port's
     *  shape of DFU serializing the live interior objects into the
     *  save. Null anywhere but interior mode. */
    interiorSaveData() {
      if (mode !== 'interior' || !exteriorDoor) return null;
      cacheInteriorScene();
      return interiorIdentity();
    },
    /** A10: the SAME two fields, with NO scene write. SetAnchor
     *  (Teleport.cs:107-112) reads ExteriorDoors and
     *  BuildingDiscoveryData and nothing else - it is not a save, it
     *  is a bookmark, and caching the live scene at the moment you
     *  drop one would hand the next real exit a stale entry to
     *  restore. Null anywhere but interior mode. */
    interiorAnchorData() {
      return mode === 'interior' && exteriorDoor ? interiorIdentity() : null;
    },
    /** A10 - SetAnchor's inside half (Teleport.cs:100-117), whichever
     *  mode is mounted. The OUTER host owns the exterior arm and the
     *  world coordinates; this answers the two things only the mounted
     *  mode knows - which context the player stands in, and where they
     *  stand inside it (the scene-local transform RestorePosition
     *  writes back raw on the way home).
     *
     *  A DUNGEON's local frame is ITS OWN and never moves, so `local`
     *  is the whole landing there. A BUILDING's is the exterior's
     *  (P8's unified frame), which the floating origin shifts under
     *  the player - so an interior anchor carries NO local position
     *  and lands off its native world coordinates like every other
     *  above-ground record in this port. Storing the live `player.pos`
     *  there would land the player wherever the origin happened to be
     *  at anchor time. */
    anchorContext() {
      if (mode === 'interior') {
        return {
          worldContext: WORLD_CONTEXT.Interior,
          local: null,
          buildingKey: interiorBuilding?.buildingKey ?? 0,
          interior: interiorIdentity(),
        };
      }
      if (mode === 'dungeon') {
        return { worldContext: WORLD_CONTEXT.Dungeon, local: [...player.pos], buildingKey: 0, interior: null };
      }
      return { worldContext: WORLD_CONTEXT.Exterior, local: null, buildingKey: 0, interior: null };
    },
    /** A10: PlayerEnterExit's two live flags (IsPlayerInsideBuilding /
     *  IsPlayerInsideDungeon), which IsSameInterior asks for by name
     *  (:193, :197, :209). The outer host holds the map pixel. */
    insideContext() {
      return {
        insideBuilding: mode === 'interior',
        insideDungeon: mode === 'dungeon',
        buildingKey: mode === 'interior' ? (interiorBuilding?.buildingKey ?? 0) : 0,
      };
    },
    /** IS1 - the load re-entry (the Respawner's building arm,
     *  PlayerEnterExit.cs:559-567 -> StartBuildingInterior off
     *  exteriorDoors[0]): find the saved door among the LIVE
     *  exterior's targets by its (blockIndex, recordIndex, doorIndex)
     *  identity - buildingKey disambiguating twin blocks in one
     *  location - and run the ONE transition core with the saved
     *  discovery record and position. False when the door cannot be
     *  found or the entry fails; the no-door reposition arm
     *  (RestorePositionHelper :615-621) belongs to the caller. */
    async restoreInterior(saved, pos = null) {
      const d = saved?.door;
      if (!d || mode !== 'exterior') return false;
      const entries = doorTargets();
      const matches = entries.filter((e) =>
        e.door.blockIndex === d.blockIndex
        && e.door.recordIndex === d.recordIndex
        && e.door.doorIndex === d.doorIndex);
      const entry = (matches.length > 1 && d.buildingKey
        ? matches.find((e) => (buildingDataForDoor?.(e)?.buildingKey ?? 0) === d.buildingKey)
        : null) ?? matches[0] ?? null;
      if (!entry) return false;
      try {
        await enterInteriorCore(entry, entries, { building: saved.building ?? null, pos });
      } catch (e) {
        console.error('[worldModes] restoreInterior failed:', e);
        return false;
      }
      return mode === 'interior';
    },
    tryEnter,
    attemptExteriorDoorBash,   // ROAD-B: WeaponEnvDamage's static-door arm (PlayerActivate.cs:1056-1079)
    frame,
    installShotProbes,
  };
}
