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
import { createPlayerTicker } from './shared.js';   // AUDIT 18: the interior host's world clock
import { buildInteriorContext } from './interiorContext.js';
import { buildDungeonContext } from './dungeonContext.js';
import { DOOR_TYPE } from '../world/meshReader.js';
import { getGroundArchive } from '../world/climateSwaps.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_AMBIENT, INTERIOR_LIGHT_COLOR, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective } from '../world/mat4.js';
import { routeKey, overlayAction } from '../ui/input.js';
import { createWeaponRig, envAttack } from '../combat/weaponRig.js';
import { ArrowFlight } from '../combat/arrowFlight.js';   // C13: visible interior arrows
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS } from './hostCombat.js';   // AUDIT 21 hosts F8: the swing law, shared with the dungeon and the guards
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { audio } from '../systems/audio.js';
import { fetchBytes, applyMotorEffectFlags, applyFallLanding, ridePlatform } from './shared.js';
import { setDeathPresenter } from '../characters/playerEntity.js';   // AUDIT 21 hosts F6
import { DeathScreen } from '../ui/inventory.js';   // AUDIT 21 hosts F6: dying in a building
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
let _charT0 = (typeof performance !== 'undefined' ? performance.now() : 0);
let _charAnimMode = 'idle'; // in-engine character animation: idle | walk | off (window.__anim)

// Dungeon water surface (R11 values, mirroring the dungeon scene).
const DUNGEON_WATER_COLOR = [1, 1, 1, 0.82];
const DUNGEON_WATER_SCROLL = 0.05;

export function createWorldModes(host) {
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
   *  constant's home). Exhaustion above ground is the ticker's business, so
   *  this only takes the points. */
  const drainInteriorFatigue = (n) => {
    if (n > 0) playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
  };
  const presentInteriorDeath = () => {
    if (!(interiorOverlay instanceof DeathScreen)) interiorOverlay = new DeathScreen();
  };
  setDeathPresenter(presentInteriorDeath);
  const interiorTicker = createPlayerTicker(playerEntity, {
    say: (msg) => console.log('[player]', msg),
    onLevelUp: () => {
      console.log('[player] You have gained a level!');
      if (!interiorOverlay) interiorOverlay = new LevelUpScreen(playerEntity);
    },
  });
  const { canvas, renderer, player, cam, keys, latch, blocks, pipeline, doorTargets, baseCollider, voxelfolk = false, piece = 0, paint = false, buildingDataForDoor = null, townTalk = null } = host;   // host.foes: C8 E1 rigged class enemies in dungeons; buildingDataForDoor: E2's shop identity closure; townTalk: U23's static-NPC seam
  const { getGpuMesh, cpuModels, getTexture, uploadRecord, arch, palette } = pipeline;

  let mode = 'exterior';
  let zPrev = false;   // ReadyWeapon (Z) edge state
  // C9: the INTERIOR mode's FP weapon (the dungeon context owns its
  // own audited copy; the host rule wants the weapon in every mode).
  // say -> console FLAGGED: the interior HUD-text layer pends its arc.
  const interiorWeapon = createWeaponRig({
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
        { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, palette },
        // DaggerfallInterior.IsBadInteriorModel (:530-548) keys the
        // 31000-overlap repair on EntryDoor.blockIndex, which
        // RMBLayout.cs:848 mints as blockData.Index. The literal 0 is
        // not a key in the table, so the repair could never fire when
        // a building was entered from ?world / ?exterior - the same
        // building reached through ?interior=NAME:REC omitted it.
        hit.dfBlock, hit.dfBlock.index, hit.recordIndex, hit.climateBase, hit.season,
        hit.door.matrix, { voxelfolk, piece, paint });
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
      if (!pn.width) return;
      targets.push({ key: `person:${i}`, aabb: personAabb(pn), distance: STATIC_NPC_ACTIVATION_DISTANCE });
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
    interiorCtx.destroy();
    interiorCtx = null;
    interiorBuilding = null;   // E2: the identity + overlay leave with the interior
    interiorOverlay = null;
    player.collider = baseCollider();
    player.spawn(landing[0], landing[1], landing[2]);
    mode = 'exterior';
    console.log('exterior: returned at door');
    return true;
  }

  async function tryEnterDungeon(hit, entries) {
    const dfLocation = hit.dfLocation;
    if (!dfLocation || !dfLocation.hasDungeon) return false;
    transitioning = true;
    try {
      const ctx = await buildDungeonContext(
        { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, palette },
        dfLocation, blocks, dfLocation.climate.climateType, { foes: host.foes, playerClass: host.playerClass, playerSpell: host.playerSpell, playerWeapon: host.playerWeapon });
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
      // speed): the swim toggle (center + 50*GS - 0.95 below the
      // block water surface), the Levitate/waterWalking consumers.
      const surf = dungeonCtx.waterSurfaceYAt(player.pos[0], player.pos[2]);
      player.waterSurfaceY = surf;
      player.swimming = surf != null && player.pos[1] + 0.9 + 50 * 0.025 - 0.95 < surf;
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
      setDeathPresenter(presentInteriorDeath);   // AUDIT 21 hosts F6: take the presenter back from a dungeon we just left
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
      if (!overlayHeld) interiorTicker.tick(dt, { running: player.running, swimming: false });
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

    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
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
      renderer.drawBillboards(dungeonCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
      // AUDIT 17e F1: this MUST return true like every other exit of
      // the dungeon branch. Returning undefined let the host fall
      // through and run its whole exterior frame on top - the town
      // drawn over the dungeon, and in ?world the streaming recenter
      // fed dungeon-local coordinates.
      if (dungeonCtx.uiOverlayActive) { dungeonCtx.tickOverlay(dt); dungeonCtx.drawOverlay(canvas); return true; }   // U2b/U3: overlays gate the dungeon (AUDIT 18 F5: the overlay's own clock still runs)
      dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));   // moveHeld: the collision-trigger input gate (verbatim)   // C8 foes + S3b clock + S4b missiles - internally gated, must run foes or not (trap spells fire in empty dungeons)
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
    renderer.setLighting(new Float32Array(INTERIOR_AMBIENT), 0);
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
    renderer.drawBillboards(interiorCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
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
    }
    interiorWeapon.draw();
    // E2: the shop browse overlay draws above everything; font-less
    // never traps the motor (the townTalk law).
    if (interiorOverlay) {
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
      : mode === 'interior' ? interiorWeapon.attackInput
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
    // The input map (ui/input.js) owns all bindings.
    if (mode !== 'dungeon' || !dungeonCtx) return;
    if (routeKey(e, dungeonCtx, () => ({ eye: cam.pos, dir: eyeDir() }), (p) => { player.pos[0] = p[0]; player.pos[1] = p[1]; player.pos[2] = p[2]; })) e.preventDefault();
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

  return {
    get mode() { return mode; },
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
    get transitioning() { return transitioning; },
    get interiorCtx() { return interiorCtx; },
    get dungeonCtx() { return dungeonCtx; },
    tryEnter,
    frame,
    installShotProbes,
  };
}
