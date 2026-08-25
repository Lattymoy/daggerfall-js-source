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

import { doorWorldAabb, doorWorldPosition, doorWorldNormal, interiorLanding, exteriorLanding, dungeonEntranceLanding, climbLadder, floorLanding } from '../player/enterExit.js';
import { startRestGroundedCheck } from '../player/motor.js';   // S40: the rest gate's grounded input
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { pickActivatable, worldAabb, activationTargets } from '../player/activate.js';
import { transferAll, removeOne, addItem, isEnchanted, totalWeight, letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../systems/inventory.js';   // U40: the sell filter, the encumbrance gate and the letter
import { isEquipped, unequipSlot } from '../systems/equip.js';   // AUDIT 17e F4: worn gear is not merchandise
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { createPlayerTicker , wireInfectionVideos, endRunToTitleMenu, exitToTitleMenu, doorSpellFor, consumeDoorSpell, wireDoorSpells, createDetectFeed, createRestDeps} from './shared.js';   // AUDIT 18: the interior host's world clock; S40: its rest deps
import { triggerExteriorOpen, DOOR_SPELL_TEXT } from '../systems/mysticism.js';   // X3: the Open spell's EXTERIOR-door arm
import { buildInteriorContext } from './interiorContext.js';
import { buildDungeonContext } from './dungeonContext.js';
import { DOOR_TYPE } from '../world/meshReader.js';
import { getGroundArchive } from '../world/climateSwaps.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_LIGHT_COLOR, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { isNight } from '../world/worldClock.js';   // AUDIT 23 (C12)
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C12): the one clock; G4's probe moves it
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5)
import { maxFatigue, liveStat } from '../systems/statMods.js';   // AUDIT 23 (C5); U40: strength for MaxEncumbrance
import { maxEncumbrance } from '../combat/formulas.js';   // U40: the letter-of-credit gate
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective, mirrorProjectionX } from '../world/mat4.js';   // HANDEDNESS: the one mirror (mat4's law)
import { routeKey, actionOf, held, moveHeld, anyMove, swallowBrowserKey } from '../ui/input.js';
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';
import { ArrowFlight } from '../combat/arrowFlight.js';   // C13: visible interior arrows
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS } from './hostCombat.js';   // AUDIT 21 hosts F8: the swing law, shared with the dungeon and the guards
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { audio } from '../systems/audio.js';
import { SpellbookWindow, preloadSpellbookArt, spellbookArtLoaded } from '../ui/spellbookWindow.js';   // U42: the classic art window (retires M2's keyed stand-in), and the guilds' BUY mode
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { SOUND, swingSoundFor } from '../systems/soundClips.js';   // AUDIT 23: the bow loose + no-enemy swing sounds
import { fetchBytes, applyMotorEffectFlags, applyFallLanding, ridePlatform } from './shared.js';
import { setDeathPresenter, hurtPlayer } from '../characters/playerEntity.js';   // AUDIT 21 hosts F6; AUDIT 23 C5 fatal collapse
import { DeathScreen } from '../ui/deathScreen.js';   // AUDIT 21 hosts F6: dying in a building
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the HUD vanished inside buildings
import { largeHudOptions, routeLargeHudClick } from '../ui/hudLarge.js';   // U45: the classic bottom bar and its eleven panels
import { trackHudPointer } from '../ui/hudActiveSpells.js';   // U46: the spell-icon rows' pointer
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
// E2: the shop shelf browse/buy layer (node-pure laws in shopStock.js)
import { ChoiceWindow } from '../ui/talkWindow.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { hudScale } from '../ui/hud.js';
import { isShop, isRepairShop, stockShopShelf, calculateCost, calculateTradePrice, regionPriceAdjustment, SHOP_BUYS_GROUPS, shopBuysItem, stockSoulGems, stockGuildMagicItems, stockGuildPotions } from '../systems/shopStock.js';   // X6: the soul-gem shelf; G4: the two guild shelves
import { identifySpellPass, identifiedTallyText } from '../systems/tradeModes.js';   // X7: the Identify SPELL's per-item roll
import { liveBundles, dispelBundle, dispellableBundles, DISPEL_MAGIC_TEXT } from '../systems/mysticism.js';   // X10: the Dispel Magic picker
import { ListPickerWindow, listPickerArtLoaded } from '../ui/listPicker.js';   // X10
import { LevelUpScreen } from '../ui/charsheet.js';   // AUDIT 21 hosts F3: levelling in a building
import { NativeTradeWindow, preloadTradeArt, tradeArtLoaded, TRADE_RECTS } from '../ui/nativeTrade.js';   // U8c
// U23: the static-NPC seam and the guild service popup.
import { STATIC_NPC_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../systems/talk.js';
import { staticNpcRoute, showsJoinButton, serviceAccess, onPushEffects } from '../systems/guildServiceFlow.js';
import { canAccessService } from '../systems/guildServices.js';   // G4: does THIS guild also sell soul gems?
import {
  receiveArmorDecision, claimArmor, SPYMASTER_GREETING_TEXT_ID,
  receiveHouseDecision, claimHouse, ALREADY_GIVEN_HOUSE,   // H1
} from '../systems/knightlyGifts.js';   // G6
import { mintCondition } from '../systems/itemTemplates.js';   // G6: the gift's pieces mint like any other item
import { npcServiceKind, freeHealing, freeMagickaRecharge } from '../systems/guildServices.js';
import { createGuildForGroup, ORDERS } from '../systems/guildVariants.js';
import { membershipOf, joinGuild, joinDecision } from '../systems/guilds.js';
import { ensureFactionRep } from '../systems/factionRep.js';
import { dateFromClassicMinutes, dateString, MINUTES_PER_DAY, DAYS_PER_MONTH } from '../systems/gameDate.js';   // B2: the loan due date   // H1: the month the houses-for-sale list turns over on
import { serviceDestination } from '../systems/guildServiceFlow.js';
import { buildTrainingFlow, buildDonationFlow, buildCureDiseaseFlow } from '../ui/guildServiceWindows.js';
import { preloadListPickerArt } from '../ui/listPicker.js';
import { getTitle } from '../systems/guilds.js';
import { getDivine, DIVINES } from '../systems/guildVariants.js';
import { BUILDING_TYPES, isResidence } from '../world/buildingNames.js';
import { getInteractionMode } from '../player/interactionMode.js';   // R1: PlayerActivate.currentMode, the one home
import { bindCursorToggle } from '../player/pointerLock.js';   // U45: PlayerMouseLook.cursorActive
import { buildingIsUnlocked, buildingLockValue, LOCKED_EXTERIOR_DOOR_TEXT } from '../systems/buildingLocks.js';   // R1: opening hours + the unlocked ladder
import { exteriorLockpickingChance, lookAtLockText, LOCKPICKING_SUCCESS_TEXT, LOCKPICKING_FAILURE_TEXT } from '../world/actionSystem.js';
import { discoverBuilding, getLastLockpickAttempt, setLastLockpickAttempt } from '../systems/discovery.js';
import { getHolidayId } from '../systems/holidays.js';
import { guildOfFaction, isMember } from '../systems/guilds.js';
// V5: rest above ground. The window and the session have been finished
// since U7; what was missing was a host outside the dungeon that opens
// one, and CanRest's whole town half.
import { RestWindow } from '../ui/restWindow.js';
import { canRest, HAVE_NOT_RENTED_ROOM, REST_TEXT } from '../systems/restSession.js';
import { isPlayerInTown } from '../systems/nearbyObjects.js';
import { plainLines } from './shared.js';   // V5b: TEXT.RSC answers ROWS, and these windows iterate strings
import { hallAccessAnytime } from '../systems/guildServices.js';
import { resolveVariantGuild } from '../systems/guildVariants.js';
import { getBool } from '../systems/settings.js';   // R1: InstantRepairs / AllowMagicRepairs go LIVE
import { reducedRepairCost } from '../systems/guildServices.js';   // R1: FightersGuild.ReducedRepairCost finds its caller
import {
  calculateItemRepairCost, updateRepairTimes, repairJobsAt, repairRefusal, repairStatusLabel,
  isBeingRepaired, isRepairFinished, collectRepaired, calculateItemRepairTime, leaveForRepair,
  MAGIC_ITEMS_CANNOT_BE_REPAIRED_TEXT_ID, DOES_NOT_NEED_TO_BE_REPAIRED_TEXT_ID, CANNOT_BE_REPAIRED_TEXT,
} from '../systems/repairService.js';
import { GuildServiceWindow, preloadGuildServiceArt, guildServiceArtLoaded } from '../ui/guildServiceWindow.js';
import { openPauseFlow, preloadPauseFlowArt, pauseArtLoaded } from '../ui/pauseWindow.js';   // I3/I4
import { preloadMessageBoxArt } from '../ui/messageBox.js';
import { nativeMetrics, pointToNative } from '../ui/nativePanel.js';
import { templateByIndex, itemBaseValue } from '../systems/itemTemplates.js';
import { goldAmount, deductGold, addGold } from '../systems/court.js';
// Q4-v: the quest layer's host wiring. The BRIDGE (scenes/questBridge.js)
// is created by the outer host (world.js) and rides in; this machine owns
// the interior half - the click stamp, the Quests service arm, the scene
// mount adapter and the modal tick.
import { getReputation } from '../systems/factionRep.js';
import { ServiceFlowWindow } from '../ui/guildServiceWindows.js';
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
import { createBankAccounts, createHouses, BANK_REGION_COUNT, TRANSACTION_RESULT, ownsHouse, isHouseOwned, housesForSale, allocateHouseToPlayer, purchaseHouse } from '../systems/banking.js';   // H1/H2
// P1: the scene cache - what an interior remembers across a visit.
import {
  createSceneCache, cacheScene, restoreCachedScene,
  interiorSceneName, LOOT_CONTAINER_TYPES, containsPermanentScene, addPermanentScene,
} from '../systems/sceneCache.js';
// S40: resting where the player has a claim - the rented-room finder
// the tavern rents through, and FightersGuild.CanRest.
import { findRentedRoom, removeExpiredRooms } from '../systems/tavern.js';
import { canRest as guildCanRest } from '../systems/guildServices.js';
import { interiorRestPlace, restDecision } from '../systems/restSession.js';   // CanRest's inside-a-building bag + the scene-free open gate above it
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
import { staticNpcName } from '../characters/staticNpc.js';   // wave 24: StaticNPC.DisplayName
import { GENDERS } from '../characters/nameHelper.js';
import { fieldOfView } from '../ui/viewSettings.js';   // MENU: Video/FieldOfView, one home for five hosts
let _charT0 = (typeof performance !== 'undefined' ? performance.now() : 0);
let _charAnimMode = 'idle'; // in-engine character animation: idle | walk | off (window.__anim)

// Dungeon water surface (R11 values, mirroring the dungeon scene).
const DUNGEON_WATER_COLOR = [1, 1, 1, 0.82];
const DUNGEON_WATER_SCROLL = 0.05;

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
        enemiesNearby: false, swimming: false, entity: playerEntity,
        day: false, inside: true,   // a building interior: no foes, dry feet
      });
      if (!interiorOverlay) interiorOverlay = new ActionTextBox(out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.']);
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
    if (!(interiorOverlay instanceof DeathScreen)) interiorOverlay = new DeathScreen({ onReset: () => endRunToTitleMenu(renderer) });   // D1
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
  const { canvas, renderer, player, cam, keys, latch, blocks, pipeline, doorTargets, baseCollider, voxelfolk = false, piece = 0, paint = false, buildingDataForDoor = null, townTalk = null, magic = null, spellsByIndex = null, questBridge = null, questSceneCtx = null, npcSession = null, talkSave = null, onQuestRestored = null, discoveryLocationId = null, gps = null, buildingDirectory = null } = host;   // H1: the location's whole building list, for the houses-for-sale roll   // V5: gps = PlayerGPS's location reads, for CanRest   // R1: the discovery store's location key (the anti-grind record's namespace)   // B4: the quicksave composer's trio + the world host's _questStarted latch   // Q4-v: the quest bridge + the host's scene-context closure ({mapId, locationIndex})   // M2: the host's cast engine + SPELLS.STD getter ride in   // host.foes: C8 E1 rigged class enemies in dungeons; buildingDataForDoor: E2's shop identity closure; townTalk: U23's static-NPC seam
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
  // the expired-room sweep. Its one note is worth keeping: A BUILDING
  // HAS NO FOE POOL in this port - the Q4-v flag on interior enemies
  // is still open - so `enemiesNearby` answers false and says so
  // rather than pretending to scan. FLAGGED.
  const interiorTicker = createPlayerTicker(playerEntity, {
    onExhausted: onExhaustedInterior,   // AUDIT 23 (C5)
    say,
    onLevelUp: () => {
      say('You have gained a level!');
      if (!interiorOverlay) interiorOverlay = new LevelUpScreen(playerEntity);
    },
  });

  // V1: the infection's host seam (THE FOUR HOSTS RULE). The interior
  // host borrows the exterior's townTalk for FACTION.TXT and TEXT.RSC,
  // exactly as U23's static-NPC seam does, and re-registers on entry
  // so a player who catches vampirism in a shop still dreams.
  wireInfectionVideos(renderer, {
    textAt: (id) => townTalk?.lines?.(id) ?? null,
    showText: (lines) => { if (!interiorOverlay) interiorOverlay = new ChoiceWindow({ lines }); },
    factionDict: () => townTalk?.factionDict ?? null,
  });

  // X4: the interior arm's Detect scan (see the frame body). Both
  // pools are empty until interior loot containers ship.
  const detectFeed = createDetectFeed(playerEntity, { feet: () => player.pos });
  // X7: set while an IDENTIFY SPELL's window is open ({chance, cost}),
  // null for the paid guild service. The trade window is one window
  // serving both, exactly as DFU's is.
  let _identifySpell = null;
  const { getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, arch, palette } = pipeline;
  // AUDIT 21 (hosts lane, F7): the HUD art for interior mode. A missing file
  // answers null and drawHud no-ops, so this host draws no HUD rather than
  // failing to mount.
  let hudArt = null;
  loadHud({ fetchBytes, ImgFile, palette, renderer }).then((a) => { hudArt = a; })
    .catch((e) => console.error('[hud]', e));


  let mode = 'exterior';
  let zPrev = false;   // ReadyWeapon (Z) edge state
  // C9: the INTERIOR mode's FP weapon (the dungeon context owns its
  // own audited copy; the host rule wants the weapon in every mode).
  const interiorWeapon = createWeaponRig({
    spellArmed: () => magic?.spellArmed() ?? false,   // M2
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say,
  });
  // C13: the interior arrow flights (collider late-resolved - each
  // building brings its own).
  const interiorArrows = new ArrowFlight({ getGpuMesh: pipeline.getGpuMesh, collider: () => interiorCtx?.collider });
  let _arrowsCtx = null;
  let interiorCtx = null;
  // E2: the entered building's identity + the shop browse overlay.
  let interiorBuilding = null;
  let interiorOverlay = null;
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
    preloadPauseFlowArt({ renderer, fetchBytes, palette }).catch((e) => console.warn('[pause] pause/controls art unavailable:', e?.message ?? e));   // I3/I4
    preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11 parchment for its boxes
    preloadListPickerArt({ renderer, fetchBytes, palette });   // U24: PICK00I0 for the training skill list
    preloadTavernArt({ renderer, fetchBytes, palette });   // U39: TVRN00I0 for the innkeeper's panel
    preloadBankArt({ renderer, fetchBytes, palette });   // B2: BANK00I0 for the teller's screen
    preloadPurchaseArt({ renderer, fetchBytes, palette });   // H2: BANK01I0 for the house market
    preloadPotionArt({ renderer, fetchBytes, palette });   // M2: MASK00I0 for the cauldron
    preloadItemMakerArt({ renderer, fetchBytes, palette });   // M4: ITEM00I0 + the gold tab strip
    preloadSpellbookArt({ renderer, fetchBytes, palette })   // U42: SPBK00I0 (cast) + SPBK01I0 (the guilds' buy mode)
      .catch((e) => console.warn('[spellbook] classic spellbook art unavailable:', e?.message ?? e));
  };

  // ---- Q4-v: THE QUEST LAYER'S INTERIOR MOUNT -----------------------
  // Q4-iii's addQuestResourceObjects walk runs over this adapter when a
  // building interior is entered (and again on the machine's hot-place
  // callback), standing quest Persons and Items as billboard batches in
  // the LIVE interior context - the flats idiom, async-filled off the
  // texture cache. Each stand carries its QuestResourceBehaviour: the
  // behaviours drive every modal frame (Unity Update), an E-click
  // routes DoClick, and the interior teardown notifies destruction
  // exactly as Unity's OnDestroy does on a scene transition.
  // FLAGGED (Port-Ledger Q4-v, NARROWED by B1/B2): quest FOES still
  // pend the INTERIOR enemy host alone - this adapter's standFoe stays
  // absent, so the walk skips the stand inside a building. The dungeon
  // mount SHIPPED (B2 below) and stands real foes through B1's chain.
  let questFlats = [];          // interior stands (the click sites index this list)
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
  function standQuestFlatIn(list, getCtx, toScene, inDungeon, archive, record, position, behaviour, staticNpcFactionId = null, hashPosition = null) {
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
      // The anchor (see the header), then AlignBillboardToGround
      // (GameObjectHelper.cs:336-346), which AddQuestNPC/AddQuestItem
      // both call with distance 4: a ray from 0.2 above, and on a hit
      // the CENTRE goes to hit + size.y * 0.52 - so a bottom-anchored
      // base sits size.y * 0.02 off the floor, the 2% lift that keeps
      // it out of the ground plane. No floor within 4 and the marker
      // position stands as-is, verbatim (C# returns without moving).
      let by = inDungeon ? y - size.h / 2 : y;
      const drop = ctx.collider?.raycast?.([x, by + 0.2, z], [0, -1, 0], 4);
      if (Number.isFinite(drop)) by = (by + 0.2 - drop) + size.h * 0.02;
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
      return standQuestFlat(t.worldTextureArchive, t.worldTextureRecord, position, behaviour);
    },
    // standFoe absent - see the FLAG above.
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
  // FLAGGED: clicks on dungeon quest NPC/item flats pend the dungeon
  // activation ray (the E-click routes only exit/loot/action keys), so
  // "clicked npc/item" at a dungeon site does not fire yet - kills do.
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
      return standDungeonQuestFlat(t.worldTextureArchive, t.worldTextureRecord, position, behaviour);
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
  }

  // E2: the shelf browse/buy chain (DFU's trade window collapsed to
  // our keyed-window idiom; haggling is the fixed CalculateTradePrice
  // buy price - the offer/counteroffer UI pends). Stock is lazy per
  // shelf (StockShopShelf on first activation); buying deducts gold
  // and moves the item into the player entity.
  const _itemLabel = (it) => it.name ?? templateByIndex(it.templateIndex)?.name ?? it.group;
  function openShelf(i) {
    const b = interiorBuilding;
    const shelf = interiorCtx?.shelves[i];
    if (!b || !shelf) return;
    if (!isShop(b.buildingType)) return;   // Library/Guild/Temple bookshelves + owned-house storage pend (FLAGGED)
    shelf.items ??= stockShopShelf({ buildingType: b.buildingType, quality: b.quality }, playerEntity);
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
    target.items ??= isShop(b.buildingType)
      ? stockShopShelf({ buildingType: b.buildingType, quality: b.quality }, playerEntity)
      : [];
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
  function openTradeWindow(shelf, b, mode, { guildFactionId = null } = {}) {
    const skills = () => ({
      mercantile: skillValue(playerEntity, SKILLS.Mercantile),
      personality: playerEntity.stats?.personality ?? 50,
    });
    return new NativeTradeWindow({
      mode,
      shelfItems: () => shelf.items,
      // AUDIT 17e F4: an EQUIPPED item never reaches either list -
      // selling a worn item left equip.slots pointing at it.
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
        // G4: THE GUILD STORE ARM. This had been a FLAGGED null since
        // U40, which meant buyHolidayHalvesPrice's Mages Guild clause
        // - Tales and Tallow halving the price of anything bought AT
        // the Mages Guild - had never had a caller able to satisfy
        // it. A guild service opening the trade window is exactly the
        // case that supplies one; a high-street shop still passes
        // null, because a shop belongs to no guild.
        guildFactionId,
        skills: skills(),
      }),
      gold: () => goldAmount(playerEntity),
      rows: (id) => townTalk?.lines?.(id) ?? [],
      cityName: () => townTalk?.cityName?.() ?? (interiorBuilding?.name ?? ''),
      weight: () => ({
        carriedWeightKg: totalWeight(playerEntity.items ?? []),
        maxEncumbranceKg: maxEncumbrance(liveStat(playerEntity, 'strength')),
      }),
      commit: (m, staged, price, proceeds) => commitTrade(shelf, m, staged, price, proceeds),
      icons: { getTexture, uploadRecord, textures: renderer.textures },
      entity: playerEntity,   // AUDIT 17f: icons address for the wearer's morphology
      shopName: b.name ?? '',
    });
  }

  /** ConfirmTrade_OnButtonClick's Yes arm (:1027-1092), host side.
   *  One Mercantile tally per CONCLUDED DEAL, not per item - DFU
   *  raises OnTrade once and tallies once, however many goods moved. */
  function commitTrade(shelf, mode, staged, price, proceeds) {
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
      // credit instead. FLAGGED: there is nowhere to cash one yet, so
      // the letter is minted and carried (banking's arc owns the rest).
      if (proceeds?.kind === 'letterOfCredit') {
        playerEntity.items.unshift(letterOfCredit(proceeds.amount));
      } else {
        addGold(playerEntity, price);
      }
      for (const it of staged) shelf.items.push(it);   // sold goods land on the open shelf
    } else if (mode === 'Repair') {
      deductGold(playerEntity, price);
      const now = Math.floor(worldMinutes());
      for (const it of staged) {
        if (getBool('Controls', 'InstantRepairs')) it.currentCondition = it.maxCondition;
        else leaveForRepair(it, interiorBuilding?.buildingKey ?? 0,
          calculateItemRepairTime(it.currentCondition ?? 0, it.maxCondition ?? 0), now);
        // a non-instant repair keeps the item in the SHOP's hands
        if (!getBool('Controls', 'InstantRepairs')) continue;
        addItem(playerEntity.items, it);
      }
    } else if (mode === 'Identify') {
      // X7: two Identify paths through one arm, as DFU has them. The
      // SERVICE charges gold and identifies everything staged; the
      // SPELL rolls per item against its own chance and spends
      // magicka ONCE for the whole list, whatever the outcome
      // (DaggerfallTradeWindow.cs:966-991).
      if (_identifySpell) {
        const pass = identifySpellPass(staged, _identifySpell.chance, Math.random);
        for (const it of pass.identified) it.isIdentified = true;
        if (pass.spendMagicka) {
          playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - _identifySpell.cost);
        }
        townTalk?.say?.(identifiedTallyText(pass.successCount, pass.total));
        for (const it of staged) addItem(playerEntity.items, it);
      } else {
        deductGold(playerEntity, price);
        for (const it of staged) { it.isIdentified = true; addItem(playerEntity.items, it); }
      }
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
  // THE FOUR HOSTS, named. This seam belongs to the INTERIOR host and
  // to no other:
  //   - scenes/worldModes.js      WIRED (here). It is the only host
  //     that builds a building interior, so it is the only one with
  //     StaticNPCs to click.
  //   - scenes/exterior.js        no interior of its own; it MOUNTS
  //     this machine, and a click inside reaches here through it.
  //   - scenes/world.js           the same - it mounts this machine.
  //   - scenes/dungeonContext.js  dungeons have no StaticNPC people
  //     records at all (RDB blocks carry flats and enemies, not
  //     blockPeopleRecords), so there is nothing here to wire. A quest
  //     Person placed in a dungeon is the quest machine's, FLAGGED
  //     with it.
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
    const npcData = questBridge?.clickNpc(pn, { ...(questSceneCtx?.() ?? {}), buildingKey: interiorBuilding?.buildingKey ?? 0 }) ?? null;
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
    if (route.kind === 'guildService') { openGuildService(pn, route); return; }
    // R1: the repair-shop merchant (DaggerfallMerchantRepairPopupWindow
    // - Armorer/GeneralStore/WeaponSmith per RMBLayout.IsRepairShop).
    // The popup carries THREE buttons (:82-97): Repair (the window's
    // list), Talk (T - re-runs this routing with the merchant arm
    // skipped and menu:true, TalkButton_OnMouseClick :143-148), and
    // and Sell, which U40 landed - the popup's third button opens the
    // trade window in Sell mode. The BANKING arm stays FLAGGED below;
    // the tavern's landed with U39.
    if (!forceTalk && route.kind === 'merchant' && route.service === 'repair') {
      openRepairService({
        onTalk: () => openStaticNpc(pn, { forceTalk: true }),
        onSell: () => openMerchantSell(),
      });
      return;
    }
    // B2: DaggerfallBankingWindow. The routing has answered 'banking'
    // since G8 into a dead arm - the bank teller fell through to talk.
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
    const displayName = npcData
      ? staticNpcName(npcData, { getFaction: (id) => dict?.get(id) ?? null })
      : (pn.displayName ?? '');
    const talk = npcSession?.talkToStaticNPC(
      { data: pn, isChildNPC: !!pn.isChildNPC, displayName },
      // R1: StaticNPCClick's own arms pass menu:FALSE (:1633 et al);
      // the repair popup's Talk button calls TalkToStaticNPC with the
      // DEFAULT menu=true (DaggerfallMerchantRepairPopupWindow.cs:147)
      // - forceTalk IS that button, so it carries the popup's flag.
      { menu: forceTalk, isSpyMaster: route.spymaster === true });
    if (talk?.kind === 'questOffer' && questBridge) {
      const step = questBridge.offerSocialQuest(talk.npc ?? pn, talk.socialGroup, talk.menu);
      const boxes = questBridge.offerBoxes(step, (id) => townTalk?.lines?.(id) ?? []);
      if (boxes.length && guildServiceArtLoaded() && _shopFont) {
        // the U24 identity guard: a window that dispatches to another
        // must not be nulled by its OWN onClose
        let offerWin = null;
        offerWin = new ServiceFlowWindow(boxes, {
          onClose: () => { if (interiorOverlay === offerWin) interiorOverlay = null; },
        });
        interiorOverlay = offerWin;
      }
      return;
    }
    // the three doors that close before a conversation: a racial
    // override, a reaction below -20, and a standing rejection - each
    // already said its piece through the session's messageBox seam
    if (talk && talk.kind !== 'talk') return;
    // FLAGGED, each with the slice it waits on:
    //   merchant  - DaggerfallMerchantServicePopupWindow's SELL and
    //               BANKING arms: sell needs the trade window's mode
    //               split, banking needs a bank that does not exist
    //               yet. (Repair landed with R1 and the tavern with
    //               U39; both are consumed above.)
    //   witchesCoven - DaggerfallWitchesCovenPopupWindow.
    // Both fall through to TALK, which is DFU's own last arm for an
    // NPC with no special handling, so nothing is inert.
    console.log('[interior] static NPC route:', route.kind, route.service ?? '');
    // B7 (AUDIT 25 blocker 7): the conversation OPENS. TalkToNpc's
    // tail is pushTalkWindow (TalkManager.cs:2653) - the engine has
    // computed the greeting, the resets and the topic rebuild since
    // TK-v, and this host answered "You get no response." over the
    // top of all of it. The window mounts through townTalk (its
    // overlay draws and takes input in every mode - the hosts route
    // townTalk first). A host with no session keeps the old line.
    if (talk?.kind === 'talk' && townTalk?.openTalkWindow) {
      townTalk.openTalkWindow(talk.greeting, { npcSeed: pn.nameSeed ?? 0, npcName: displayName });
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
    const lootContainers = [
      ...(ctx.shelves ?? []).map((sh, i) => ({
        containerType: LOOT_CONTAINER_TYPES.ShopShelves, key: `shelf:${i}`, items: sh.items ?? null,
      })),
      ...(ctx.containers ?? []).map((c, i) => ({
        containerType: LOOT_CONTAINER_TYPES.HouseContainers, key: `container:${i}`, items: c.items ?? null,
      })),
    ];
    const actionDoors = [...(ctx.actions?.objects?.values?.() ?? [])]
      .map((o) => ({ key: o.key, state: o.state }));
    return { lootContainers, actionDoors };
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
    }
    for (const d of data.actionDoors) {
      const o = interiorCtx.actions?.objects?.get?.(d.key);
      if (o) o.state = d.state;
    }
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
    let win = null;
    win = new BankWindow({
      accounts: () => playerEntity.bankAccounts,
      regionIndex: () => b?.regionIndex ?? 0,
      level: () => playerEntity.level ?? 1,
      now: () => Math.floor(worldMinutes()),
      player: bankPurse(),
      wagonGold: () => (playerEntity.wagonItems ?? []).find((i) => i.group === 'Currency')?.stackCount ?? 0,
      rows: (id) => townTalk?.lines?.(id) ?? [],
      // GetLoanDueDateString (:571-580) - empty when nothing is owed,
      // otherwise DateString(), which carries no year.
      dueDateText: (minutes) => (minutes > 0 ? dateString(dateFromClassicMinutes(minutes)) : ''),
      // H1: house ownership is live. SHIP ownership still needs the two
      // fixed ship scenes and stays FLAGGED, so those buttons keep
      // refusing through the law's own decisions.
      ownsHouse: () => ownsHouse(playerEntity.houses ?? [], b?.regionIndex ?? 0),
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
          rows: (id) => townTalk?.lines?.(id) ?? [],
          buy: (h) => purchaseHouse(playerEntity.bankAccounts, playerEntity.houses, region, h, bankPurse(), {
            meshRadius: h.meshRadius ?? 0,
            mapId: dir?.mapId ?? 0,
            location: dir?.locationName ?? '',
            sideEffects: { ...houseSideEffects(), playerName: playerEntity.name ?? '', regionName: dir?.regionName ?? '' },
          }),
          onClose: () => { if (interiorOverlay === pw) interiorOverlay = win; },
        });
        interiorOverlay = pw;
        return true;
      },
      // FLAGGED, and now at the RIGHT thing: the sell PRICE needs the
      // owned building's mesh radius, which means resolving the model
      // behind a buildingKey - the same reader DaggerfallBankPurchase-
      // PopUp needs for its 3D preview. Zero until that lands, so the
      // sell offer quotes nothing rather than a wrong number.
      houseSellPrice: () => 0,
      ownsShip: () => false,
      ownedShip: () => -1,
      isPortTown: () => false,
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
      maxEncumbranceKg: () => maxEncumbrance(liveStat(playerEntity, 'strength')),
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
    const memberships = (playerEntity.guildMemberships ??= {});
    const km = joinedGuildOfGroup(memberships, GUILD_GROUPS.KnightlyOrder);
    const knightGuild = km?.guild?.startsWith('Order:') ? orderOf(km.guild.slice('Order:'.length)) : null;
    let win = null;
    win = new TavernWindow({
      entity: playerEntity,
      rows: (id) => townTalk?.lines?.(id) ?? [],
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

  function openGuildService(pn, route) {
    /** B7: the popup's TALK button is TalkToStaticNPC with menu
     *  defaulted TRUE (DaggerfallGuildServicePopupWindow.cs:294) -
     *  the same engine doors, then the window push. G6 gave it a
     *  SECOND caller: the Spymaster's greeting hands the player to
     *  this same door on dismissal, with isSpyMaster true (:713). */
    const talkToStaticNpcHere = ({ isSpyMaster }) => {
      const dict2 = townTalk?.factionDict ?? null;
      const npcData2 = pn.factionID ? staticNpcData(pn, { ...(questSceneCtx?.() ?? {}), buildingKey: interiorBuilding?.buildingKey ?? 0 }) : null;
      const displayName2 = npcData2 ? staticNpcName(npcData2, { getFaction: (id) => dict2?.get(id) ?? null }) : (pn.displayName ?? '');
      const talk2 = npcSession?.talkToStaticNPC(
        { data: pn, isChildNPC: !!pn.isChildNPC, displayName: displayName2 },
        { menu: true, isSpyMaster });
      if (talk2?.kind === 'talk' && townTalk?.openTalkWindow) {
        interiorOverlay = null;   // the popup yields to the conversation, as DFU's CloseWindow-then-push does
        townTalk.openTalkWindow(talk2.greeting, { npcSeed: pn.nameSeed ?? 0, npcName: displayName2 });
        return;
      }
      if (!talk2) townTalk?.say?.('You get no response.');   // no session mounted - the old line
    };
    const dict = townTalk?.factionDict ?? null;
    const guild = createGuildForGroup(route.guildGroup, route.buildingFactionId, dict);
    if (!guild) { townTalk?.say?.('You get no response.'); return; }
    if (!guildServiceArtLoaded() || !_shopFont) return;   // no art, no window (the U8 idiom)
    const memberships = (playerEntity.guildMemberships ??= {});
    // THE ONE CONSTRUCTION SEAM (5th): DFU's PlayerEntity always has
    // FactionData; the port's pre-chargen INTERIM entity does not, and
    // the join decision reads reputation. The live probe hit this as a
    // pageerror on `store.dict`.
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
        // U24: the three the port can perform. Every other arm is
        // FLAGGED by name in guildServiceFlow.SERVICE_DESTINATION.
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
  const makeSpellbookWindow = () => (spellbookArtLoaded()
    ? new SpellbookWindow({
      spells: () => (playerEntity.spells ??= []),
      entity: playerEntity,
      castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
      onReady: (sp, { noSpellPointCost } = {}) => magic.readySpell(sp, { free: !!noSpellPointCost }),
      rows: (id) => townTalk?.lines?.(id) ?? [],
    })
    : null);

  /** DoGuildService's three built arms (U24). Each returns a
   *  ServiceFlowWindow, or null for a destination that does not exist
   *  yet. `onClose` uses the same identity guard as the popup's. */
  function openServiceFlow(destination, { guild, memberships, store, rows, route, talkAsSpymaster = null }) {
    if (!destination) return null;
    const membership = membershipOf(memberships, guild);
    const b = interiorBuilding;
    const closeSelf = () => { if (interiorOverlay === flow) interiorOverlay = null; };
    const now = () => interiorTicker.classicMinutes;   // already CLASSIC minutes (AUDIT 21 F2)
    const godName = guild.divine ?? '';
    let flow = null;
    // R1: the guild repair service - the same keyed flow the repair
    // shops open, with guild.ReducedRepairCost bound (FightersGuild's
    // rank scaling; the base guild returns the price unchanged, so
    // binding it for every guild IS DFU's `guild != null` arm).
    // X7: IDENTIFY. DFU's service is the trade window in Identify mode
    // (DaggerfallGuildServicePopupWindow pushes it exactly as it does
    // Repair), and the port's Identify mode was already whole - the
    // cost formula with its Witches Festival free arm, the per-item
    // skip, the refusal line. Only the destination was a FLAGGED null,
    // and under it the identified state was being read raw rather than
    // DERIVED, so opening this mode before X7 would have offered to
    // identify a rusty dagger for money.
    //
    // The player's own pack is BOTH lists here: DFU's Identify mode
    // stages out of localItems into remoteItems and hands everything
    // back, so there is no shop shelf at all - the empty one below is
    // what the window's Buy-side plumbing expects to find and never
    // reads in this mode.
    if (destination === 'guildServiceIdentify' && tradeArtLoaded()) {
      _identifySpell = null;   // the PAID service - gold, not a per-item roll
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
      const win = host.makeInventory?.({
        chooseOne: {
          items: decision.pieces,
          onChoose: () => { claimArmor(membership, decision.mask); surfacePlayer(); },
        },
      });
      if (!win) return null;
      interiorOverlay = win;
      return win;
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
    // temple and Mages Guild both offer it, and the destination has
    // been a FLAGGED null since G3.
    if (destination === 'guildServicePotionMaker' && potionArtLoaded() && _shopFont) {
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
        takeOne: (templateIndex, where) => {
          const list = where === 'pack' ? playerEntity.items : (playerEntity.wagonItems ?? []);
          const i = list.findIndex((it) => it.templateIndex === templateIndex);
          if (i < 0) return false;
          removeOne(list, list[i]);
          return true;
        },
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        entity: playerEntity,
        onClose: () => { if (interiorOverlay === potionWin) interiorOverlay = null; },
      });
      interiorOverlay = potionWin;
      return null;
    }
    // M4: the item maker. The Mages Guild's own enchanter, and the
    // destination has been a FLAGGED null since G3.
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
    // Guild's, open to non-members) share one destination. Both have
    // been FLAGGED nulls since G3.
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
    const key = pickActivatable(eye, dir, targets, baseCollider());
    if (key === null) return false;
    const hit = entries[key];
    // Route by verbatim door type: buildings to interiors, dungeon
    // entrances into the RDB crawl.
    if (hit.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE) return tryEnterDungeon(hit, entries);
    if (hit.door.doorType !== DOOR_TYPE.BUILDING || hit.recordIndex === undefined) return false;
    // R1: THE EXTERIOR DOOR LOCK (ActivateStaticDoor, PlayerActivate.cs
    // :512-568). Closed hours lock the town: the unlocked ladder runs
    // first (owned houses and quest buildings FLAGGED/seamed per
    // buildingLocks.js); a locked door in any mode but Steal speaks the
    // refusal + the look-at text (classic's interior-formula oversight
    // included); Steal mode picks - gated by the per-building
    // anti-grind record (the skill must RISE past the last failure),
    // tallying Lockpicking before the roll, entering ONCE on success
    // (no persistent unlock - DFU's isBrokenIn is local) and recording
    // the skill on failure. DiscoverBuilding fires on the activation
    // (:515). X3 wired the Open-spell bypass (:519-520). FLAGGED: the bash arms with
    // their Breaking_And_Entering crimes (:571-583/:621-627 - no
    // weapon-vs-static-door path exists yet), the house greeting
    // (:585-628) and TallyCrimeGuildRequirements (the TG advancement
    // arc).
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
            const m = membershipOf((playerEntity.guildMemberships ??= {}), guild);
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
        const lockValue = buildingLockValue(bd.quality);
        if (!opened) {
          const spell = doorSpellFor(playerEntity);
          if (spell?.kind === 'open') {
            const r = triggerExteriorOpen(lockValue, spell.holderLevel);
            consumeDoorSpell(playerEntity, 'open');
            if (r.alert) townTalk?.say?.(DOOR_SPELL_TEXT[r.alert]);
            opened = r.opened;
          }
        }
        if (!opened) {
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
            townTalk?.say?.(LOCKPICKING_SUCCESS_TEXT);
            audio.playOneShot(SOUND.ActivateLockUnlock, 1);
          } else {
            townTalk?.say?.(LOCKPICKING_FAILURE_TEXT);
            if (locId) setLastLockpickAttempt(locId, bd.buildingKey, lockpick);
            return true;
          }
        }
      }
    }
    transitioning = true;
    try {
      // P8: parent the interior at the entered building's world matrix
      // (verbatim ownerPosition + buildingMatrix) - context coordinates
      // come back world-frame, landings run in one frame, and the walk
      // through the door is coordinate-seamless.
      const ctx = await buildInteriorContext(
        { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette },
        // DaggerfallInterior.IsBadInteriorModel (:530-548) keys the
        // 31000-overlap repair on EntryDoor.blockIndex, which
        // RMBLayout.cs:848 mints as blockData.Index. The literal 0 is
        // not a key in the table, so the repair could never fire when
        // a building was entered from ?world / ?exterior - the same
        // building reached through ?interior=NAME:REC omitted it.
        hit.dfBlock, hit.dfBlock.index, hit.recordIndex, hit.climateBase, hit.season,
        hit.door.matrix, { voxelfolk, piece, paint, setupStaticNpc });
      const siblings = entries.filter((e) =>
        e.dfBlock === hit.dfBlock && e.recordIndex === hit.recordIndex);
      const landing = interiorLanding(
        doorWorldPosition(hit.door), ctx.enterMarkers, ctx.doors);
      if (!landing) throw new Error('no interior landing');
      exitReturn = { siblings };
      interiorCtx = ctx;
      // X1: an armed Open/Lock spell fires on this interior's doors
      // too - the same law the dungeon context wires for its own.
      wireDoorSpells(ctx.actions, playerEntity, (t) => townTalk?.say?.(t));
      // E2: the building's identity (type/quality/key/name) rides the
      // host's merge closure; shops warm the browse font.
      interiorBuilding = buildingDataForDoor?.(hit) ?? null;
      ensureInteriorWindowArt();   // U23: every interior can open a window now
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
      player.spawn(floored[0], floored[1], floored[2]);
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
    questFlats.forEach((s, i) => {
      if (!s.width || !s.active || s.dead) return;
      const isPerson = s.behaviour?.targetResource?.isPerson === true;
      targets.push({
        key: `questflat:${i}`,
        aabb: { min: [s.x - s.width / 2, s.y, s.z - s.width / 2], max: [s.x + s.width / 2, s.y + s.height, s.z + s.width / 2] },
        distance: isPerson ? STATIC_NPC_ACTIVATION_DISTANCE : DEFAULT_ACTIVATION_DISTANCE,
      });
    });
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
        cam.pos = player.eye;
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
        const s = questFlats[Number(key.split(':')[1])];
        if (s) {
          // PlayerActivate.StaticNPCClick:1521 stamps LastNPCClicked
          // BEFORE the behaviour click - the quest NPC's StaticNPC peer
          // carries SetLayoutData(marker position, person)
          // (GameObjectHelper:1062 -> StaticNPC.cs:245-255): the hash
          // from the SCALED marker ints truncated, flags/nameSeed from
          // the Person (-1 falls back to the hash), buildingKey from
          // the runtime data (:299-306), mapID never written (0).
          const person = s.behaviour?.targetResource;
          if (questBridge && person?.isPerson) {
            const hash = positionHash(Math.trunc(s.marker.x), Math.trunc(s.marker.y), Math.trunc(s.marker.z));
            // AUDIT 24 (the seven-slice sweep): through the bridge's
            // SetLayoutData now, not a hand-rolled literal. The literal
            // carried eight of NPCData's thirteen fields - no race (so
            // QuestMCP.Oath's clicked-NPC arm, the one the main quests
            // lean on before a questor is set, read undefined every
            // time) and no context.
            questBridge.machine.setLastNPCClicked(questBridge.layoutNpcData({
              hash,
              gender: person.gender,
              factionID: person.factionId ?? 0,
              nameSeed: person.nameSeed ?? -1,
              buildingKey: interiorBuilding?.buildingKey ?? 0,
              mapID: 0,
            }));
          }
          // AUDIT 24 (wave 25): PlayerActivate keeps DoClick's bool.
          // The quest-resource arm (:326-339) calls it and FALLS
          // THROUGH to the building/door/NPC checks either way, and
          // StaticNPCClick (:1525-1528) returns only when it answered
          // TRUE. Here the stand is the only thing under the ray, so
          // there is nothing to fall through to - recorded rather than
          // silently dropped, because the value is what says whether
          // any live quest owned the click.
          const foundInActiveQuest = s.behaviour?.doClick() ?? false;
          if (!foundInActiveQuest) {
            console.log('[quest] clicked a stand no active quest claims (DFU would fall through to the world here)');
          }
        }
        return true;
      }
      if (key.startsWith('container:')) {
        // S2b: open the house container - synchronous transfer through
        // the shared inventory (private furniture starts EMPTY; shops/
        // quests fill these later; open-feedback pends the UI arc).
        const c = interiorCtx.containers[Number(key.split(':')[1])];
        if (c) {
          transferAll(c.items, playerEntity.items);
            surfacePlayer();
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
    interiorCtx = null;
    interiorBuilding = null;   // E2: the identity + overlay leave with the interior
    interiorOverlay = null;
    player.collider = baseCollider();
    player.spawn(landing[0], landing[1], landing[2]);
    mode = 'exterior';
    questBridge?.onExteriorTransition();   // Q4-v: CreateFoe's pending-wave invalidation
    npcSession?.onWorldChanged();          // TK-v: OnTransitionToExterior (:3599-3603)
    console.log('exterior: returned at door');
    return true;
  }

  async function tryEnterDungeon(hit, entries) {
    const dfLocation = hit.dfLocation;
    if (!dfLocation || !dfLocation.hasDungeon) return false;
    transitioning = true;
    try {
      const ctx = await buildDungeonContext(
        { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette },
        dfLocation, blocks, dfLocation.climate.climateType, {
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
        });
      dungeonCtx = ctx;
      // P10 host parity (2026-08-16 audit: only the standalone scene
      // installed the warp - a world-mode teleporter logged and
      // no-opped): Teleport actions move the modal player.
      ctx.actions.onTeleport = ({ pos, yawDeg }) => {
        player.spawn(pos[0], pos[1], pos[2]);
        cam.pos = [...player.eye];
        cam.yaw = yawDeg * Math.PI / 180;
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
      mode = 'dungeon';
      dungeonLoc = dfLocation;
      player.collider = ctx.collider;
      const spawn = ctx.startSpawn();   // ONE source: verbatim MovePlayerToMarker + FixStanding in the context
      player.spawn(spawn[0], spawn[1], spawn[2]);
      cam.pos = player.eye;
      mountQuestResources();   // B2: AddQuestResourceObjects(SiteTypes.Dungeon) on the transition, as PlayerEnterExit raises it
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
    return tryEnterDungeon(hit, entries);
  }

  function tryExitDungeon() {
    const eye = player.eye;
    const dir = eyeDir();
    const targets = dungeonCtx.exitDoors.map((d, i) => ({ key: `exit:${i}`, aabb: doorWorldAabb(d) }));
    targets.push(...activationTargets(dungeonCtx.actions.objects));   // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
    targets.push(...dungeonCtx.lootTargets());   // S2: piles + lootable corpses
    const key = pickActivatable(eye, dir, targets, dungeonCtx.collider);
    if (key === null) return false;
    // U26: droppedLoot: is the player's own pile - the same three-way
    // arm the standalone dungeon scene carries, kept in step here.
    if (key.startsWith('loot:') || key.startsWith('corpse:') || key.startsWith('droppedLoot:')) {
      dungeonCtx.takeLoot(key);   // opens the inventory with the pile as the remote target
      return true;
    }
    if (!key.startsWith('exit:')) {
      dungeonCtx.actions.activate(key, { steal: getInteractionMode() === 'steal', doorSpell: doorSpellFor(playerEntity) });   // X1
      return true;
    }
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
      player.spawn(landing.pos[0], landing.pos[1], landing.pos[2]);
      cam.yaw = Math.atan2(landing.normal[0], landing.normal[2]);
    }
    cam.pos = player.eye;
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
    const paralyzed = (mode === 'dungeon' && dungeonCtx) ? (dungeonCtx.playerParalyzed?.() ?? false) : false;
    // E2: the shop overlay holds the motor like every other window
    // (typing digits must not walk the player).
    // AUDIT 18 HOST GAP: the dungeon overlay was absent from this
    // expression, so with F6/the rest window open in a world-hosted
    // dungeon the motor kept walking, E still exited the dungeon and
    // the movers kept travelling - all of it under the open menu.
    // DFU UserInterfaceManager.AddWindow (:179-184) calls
    // PauseGame(true) for any PauseWhileOpen window (the default),
    // which is what dungeon.js:218's `held` already implements.
    const overlayHeld = (mode === 'interior' && !!interiorOverlay) ||
      (mode === 'dungeon' && !!dungeonCtx?.uiOverlayActive);
    // Q4-v: the quest layer's modal frame. Behaviours update every
    // frame (Unity Update runs whatever Time.timeScale is); the
    // machine's OWN tick freezes under a paused window - PauseGame
    // sets timeScale 0 and QuestMachine.Update accumulates
    // Time.deltaTime, which is 0 there - so the overlay gates it.
    if (mode === 'interior') for (const s of [...questFlats]) s.behaviour?.update();
    if (mode === 'dungeon') for (const s of [...dungeonQuestFlats]) s.behaviour?.update();   // B2: foe behaviours drive inside drawFoes
    if (!overlayHeld) questBridge?.tick(dt);
    const inputHeld = paralyzed || overlayHeld;
    const crouchHeld = held(keys, 'Crouch');   // I2: DFU's default C (was the port's X)
    const mv = moveHeld(keys);
    const moving = !inputHeld && anyMove(mv);
    // Platform riding (the DFU MoveWithMovingPlatform shape) was wired
    // ONLY into the standalone ?dungeon scene, so a world/exterior
    // hosted dungeon dropped the mover delta and the lift penetrated
    // the capsule. The delta applies BEFORE the player's own move.
    if (!overlayHeld) ridePlatform(player, mode === 'dungeon' ? dungeonCtx?.actions : interiorCtx?.actions);
    // Audit F3: crouch stays live while paralyzed (DFU gates movement/jump only)
    player.update(dt, inputHeld ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
      forward: (mv.forwards ? 1 : 0) - (mv.backwards ? 1 : 0),
      strafe: (mv.right ? 1 : 0) - (mv.left ? 1 : 0),
      run: held(keys, 'Run'),
      sneak: held(keys, 'Sneak'),   // P15: DFU's default Sneak binding (LeftAlt), held
      jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
      up: jumpHeld || held(keys, 'FloatUp'),
      down: held(keys, 'FloatDown'),
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
        standingStill: !anyMove(mv),
        halfSpeed: player.movingLessThanHalfSpeed,
      }, pickFootstepSet(mode === 'interior'
        ? { inside: true, inBuilding: true }
        : { inside: true, inBuilding: false,
            dungeonSwimming: player.swimming,
            dungeonShallow: _surf != null && !player.swimming && (player.pos[1] + 0.9 - 0.57) < _surf }));
      if (_step) audio.playOneShot(_step.clip, _step.volume);
    }
    if (mode === 'dungeon' && dungeonCtx) {
      // P11: the splash/jump/swim-minute fatigue feed (same seam as
      // the standalone scene); P14's fall landing rides the same call.
      dungeonCtx.reportActivity?.({ running: held(keys, 'Run') && moving, swimming: player.swimming, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed, fell: player.landedFallDistance });   // P13 sneak state + P14 fall landing
      // PlayerMotor.StartRestGroundedCheck (:184-194) reads the LIVE
      // grounded state; dungeonContext's `_grounded` is host-fed and
      // only dungeon.js:270 fed it, so in a world-hosted dungeon the
      // rest gate read the initialiser `true` for the whole session
      // and R mid-fall opened the window DFU refuses (TEXT.RSC 355).
      dungeonCtx.reportMotor?.(player.grounded, player.velY, cam.yaw);
    } else if (mode === 'interior') {
      // AUDIT 21 hosts F6 / AUDIT 23 (hosts-1): take the presenter back
      // from a dungeon we just left - re-register the mode ROUTER, not
      // the raw interior presenter, so a later walk-mode death still
      // reaches the exterior screen.
      setDeathPresenter(() => {
        if (mode === 'exterior' && prevDeathPresenter) return prevDeathPresenter();
        presentInteriorDeath();
      });
      // AUDIT 18: interior mode had NO fall-damage seam at all, behind
      // a flag that claimed single-storey shells could never fall far
      // enough to matter. That was false - interiors carry ladder
      // markers well past the BadFallDetected alert, and
      // IsBadInteriorModel's own comment is about "trapping player
      // upstairs". AcrobatMotor.CheckFallingDamage has exactly one
      // exemption and it is the outdoor water tile, never an interior.
      applyFallLanding(playerEntity, player.landedFallDistance, { sound: (id) => audio.playOneShot(id) });
      // AUDIT 18: and the interior owed the same world clock the exterior
      // and dungeon hosts run - inside a building, effects, diseases,
      // poisons, fatigue and skill advancement had all stopped.
      if (!overlayHeld) interiorTicker.tick(dt, {
        running: player.isRunning && !player.standing,   // AUDIT 23 (entity-2)
        swimming: false,
        jumped: player.jumped,   // C6
      });
    }
    cam.pos = player.eye;
    const useHeld = keys.has('KeyE');   // I2 departure: DFU activates on Mouse0 and E is AbortSpell - the pointer-parity slice owns the move
    const zNow = held(keys, 'ReadyWeapon');   // sheathe toggle (audit 2026-08-17)
    // C9: per-mode routing (the old unconditional dungeonCtx read
    // CRASHED on Z inside a building - dungeonCtx is null there).
    if (zNow && !zPrev) {
      if (mode === 'dungeon') dungeonCtx?.toggleSheath?.();
      else interiorWeapon.toggleSheath();
    }
    zPrev = zNow;
    if (useHeld && !latch.use && !overlayHeld) (mode === 'dungeon' ? tryExitDungeon : tryExit)();
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
    const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);

    if (mode === 'dungeon') {
      if (!overlayHeld) dungeonCtx.actions.update(dt);   // dungeon.js:219's `if (!held)` - a paused game advances no movers
      if (!overlayHeld) dungeonCtx.automapTick?.(dt, cam.pos, fwd);   // A1: the 5 Hz reveal probes ride the same gate
      dungeonCtx.flicker.tick(dt);
      renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
      renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));
      renderer.setPointLights(
        nearestLights(dungeonCtx.lights, cam.pos, 16, dungeonCtx.flicker.ranges),
        new Float32Array(DUNGEON_LIGHT_COLOR));
      renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
      for (const d of dungeonCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, dungeonCtx.texRemap);
      for (const d of dungeonCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);
      dungeonCtx.flatAnims.tick(dt);   // FA1
      renderer.drawBillboards(dungeonCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
      // AUDIT 17e F1: this MUST return true like every other exit of
      // the dungeon branch. Returning undefined let the host fall
      // through and run its whole exterior frame on top - the town
      // drawn over the dungeon, and in ?world the streaming recenter
      // fed dungeon-local coordinates.
      if (dungeonCtx.uiOverlayActive) { dungeonCtx.tickOverlay(dt); dungeonCtx.drawOverlay(canvas); return true; }   // U2b/U3: overlays gate the dungeon (AUDIT 18 F5: the overlay's own clock still runs)
      dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, anyMove(moveHeld(keys)), player.height);   // moveHeld: the collision-trigger input gate (verbatim)   // C8 foes + S3b clock + S4b missiles - internally gated, must run foes or not (trap spells fire in empty dungeons)
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
    renderer.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
    renderer.setPointLights(
      nearestLights(interiorCtx.lights, cam.pos, 16, interiorCtx.lights.map((l) => l.range)),   // per-light range (DaggerfallInterior.AddLight); a scalar drops the per-record switch
      new Float32Array(INTERIOR_LIGHT_COLOR));
    interiorCtx.actions.update(dt);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of interiorCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, interiorCtx.texRemap);
    for (const d of interiorCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, interiorCtx.texRemap);
    // C13: interior arrows fly and draw with the meshes; a new
    // interior (different ctx) drops the stale flights.
    if (_arrowsCtx !== interiorCtx) { interiorArrows.arrows.length = 0; _arrowsCtx = interiorCtx; }
    interiorArrows.update(dt);
    interiorArrows.draw(renderer, interiorCtx.texRemap);
    interiorCtx.flatAnims.tick(dt);   // FA1
    renderer.drawBillboards(interiorCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
    if (magic) {
      // M2: the armed click's cast + missile flight, on the interior's
      // own collider (the engine's mode-aware raycast reads it).
      magic.firePending([...cam.pos], eyeDir());
      magic.update(dt, player.pos);
      if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, new Float32Array([0, 1, 0]));
    }
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
    for (const ev of interiorWeapon.frame(dt)) {
      // AUDIT 23 (combat-2): the bow machine's frame-4 loose sound.
      if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
      if (ev !== 'hit') continue;
      if (weaponTypeForItem(interiorWeapon.playerWeapon.weapon) === WEAPON_TYPES.Bow) {
        if (removeOne(playerEntity.items, 131)) {
          drainInteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
          tallySwingSkills(playerEntity, interiorWeapon.playerWeapon.weapon);
          interiorArrows.fire(player.eye, eyeDir());
        }
        continue;
      }
      // "// Fatigue loss" - unconditional. envAttack hits the interior's
      // ACTION objects, not an enemy, so there is no hitEnemy to gate the
      // tally on: the swing costs its fatigue and trains nothing, which is
      // what DFU does on a miss.
      drainInteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
      envAttack(interiorCtx.actions, interiorCtx.collider, player.eye, eyeDir());
      // AUDIT 23 (C9) - WeaponManager.cs:423-424: an interior swing
      // never sets hitEnemy, so the no-enemy swing sound fires at the
      // hit frame (the rig's strike-entry whoosh is gone).
      audio.playOneShot(swingSoundFor(interiorWeapon.playerWeapon.weapon), 1.1);
    }
    interiorWeapon.draw();
    // AUDIT 21 (hosts lane, F7): THE HUD, in a building. drawHud lives inside
    // dungeonContext.drawFoes, which the interior arm never calls - so the
    // whole classic status bar vanished the moment you stepped through a door
    // and came back when you stepped out. Same call, same place in the order:
    // last, over the viewmodel, under the overlay.
    if (hudArt) {
      const _hfw = [-view[2], -view[10]];
      // X4: the Detect markers, interior arm. THE FOUR HOSTS RULE -
      // the feed is mounted here even though both pools are empty
      // today, so the seam is visible rather than a host silently
      // missing an effect. What an interior would contribute in DFU
      // is LOOT CONTAINERS: static interior NPCs are StaticNPC
      // components and are NOT in PlayerGPS's list at all (only
      // enemies and CIVILIAN MOBILE behaviours are, and the port has
      // neither indoors), so an empty scan in a shop is DFU's answer
      // too. FLAGGED: interior loot containers are the loot arc's -
      // when they land they plug into `loot` below and Detect
      // Treasure lights up indoors with no other change here.
      const _detected = detectFeed.tick(dt);
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1, dt,
        { detected: _detected, playerXZ: [player.pos[0], player.pos[2]],
          largeHud: largeHudOptions({ renderer, fetchBytes, palette }, playerEntity) });   // U45
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
    const _tradeSweep = (r) => {
      if (interiorOverlay?.done) { interiorOverlay = null; _identifySpell = null; }
      return r;
    };
    window.__tradeClick = (key) => {
      const [x, y, w, h] = TRADE_RECTS[key];
      return _tradeSweep(interiorOverlay?.click?.(x + w / 2, y + h / 2) ?? false);
    };
    window.__tradeSlot = (which, slot) => {
      const [x, y] = TRADE_RECTS[which === 'local' ? 'localList' : 'remoteList'];
      return _tradeSweep(interiorOverlay?.click?.(x + 30, y + 20 + slot * 38) ?? false);
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
    // string is the seam that was a FLAGGED null until this slice,
    // and a probe that bypassed it would prove nothing about it.
    /** G4 probe seams: drop whatever overlay is up, and move the one
     *  clock (a holiday is a DAY OF YEAR, so a probe cannot reach one
     *  by waiting). */
    window.__closeOverlay = () => { interiorOverlay = null; return true; };
    window.__setWorldMinutes = (m) => setWorldMinutes(m);
    /** G4: open ANY guild-service destination through the real
     *  dispatcher, at the Mages Guild by default - the four store
     *  arms all price off the guild's own faction id, so a probe that
     *  faked the guild would not be testing the thing that was
     *  broken. */
    window.__openGuildService = (destination, group = GUILD_GROUPS.MagesGuild, buildingFactionId = 0) => {
      const dict = townTalk?.factionDict ?? null;
      const guild = createGuildForGroup(group, buildingFactionId, dict);
      const memberships = (playerEntity.guildMemberships ??= {});
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
      const memberships = (playerEntity.guildMemberships ??= {});
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
     *  pricing with - the guildFactionId in particular, which was the
     *  FLAGGED null this slice closed. */
    window.__tradeOverlay = () => JSON.stringify(interiorOverlay instanceof NativeTradeWindow ? {
      trade: true,
      mode: interiorOverlay.mode,
      remote: interiorOverlay.remoteList().map((i) => ({
        name: i.name, value: i.value, identified: !!i.isIdentified,
        soul: i.trappedSoulType === undefined ? undefined : i.trappedSoulType,
      })),
      local: interiorOverlay.localList().length,
      priceCtx: (() => { const c = interiorOverlay.hooks.priceCtx(); return { quality: c.quality, holidayId: c.holidayId, guildFactionId: c.guildFactionId }; })(),
      cost: interiorOverlay.cost(),
    } : null);
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
    } : null);
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
    // One read that answers "is a window up, and which" for the two
    // modes THIS module owns. The exterior's overlay slot belongs to
    // world.js (townTalk) - a probe reads that through __talk().
    window.__overlayKind = () => (mode === 'dungeon'
      ? (dungeonCtx?.overlayWindow?.()?.constructor?.name ?? null)
      : (interiorOverlay?.constructor?.name ?? null));
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
  bindCursorToggle(canvas, () => (mode === 'dungeon' ? !!dungeonCtx?.uiOverlayActive : !!interiorOverlay), actionOf);
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
    if (e.button === 2) modalAttackSink()?.(0, 0, false);
  });
  addEventListener('mousedown', (e) => {
    if (e.button === 2) modalAttackSink()?.(0, 0, true);
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
   *  Deliberately absent: quickSave/quickLoad. Interior saving really
   *  is unbuilt (the composer saves from the exterior and the dungeon
   *  contexts), and the pause window's SAVE button already answers
   *  DFU's cannot-save line rather than pretending. */
  const mountInterior = (w) => { if (w) interiorOverlay = w; };

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
    const memberships = (playerEntity.guildMemberships ??= {});
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
    advanceMinutes: (n) => interiorTicker.advance(n),
    // TickRest :379 - QuestMachine.Instance.Tick() rides the same
    // sub-tick as the clock, UNPACED (DFU calls the machine directly,
    // not through QuestMachine.Update's ticksPerSecond timer). This
    // host's ordinary quest tick is gated on "no overlay up", so
    // without this a rested night ran none at all.
    tickQuests: () => questBridge?.machine?.tick?.(),
    enemiesNearby: () => false,   // this host mounts no foe pool
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
    // PopToHUD, before RaiseSkills can want the slot for a level-up
    // screen. The U24 identity guard: a window that dispatches to
    // another must not be nulled by its OWN onClose.
    onClose: () => { if (interiorOverlay?.isRestWindow) interiorOverlay = null; },
    say,
    onLevelUp: () => {
      say('You have gained a level!');
      if (!interiorOverlay) interiorOverlay = new LevelUpScreen(playerEntity);
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
      if (w.done && interiorOverlay === w) { interiorOverlay = null; _identifySpell = null; }   // X7: the spell latch dies with its window
    },
    togglePause() {
      if (!pauseArtLoaded()) return;
      // I3: the SAVE button answers DFU's cannot-save line here.
      openPauseFlow((w) => { interiorOverlay = w; }, {
        savingPrevented: () => true,
        exitToMenu: exitToTitleMenu,
        textLines: (id) => townTalk?.lines?.(id) ?? null,
      });
    },
    toggleCharSheet() { mountInterior(host.makeCharSheet?.()); },
    toggleInventory() { mountInterior(host.makeInventory?.()); },
    // M2/I2: the CastSpell action opens the spellbook
    // (GameManager.cs:550-553); the cast itself is the attack click.
    toggleSpellbook() { if (magic) mountInterior(makeSpellbookWindow()); },
    toggleLogbook() { mountInterior(host.makeJournal?.('activeQuests')); },
    toggleNotebook() { mountInterior(host.makeJournal?.('notebook')); },
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
      const d = restDecision({
        enemiesNearby: false,   // no foe pool in a building interior
        swimming: false,        // nor water
        grounded: startRestGroundedCheck(!!player.grounded, player.pos, interiorCtx?.collider),
      });
      if (d.kind !== 'rest') {
        if (d.kind === 'blocked') return;   // a racial override says nothing at all
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
    if (v) interiorOverlay.click?.(v[0], v[1], e.button === 2);   // I4: the remove gesture rides the button
    if (interiorOverlay?.done) { interiorOverlay = null; _identifySpell = null; }   // X7: the spell latch dies with its window
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
    const at = () => {
      const r = canvas.getBoundingClientRect();
      return pointToNative(nativeMetrics(canvas),
        (e.clientX - r.left) * (canvas.width / r.width),
        (e.clientY - r.top) * (canvas.height / r.height));
    };
    if (mode === 'dungeon' && dungeonCtx?.uiOverlayActive) {
      const v = at();
      dungeonCtx.overlayHover?.(v ? v[0] : -1, v ? v[1] : -1);
      return true;
    }
    if (mode !== 'interior' || !interiorOverlay?.hover) return false;
    const v = at();
    interiorOverlay.hover(v ? v[0] : -1, v ? v[1] : -1);
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
      if (!listPickerArtLoaded() || interiorOverlay) return false;
      const bundles = dispellableBundles(liveBundles(playerEntity));
      if (!bundles.length) { townTalk?.say?.('You have no magic to dispel.'); return true; }
      const win = new ListPickerWindow({
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
          interiorOverlay = null;
        },
        onCancel: () => { interiorOverlay = null; },
      });
      interiorOverlay = win;
      return true;
    },
    openIdentifyWindow({ chance, refund } = {}) {
      if (!tradeArtLoaded() || interiorOverlay) return false;
      // The magicka the window will charge on the Identify click IS
      // the cost the effect just refunded (Identify.cs:74's
      // IdentifySpellCost = cost.spellPointCost) - the refund and the
      // charge are the same number, which is what makes the round trip
      // free when the player closes the window without identifying.
      _identifySpell = { chance: chance ?? 0, cost: refund ?? 0 };
      const win = openTradeWindow({ items: [] }, interiorBuilding ?? {}, 'Identify');
      win.hooks.usingIdentifySpell = true;
      interiorOverlay = win;
      return true;
    },
    startInDungeon,
    /** B1: CreateFoe's TryPlacement, this host's two INSIDE arms
     *  (CreateFoe.cs:194-211). The dungeon arm runs PlaceFoeFreely
     *  over the dungeon collider and stands the foe through the
     *  context's one build chain; false = retry next machine tick,
     *  verbatim. The INTERIOR arm answers false unconditionally -
     *  FLAGGED: this host has no interior enemy pool (the Q4-v flag on
     *  the scene mount above), so a wave pending inside a building
     *  waits, and leaving invalidates it exactly as DFU's
     *  OnTransitionExterior handler does. */
    tryPlaceQuestFoe(handle) {
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
      cam.pos = player.eye;
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
    forceExitToExterior() {
      const wasInside = mode !== 'exterior';
      if (interiorCtx) {
        teardownQuestFlats();
        interiorCtx.destroy();
        interiorCtx = null; interiorBuilding = null; interiorOverlay = null;
      }
      if (dungeonCtx) { teardownDungeonQuestFlats(); dungeonCtx.destroy(); dungeonCtx = null; dungeonLoc = null; }
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
    hover,
    wheel,
    /** A mode-owned window is up (the hosts' look gate reads this
     *  alongside townTalk.overlayActive). */
    get overlayHeld() { return (mode === 'interior' && !!interiorOverlay) || (mode === 'dungeon' && !!dungeonCtx?.uiOverlayActive); },
    get transitioning() { return transitioning; },
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
      if (mode === 'interior') { interiorOverlay = win; return true; }
      if (mode === 'dungeon' && dungeonCtx?.showOverlay) return dungeonCtx.showOverlay(win);
      return false;
    },
    // wave 21: the host asks whether the box it pushed is still the
    // one in the slot before it stacks another onto it
    get questOverlay() {
      if (mode === 'interior') return interiorOverlay;
      return mode === 'dungeon' ? (dungeonCtx?.overlayWindow?.() ?? null) : null;
    },
    tryEnter,
    frame,
    installShotProbes,
  };
}
