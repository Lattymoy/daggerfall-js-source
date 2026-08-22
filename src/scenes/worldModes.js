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
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { pickActivatable, worldAabb, activationTargets } from '../player/activate.js';
import { transferAll, removeOne, addItem } from '../systems/inventory.js';
import { isEquipped, unequipSlot } from '../systems/equip.js';   // AUDIT 17e F4: worn gear is not merchandise
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { createPlayerTicker , endRunToTitleMenu } from './shared.js';   // AUDIT 18: the interior host's world clock
import { buildInteriorContext } from './interiorContext.js';
import { buildDungeonContext } from './dungeonContext.js';
import { DOOR_TYPE } from '../world/meshReader.js';
import { getGroundArchive } from '../world/climateSwaps.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_AMBIENT, INTERIOR_NIGHT_AMBIENT, INTERIOR_LIGHT_COLOR, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { isNight } from '../world/worldClock.js';   // AUDIT 23 (C12)
import { worldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C12): the one clock
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5)
import { maxFatigue } from '../systems/statMods.js';   // AUDIT 23 (C5)
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective } from '../world/mat4.js';
import { routeKey, overlayAction } from '../ui/input.js';
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';
import { ArrowFlight } from '../combat/arrowFlight.js';   // C13: visible interior arrows
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS } from './hostCombat.js';   // AUDIT 21 hosts F8: the swing law, shared with the dungeon and the guards
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { audio } from '../systems/audio.js';
import { SpellbookWindow, knownSpells } from '../ui/inventory.js';   // M2
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { SOUND, swingSoundFor } from '../systems/soundClips.js';   // AUDIT 23: the bow loose + no-enemy swing sounds
import { fetchBytes, applyMotorEffectFlags, applyFallLanding, ridePlatform } from './shared.js';
import { setDeathPresenter, hurtPlayer } from '../characters/playerEntity.js';   // AUDIT 21 hosts F6; AUDIT 23 C5 fatal collapse
import { DeathScreen } from '../ui/inventory.js';   // AUDIT 21 hosts F6: dying in a building
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the HUD vanished inside buildings
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
// E2: the shop shelf browse/buy layer (node-pure laws in shopStock.js)
import { ChoiceWindow } from '../ui/talkWindow.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from '../ui/text.js';
import { hudScale } from '../ui/hud.js';
import { isShop, isRepairShop, stockShopShelf, calculateCost, calculateTradePrice, regionPriceAdjustment, SHOP_BUYS_GROUPS, shopBuysItem } from '../systems/shopStock.js';
import { LevelUpScreen } from '../ui/charsheet.js';   // AUDIT 21 hosts F3: levelling in a building
import { NativeTradeWindow, preloadTradeArt, tradeArtLoaded } from '../ui/nativeTrade.js';   // U8c
// U23: the static-NPC seam and the guild service popup.
import { STATIC_NPC_ACTIVATION_DISTANCE } from '../systems/talk.js';
import { staticNpcRoute, showsJoinButton, serviceAccess, onPushEffects } from '../systems/guildServiceFlow.js';
import { npcServiceKind, freeHealing, freeMagickaRecharge } from '../systems/guildServices.js';
import { createGuildForGroup } from '../systems/guildVariants.js';
import { membershipOf, joinGuild, joinDecision } from '../systems/guilds.js';
import { ensureFactionRep } from '../systems/factionRep.js';
import { dateFromClassicMinutes } from '../systems/gameDate.js';
import { serviceDestination } from '../systems/guildServiceFlow.js';
import { buildTrainingFlow, buildDonationFlow, buildCureDiseaseFlow } from '../ui/guildServiceWindows.js';
import { preloadListPickerArt } from '../ui/listPicker.js';
import { getTitle } from '../systems/guilds.js';
import { getDivine, DIVINES } from '../systems/guildVariants.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { GuildServiceWindow, preloadGuildServiceArt, guildServiceArtLoaded } from '../ui/guildServiceWindow.js';
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
import { SITE_TYPES } from '../systems/quest/place.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { positionHash } from './questBridge.js';
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
        hurtPlayer(playerEntity, playerEntity.health);
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
  const interiorTicker = createPlayerTicker(playerEntity, {
    onExhausted: onExhaustedInterior,   // AUDIT 23 (C5)
    say: (msg) => console.log('[player]', msg),
    onLevelUp: () => {
      console.log('[player] You have gained a level!');
      if (!interiorOverlay) interiorOverlay = new LevelUpScreen(playerEntity);
    },
  });
  const { canvas, renderer, player, cam, keys, latch, blocks, pipeline, doorTargets, baseCollider, voxelfolk = false, piece = 0, paint = false, buildingDataForDoor = null, townTalk = null, magic = null, spellsByIndex = null, questBridge = null, questSceneCtx = null, npcSession = null } = host;   // Q4-v: the quest bridge + the host's scene-context closure ({mapId, locationIndex})   // M2: the host's cast engine + SPELLS.STD getter ride in   // host.foes: C8 E1 rigged class enemies in dungeons; buildingDataForDoor: E2's shop identity closure; townTalk: U23's static-NPC seam
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
  // say -> console FLAGGED: the interior HUD-text layer pends its arc.
  const interiorWeapon = createWeaponRig({
    spellArmed: () => magic?.spellArmed() ?? false,   // M2
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say: (l) => console.warn('[interior]', l),
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
    preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11 parchment for its boxes
    preloadListPickerArt({ renderer, fetchBytes, palette });   // U24: PICK00I0 for the training skill list
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
  // FLAGGED (Port-Ledger Q4-v): quest FOES pend the interior enemy
  // host - standFoe is absent, so the walk skips the stand and the law
  // modules idle; the dungeon context's own mount pends with it.
  let questFlats = [];
  function standQuestFlat(archive, record, position, behaviour, staticNpcFactionId = null) {
    const ctx = interiorCtx;   // capture: an async fill must not cross interiors
    if (!ctx) return null;
    // flatPosition is already scene units with -y (the Place marker
    // law); parent it exactly as the interior's own flats are.
    const [x, y, z] = ctx.parentPt(position.x, position.y, position.z);
    const stand = { ctx, archive, record, x, y, z, marker: position, width: 0, height: 0, batch: null, active: true, dead: false, behaviour };
    (async () => {
      const t = await getTexture(archive);
      if (!t || record >= t.recordCount || stand.dead || interiorCtx !== ctx) return;
      uploadRecord(archive, record);
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      stand.width = size.w; stand.height = size.h;
      stand.batch = renderer.createBillboardBatch(archive, record, size, [[x, y, z]]);
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
        else if (stand.batch && interiorCtx === ctx) ctx.billboardBatches.push(stand.batch);
      },
      destroy() {
        if (stand.dead) return;
        stand.dead = true;
        unhook();
        if (stand.batch) { renderer.destroyBatch(stand.batch); stand.batch = null; }
        const i = questFlats.indexOf(stand);
        if (i >= 0) questFlats.splice(i, 1);
      },
    };
    questFlats.push(stand);
    return stand.host;
  }
  const questAdapter = {
    // PlayerGPS.CurrentMapID through the host's scene-context closure.
    currentMapId: () => questSceneCtx?.()?.mapId ?? 0,
    findBehaviours: () => sceneBehaviours(),
    loadInProgress: () => false,   // the modal host builds after a restore completes
    standNPC: ({ person, flatData, position, behaviour }) =>
      standQuestFlat(flatData.archive, flatData.record, position, behaviour, person?.factionId ?? null),
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
    if (!questBridge || !interiorCtx || !interiorBuilding?.buildingKey) return;
    questBridge.mountScene(questAdapter, SITE_TYPES.Building, interiorBuilding.buildingKey);
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
      interiorOverlay = new NativeTradeWindow({
        shelfItems: () => shelf.items,
        sellables: () => (playerEntity.items ?? []).filter((it) => shopBuysItem(b.buildingType, it) && !isEquipped(it)),   // AUDIT 17e F4
        buy: (it) => doBuy(shelf, it),
        sell: (it) => doSell(shelf, it),
        gold: () => goldAmount(playerEntity),
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        entity: playerEntity,   // AUDIT 17f: icons address for the wearer's morphology
        shopName: b.name ?? '',
      });
      return;
    }
    showShelfList(shelf, 0);
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

  function openStaticNpc(pn) {
    // Q4-v: PlayerActivate's questor half - EVERY static-NPC click
    // stamps LastNPCClicked before the routing decides what opens (the
    // Person questor sweep rides machine.setLastNPCClicked).
    questBridge?.clickNpc(pn, { ...(questSceneCtx?.() ?? {}), buildingKey: interiorBuilding?.buildingKey ?? 0 });
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
    // TK-iv: THE QUESTOR DOOR. TalkToStaticNPC's first act, before the
    // NPC type is even set (:758-770): an NPC the work pool is
    // carrying, or a castle NPC who wins its one 25% roll, opens the
    // quest OFFER instead of the conversation. Children are excluded
    // from both arms.
    const talk = npcSession?.talkToStaticNPC(
      { data: pn, isChildNPC: !!pn.isChildNPC, displayName: pn.displayName ?? '' },
      { menu: true });
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
    //   merchant  - DaggerfallMerchantServicePopupWindow (sell /
    //               banking / repair / tavern rooms). The tavern and
    //               banking arms need the rest window's room booking
    //               and a bank that does not exist yet.
    //   witchesCoven - DaggerfallWitchesCovenPopupWindow.
    // Both fall through to TALK, which is DFU's own last arm for an
    // NPC with no special handling, so nothing is inert.
    console.log('[interior] static NPC route:', route.kind, route.service ?? '');
    townTalk?.say?.('You get no response.');
  }

  function openGuildService(pn, route) {
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
      onTalk: () => townTalk?.say?.('You get no response.'),   // FLAGGED: TalkToStaticNPC pends the static-NPC conversation
      onService: () => {
        const access = serviceAccess(guild, membershipOf(memberships, guild), service);
        if (!access.allowed) {
          return { rows: access.textId ? rows(access.textId) : [access.text] };
        }
        // U24: the three the port can perform. Every other arm is
        // FLAGGED by name in guildServiceFlow.SERVICE_DESTINATION.
        const flow = openServiceFlow(serviceDestination(service), { guild, memberships, store, rows, route });
        if (!flow) return { rows: ['That service is not available yet.'] };
        interiorOverlay = flow;
        return { dispatched: true };
      },
      onClose: () => { if (interiorOverlay === win) interiorOverlay = null; },
    });
    interiorOverlay = win;
  }

  /** DoGuildService's three built arms (U24). Each returns a
   *  ServiceFlowWindow, or null for a destination that does not exist
   *  yet. `onClose` uses the same identity guard as the popup's. */
  function openServiceFlow(destination, { guild, memberships, store, rows, route }) {
    if (!destination) return null;
    const membership = membershipOf(memberships, guild);
    const b = interiorBuilding;
    const closeSelf = () => { if (interiorOverlay === flow) interiorOverlay = null; };
    const now = () => interiorTicker.classicMinutes;   // already CLASSIC minutes (AUDIT 21 F2)
    const godName = guild.divine ?? '';
    let flow = null;
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
      // E2: the building's identity (type/quality/key/name) rides the
      // host's merge closure; shops warm the browse font.
      interiorBuilding = buildingDataForDoor?.(hit) ?? null;
      ensureInteriorWindowArt();   // U23: every interior can open a window now
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
    // Q4-v: quest stands activate like StaticNPCs (PlayerActivate's
    // quest-resource arm; the same 256-unit reach) - a click routes
    // QuestResourceBehaviour.DoClick.
    questFlats.forEach((s, i) => {
      if (!s.width || !s.active || s.dead) return;
      targets.push({
        key: `questflat:${i}`,
        aabb: { min: [s.x - s.width / 2, s.y, s.z - s.width / 2], max: [s.x + s.width / 2, s.y + s.height, s.z + s.width / 2] },
        distance: STATIC_NPC_ACTIVATION_DISTANCE,
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
          s.behaviour?.doClick();
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
      interiorCtx.actions.activate(key);
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
      player.collider = ctx.collider;
      const spawn = ctx.startSpawn();   // ONE source: verbatim MovePlayerToMarker + FixStanding in the context
      player.spawn(spawn[0], spawn[1], spawn[2]);
      cam.pos = player.eye;
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
      dungeonCtx.actions.activate(key);
      return true;
    }
    // Verbatim PositionPlayerToDungeonExit; the camera faces the normal.
    const landing = dungeonEntranceLanding(dungeonReturn.candidates.map((e) => e.door));
    dungeonCtx.destroy();
    dungeonCtx = null;
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
    const jumpHeld = keys.has('Space');
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
    if (!overlayHeld) questBridge?.tick(dt);
    const inputHeld = paralyzed || overlayHeld;
    const crouchHeld = keys.has('KeyX');
    const moving = !inputHeld && (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD'));
    // Platform riding (the DFU MoveWithMovingPlatform shape) was wired
    // ONLY into the standalone ?dungeon scene, so a world/exterior
    // hosted dungeon dropped the mover delta and the lift penetrated
    // the capsule. The delta applies BEFORE the player's own move.
    if (!overlayHeld) ridePlatform(player, mode === 'dungeon' ? dungeonCtx?.actions : interiorCtx?.actions);
    // Audit F3: crouch stays live while paralyzed (DFU gates movement/jump only)
    player.update(dt, inputHeld ? { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, crouch: crouchHeld && !latch.crouch } : {
      forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
      strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
      run: keys.has('ShiftLeft'),
      sneak: keys.has('AltLeft'),   // P15: DFU's default Sneak binding (LeftAlt), held
      jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
      up: jumpHeld || keys.has('PageUp'),
      down: keys.has('PageDown'),
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
        standingStill: !keys.has('KeyW') && !keys.has('KeyS') && !keys.has('KeyA') && !keys.has('KeyD'),
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
      dungeonCtx.reportActivity?.({ running: keys.has('ShiftLeft') && moving, swimming: player.swimming, jumped: player.jumped, movingLessThanHalfSpeed: player.movingLessThanHalfSpeed, fell: player.landedFallDistance });   // P13 sneak state + P14 fall landing
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
    const useHeld = keys.has('KeyE');
    const zNow = keys.has('KeyZ');   // ReadyWeapon: sheathe toggle (audit 2026-08-17)
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

    const proj = perspective(fieldOfView(), canvas.clientWidth / canvas.clientHeight, 0.05, 500);
    const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);

    if (mode === 'dungeon') {
      if (!overlayHeld) dungeonCtx.actions.update(dt);   // dungeon.js:219's `if (!held)` - a paused game advances no movers
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
      dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'), player.height);   // moveHeld: the collision-trigger input gate (verbatim)   // C8 foes + S3b clock + S4b missiles - internally gated, must run foes or not (trap spells fire in empty dungeons)
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
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1);
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
      interiorOverlay.tick?.(dt);
      if (_shopFont) interiorOverlay.draw(renderer, canvas, _shopFont, hudScale(canvas.width, canvas.height));
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
      remote: interiorOverlay.hooks?.shelfItems()?.length,
      local: interiorOverlay.hooks?.sellables()?.length,
      lastPrice: interiorOverlay.lastPrice,
      lines: interiorOverlay.lines, options: interiorOverlay.options?.filter((o) => o.label).map((o) => o.label),
    } : null);
    window.__dungeon = () => dungeonCtx ? JSON.stringify({
      exits: dungeonCtx.exitDoors.map((d) => ({ pos: doorWorldPosition(d).map((v) => +v.toFixed(2)), normal: doorWorldNormal(d).map((v) => +v.toFixed(3)) })),
      actions: dungeonCtx.actions.objects.size,
    }) : null;
    window.__dungeonExit = () => tryExitDungeon();
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

  addEventListener('keydown', (e) => {
    // E2: an open shop overlay owns the keys (the townTalk pattern:
    // done-then-clear so chained windows survive the keydown).
    if (mode === 'interior' && interiorOverlay) {
      const w = interiorOverlay;
      // AUDIT 21 (hosts lane, F3): the same widening townTalk needed. This
      // passed the raw key CODE, which is what a ChoiceWindow wants and is
      // useless to a LevelUpScreen - it needs up/down and plus/minus. So a
      // level-up in a building could not be driven even once it was opened.
      if (w.isChoiceWindow) w.input(e.code, e);
      else {
        const a = overlayAction(e);
        if (a) w.input(a, e);
        else w.input(e.code, e);
      }
      if (w.done && interiorOverlay === w) interiorOverlay = null;
      e.preventDefault();
      return;
    }
    // M2: casting INSIDE a building - the spellbook (Backspace) and
    // the cast key, riding the interior overlay channel.
    if (mode === 'interior' && magic) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const sbi = typeof spellsByIndex === 'function' ? spellsByIndex() : spellsByIndex;
        if (!interiorOverlay && sbi) {
          interiorOverlay = new SpellbookWindow(knownSpells(playerEntity, sbi), playerEntity, {
            ready: (sp) => magic.readySpell(sp),
            castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
          });
        }
        return;
      }
      if (e.code === 'KeyC') {
        magic.castInput([...cam.pos], eyeDir());
        return;
      }
    }
    // The input map (ui/input.js) owns all bindings.
    if (mode !== 'dungeon' || !dungeonCtx) return;
    if (routeKey(e, dungeonCtx, () => ({ eye: cam.pos, dir: eyeDir() }), (p) => player.spawn(p[0], p[1], p[2]))) e.preventDefault();   // P14 (AUDIT 23): a load clears motion state, same applier as dungeon.js
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
      if (vd) dungeonCtx.overlayClick?.(vd[0], vd[1]);
      return true;   // an open window withholds the pointer lock, as in dungeon.js
    }
    // The guard is on the WINDOW, not on its click method: an open
    // window with no click handler must still withhold the pointer
    // (DFU's top window consumes the click), or a pointerdown escapes
    // to requestLook and grabs pointer lock from under the menu.
    if (mode !== 'interior' || !interiorOverlay) return false;
    const v = pointToNative(nativeMetrics(canvas), px, py);
    if (v) interiorOverlay.click?.(v[0], v[1]);
    if (interiorOverlay?.done) interiorOverlay = null;
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

  return {
    get mode() { return mode; },
    startInDungeon,
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
      if (dungeonCtx) { dungeonCtx.destroy(); dungeonCtx = null; }
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
    showQuestOverlay(win) { if (mode === 'interior') { interiorOverlay = win; return true; } return false; },
    // wave 21: the host asks whether the box it pushed is still the
    // one in the slot before it stacks another onto it
    get questOverlay() { return mode === 'interior' ? interiorOverlay : null; },
    tryEnter,
    frame,
    installShotProbes,
  };
}
