// THE QUEST MACHINE (Q2) - QuestMachine.cs, the engine core. Hosts
// the live quest table, the action-template registry (the brute-force
// GetActionTemplate scan), the scheduled-invoke queue, and the tick:
// invoke scheduled quests, update the active ones, tombstone the
// completed, expire tombstones after one in-game week (604800 classic
// seconds). DFU ticks at 10Hz of REAL time while clocks ride WORLD
// time - the host calls tick() on its own cadence (TICKS_PER_SECOND
// is the law to pace by) and injects the world clock as nowSeconds.
//
// deps (all injectable, every one a routed system):
//   nowSeconds()               - world time in DFU year-zero seconds
//                                (DaggerfallDateTime.ToSeconds - the
//                                host injects CLASSIC_EPOCH_IN_SECONDS
//                                + classicMinutes*60 so DailyFrom's
//                                hour-of-day and PlaySound's cadence
//                                read the SAME calendar as DFU's
//                                WorldTime.Now; clocks use deltas, so
//                                the base change is invisible to them)
//   getQuestSourceLines(name)  - quest source by name (the vendored
//                                pack through the host's data seam;
//                                the QuestListsManager stand-in that
//                                StartQuest schedules through)
//   showPopup(quest, message)  - the parchment popup (Q4 wires the
//                                real message box; tests capture)
//   showPrompt(quest, message, respond) - Prompt's yes/no box (Q4
//                                wires; respond(true) = Yes)
//   changeReputation(factionId, amount, propagate) - factionRep's
//                                ChangeReputation (Q4 wires). The
//                                quest lane passes propagate=TRUE
//                                (Quest.cs:385): allies +amount/2,
//                                enemies -amount/2 and the faction-
//                                tree spread per PersistentFactionData
//                                - factionRep.js carries the same
//                                default-false flag, so dropping the
//                                argument silently loses the spread
//                                (Q2b-VERIFY finding)
//   addQuestTopics(quest)      - TalkManager.AddQuestTopicWithInfoAndRumors,
//                                fired between quest.start() and the
//                                live table (Q4 wires; the tombstone's
//                                removeQuestInfoTopics is its scrub)
//
// Q3-i, THE WORLD SEAM (deps.world - a running host wires it from its
// MapsFile/BlocksFile instances and player state; absent = headless,
// every Place pends its site LOUDLY and the corpus gate stands):
//   maps                       - the MapsFile instance (getRegion /
//                                getLocation / getRmbBlockName /
//                                readLocationIdFast / regionCount)
//   getBlock(blockName)        - BlocksFile.getBlockByName
//   currentLocation()          - the player's loaded dfLocation | null
//   currentRegionIndex() / currentLocationIndex()
//   currentRegionName()        - (error text only)
//   isPlayerInLocationRect()   - PlayerGPS.IsPlayerInLocationRect
//   playerInside()             - { building: {buildingKey,
//                                buildingType, factionId} } |
//                                { dungeon: {dungeonType} } | null
//   isHouseOwned(buildingKey)  - DaggerfallBankManager (default false)
//   buildingNameOpts()         - generateBuildingName's resolver
//                                bundle (nameBank/ruler/faction...)
//   playerPixel()              - the player's current MAP PIXEL
//                                (TravelTimeCalculator.GetPlayerTravel-
//                                Position incl. its on-ship arm; the
//                                quest clock's travel arm starts here)
//   discoverLocation(regionName, locationName) - PlayerGPS.DiscoverLocation
//   addNote(text)              - the notebook (RevealLocation readmap)
//   respawnPlayerAtSite(place) - TeleportPc's transport: resolve the
//                                site's location and begin the
//                                respawn (C# GetLocation +
//                                RespawnPlayer); false = unresolved,
//                                the action retries (Q4-iii)
//   isRespawning()             - PlayerEnterExit.IsRespawning
//   setPlayerScenePosition(position) - the arrival tick's marker
//                                landing ({x,y,z} scene units)
//   mountCurrentSiteQuestResources() - the hot-place half: the host
//                                runs sceneMount.addQuestResourceObjects
//                                over the player's current interior/
//                                dungeon (Place.AssignQuestResource's
//                                tail drives it; absent ≙ C#'s
//                                missing PlayerEnterExit)
//
// Q3-ii, the Person chain's facts (all over the PERSISTENT faction
// store - PlayerEntity.FactionData, the mutable copy factionRep
// owns - not the raw file):
//   getFactionData(id)         - the store record | null
//   findFactionsOfType(type)   - FactionData.FindFactions(type)
//   currentRegionFaction()     - PlayerGPS.GetCurrentRegionFaction
//                                (the Province faction of the region)
//   currentRegionCourt()       - GetCourtOfCurrentRegion
//   currentRegionPeople()      - GetPeopleOfCurrentRegion
//   currentRegionVampireClan() - GetCurrentRegionVampireClan
//   playerVampireClan()        - the vampirism racial effect's clan
//                                (P0/$CUREVAM quests)
//   currentRegionRace()        - GetRaceOfCurrentRegion (a
//                                FactionRaces number)
//   playerInside().building.name / .dungeon.name - the current
//                                context's display name
//                                (ConfigureFromPlayerLocation)
//   changeLegalRep(amount)     - LegalRepute: current region's
//                                LegalRep += amount then the clamp
//                                (the G2 court system owns both)
//   playerLevel()              - PlayerEntity.Level (LevelCompleted)
//   getGold() / deductGold(n)  - PlayerEntity.GoldPieces (ClickedNpc)
//   playVideo(name)            - "ANIM0013.VID" (Q4 UI)
//   playSound(soundId)         - one-shot; return truthy if it PLAYED
//                                (C# skips while the source is busy,
//                                and only a real play re-stamps
//                                PlaySound's lastTimePlayed)
//   dialogLink(uid, name, type[, name2, type2]) - TalkManager
//                                DialogLinkForQuestInfoResource
//   addDialog(uid, name, type, isSpecial) - AddDialogForQuestInfoResource
//   addQuestRumor(uid, message)          - AddQuestRumorToRumorMill
//   addProgressRumor(uid, message)       - AddOrReplaceQuestProgressRumor
//   addQuestorPostMessage(uid, message)  - AddQuestorPostQuestMessage
//   removeProgressRumors(uid)  - RemoveQuestProgressRumorsFromRumorMill
//   removeQuestorPostMessage(uid) - RemoveQuestorPostQuestMessage
//   removeQuestRumors(uid)     - RemoveQuestRumorsFromRumorMill
//   removeQuestInfoTopics(uid) - RemoveQuestInfoTopicsForSpecificQuest
//   addFace(resource) / dropFace(resource) - the HUD escorting faces
//                                (AddFace/DropFace; Q4 wires)
//   onQuestStarted(quest)      - RaiseOnQuestStartedEvent; the
//                                QuestListsManager's one-time
//                                recording listens (Q4 wires)
//   forceTopicListsUpdate()    - TalkManager.ForceTopicListsUpdate
//                                (PlaceNpc nudges it; Q4 wires)
//
// Q2b-ii, the item tranche's facts and seams (Q4 wires the real
// inventory; tests capture):
//   playerGender()             - 'male' | 'female' (the magic mint)
//   getGuild(factionId)        - { guildGroup, rank, power,
//                                isNonMember } or null (CreateGold)
//   regionPriceAdjustment()    - RegionData[region].PriceAdjustment
//   isPlayerInTown()           - PlayerGPS.IsPlayerInTown(true, true)
//                                (GivePc's notify gate)
//   addGold(amount) / addHUDText(text) - GetItem's gold arm
//   giveItemToPlayer(dfItem, front) - ItemCollection.AddItem
//   removeItemFromPlayer(dfItem)    - ItemCollection.RemoveItem
//   playerHasItem(dfItem)      - Contains(DaggerfallUnityItem)
//   carriesQuestItem(itemResource)  - Contains(Item): uid+symbol
//   releaseQuestItem(questUID, itemResource) - the ReleaseQuestItem-
//                                ForReoffer player-side sweep
//                                (unequip + remove held matches)
//   makeHeldQuestItemsPermanent(questUID, symbol) - MakePermanent's
//                                held-copy sync
//   offerReward(quest, dfItem) - GivePc's QuestComplete loot window
//
// Q3-iii, the foe-spawn seam on deps.world (Q4 mounts the scene
// halves through the host's buildFoeAt chain; tests mock):
//   createFoeGameObjects(foeResource, count)
//                              - GameObjectHelper.CreateFoeGameObjects:
//                                mint `count` inactive enemy handles
//                                for the Foe resource (opaque to the
//                                machine); null/short = creation
//                                failure, CreateFoe error-terminates
//   tryPlaceFoe(handle)        - TryPlacement + PlaceFoeFreely: the
//                                raycast placement just outside the
//                                player's view; true = THIS handle
//                                stood, false = retry next tick
//   raiseOnEncounterEvent()    - GameManager.RaiseOnEncounterEvent,
//                                once per pending tick (optional)
//   ABSENT createFoeGameObjects = the spawn law idles (headless
//   charter); Foe name halves pend via foe.namePending. DEFERRED to
//   Q4's host mount: the exterior-transition/init-world pending-wave
//   invalidation (CreateFoe.cs:366-378) and the save envelope.
//
// Q3-iv, the remainder sweep's seams:
//   deps makePcDiseased(diseaseType) - PlayerEffectManager
//                                CreateDisease + AssignBundle
//                                (BypassSavingThrows); cureDisease
//                                (diseaseType), endVampirism(),
//                                endLycanthropy() (Q4 wires the S18
//                                system; tests capture)
//   deps.world getClassicSpellEffects(spellID) - the classic
//                                SPELLS.STD record's effects array
//                                (headless null: CastSpellDo idles,
//                                exactly C#'s missing-record arm);
//                                spellHasMatchForClassicEffect
//                                (bundle, effect) - the BUNDLE's own
//                                HasMatchForClassicEffect. The readied
//                                bundle itself is NOT polled: the host
//                                pushes it through
//                                notifyNewReadySpell/notifyCastReadySpell
//                                and CastSpellDo latches it, as C# does
//   the machine's factionListeners map + addFactionListener/
//   removeFactionListener/activeFactionPersons ride the hooks for
//   WhenNpcIsAvailable (TalkManager reads the map at Q4)
//
// Q4-i, the macro engine's seams (questMacros.js; every one optional
// - a missing seam surfaces C#'s own error shapes LOUDLY):
//   deps playerName()          - PlayerEntity.Name (%pcn/%pcf, and
//                                %pct's null-MCP fall-through)
//   deps playerRaceName()      - BirthRaceTemplate.Name (%ra)
//   deps.world getRandomText(id) - TEXT.RSC random records (%jok 200,
//                                %oth 201+oathId)
//   deps.world flatCaption(archive, record) - FLATS.CFG caption
//                                ("young lady in green"; =person_)
//   deps.world playerVampireClanName() - %vam (null = the C# error
//                                literal); regionVampireClanName(
//                                regionIndex) - %vcn
//   (AUDIT 24: divineOfTempleFaction is gone - QuestMCP.God resolves
//    the region temple and Temple.GetDivine itself, off REGION_TEMPLES
//    and the faction store, exactly as the C# does)
//   deps.world locationCompassDirection(place) /
//              buildingCompassDirection(buildingKey) - %di through
//                                TalkManager's compass
//   deps.world findFactionByTypeAndRegion(type, regionIndex) - the
//                                %rn/%rt/%t Province walk
//   deps.world showClocksAsCountdown() - the journal clock setting
//                                (=clock_; DFU default false)
//
// Q4-ii, the offer flow (offerFlow.js drives; QuestMachine.cs's own
// halves live HERE): setLastNPCClicked + getLastNPCClicked +
// isNPCDataEqual + isLastNPCClickedAnActiveQuestor (the questor
// click law) and createMessagePrompt (the Yes/No offer descriptor).
// The TalkManager scrubs and player facts the flow reads already
// ride the deps above; the flow's OWN seams (the castle gate,
// RemoveNpcQuestor, GetGuildFactionId, the picker setting) live on
// offerFlow.js.
//
// The 64 global variables (classic SAVEVARS.DAT state) live here and
// reach tasks through quest.hooks.globalVars.

import { Parser } from './parser.js';
import { defaultActionTemplates } from './actions.js';
import { QuestResourceBehaviour } from './resourceBehaviour.js';
import { FACTION_TYPES } from '../../formats/factionFile.js';
import { Quest } from './quest.js';
import { Task } from './task.js';
import { Person } from './person.js';
import { Place } from './place.js';
import { Item } from './item.js';
import { Foe } from './foe.js';
import { Clock } from './clock.js';

/** The restore registry (Q4-iv): the envelope's type strings map to
 *  ctors here instead of C#'s reflection walk. */
const RESOURCE_TYPES = Object.freeze({ Person, Place, Item, Foe, Clock });

export { QUEST_MESSAGES } from './quest.js';   // QuestMachine.cs:260's enum, defined leaf-side

/** QuestMachine.cs:45 - how often DFU ticks quest logic per second
 *  of real time. The host paces tick() by this. */
export const TICKS_PER_SECOND = 10;
/** DaggerfallDateTime: tombstoned quests expire after one week. */
export const SECONDS_PER_WEEK = 7 * 86400;
/** QuestMachine.IsProtectedQuest: the main-quest spine never
 *  error-terminates (case-insensitive, as C#). */
export const PROTECTED_QUESTS = Object.freeze(['S0000999', 'S0000977', '_BRISIEN']);
const isProtectedQuest = (quest) => PROTECTED_QUESTS.some((n) => n.toLowerCase() === (quest.questName ?? '').toLowerCase());

export class QuestMachine {
  constructor(deps = {}) {
    this.deps = deps;
    this.quests = new Map();          // uid -> Quest
    this.questsToInvoke = [];
    this.actionTemplates = [];
    this.globalVars = new Map();      // link id -> bool
    this.siteLinks = [];              // QuestMachine.cs siteLinks - the world<->marker bridge (Q3-i)
    this.factionListeners = new Map();  // factionID -> action (Q3-iv; TalkManager's Q4 signal)
    this.lastNPCClicked = null;       // QuestMachine.lastNPCClicked - the questor click (Q4-ii)
    this.parser = new Parser();
    for (const template of defaultActionTemplates()) this.registerAction(template);
    // AUDIT quest-2: the action factory travels PER QUEST (parse opt ->
    // quest.actionFactory -> Task), never a module global - two machines
    // can coexist and a machineless parse still pends every line.
    this._actionFactory = (line, quest) => {
      const template = this.getActionTemplate(line);
      return template ? template.createNew(line, quest) : null;
    };
  }

  registerAction(actionTemplate) { this.actionTemplates.push(actionTemplate); }

  /** The brute-force scan (QuestMachine.cs:751-763). */
  getActionTemplate(source) {
    for (const action of this.actionTemplates) {
      if (action.test(source)) return action;
    }
    return null;
  }

  /** The per-quest hook surface over the machine deps. Built BEFORE
   *  the parse since Q2b-ii: the Item mint reads player/guild/region
   *  facts at create time, exactly as DFU parses with the live
   *  world (PlaySound's nowSeconds went through this door first). */
  _buildHooks() {
    return {
      showPopup: (q, message) => this.deps.showPopup?.(q, message),
      showPrompt: (q, message, respond) => this.deps.showPrompt?.(q, message, respond),
      changeReputation: (fid, amount, propagate) => this.deps.changeReputation?.(fid, amount, propagate),
      changeLegalRep: (amount) => this.deps.changeLegalRep?.(amount),
      playerLevel: () => this.deps.playerLevel?.() ?? 0,
      playerGender: () => this.deps.playerGender?.() ?? 'male',
      getGold: () => this.deps.getGold?.() ?? 0,
      deductGold: (amount) => this.deps.deductGold?.(amount),
      addGold: (amount) => this.deps.addGold?.(amount),
      addHUDText: (text) => this.deps.addHUDText?.(text),
      playVideo: (name) => this.deps.playVideo?.(name),
      playSound: (soundId) => this.deps.playSound?.(soundId),
      dialogLink: (...args) => this.deps.dialogLink?.(...args),
      addDialog: (...args) => this.deps.addDialog?.(...args),
      addQuestRumor: (uid, message) => this.deps.addQuestRumor?.(uid, message),
      addProgressRumor: (uid, message) => this.deps.addProgressRumor?.(uid, message),
      addQuestorPostMessage: (uid, message) => this.deps.addQuestorPostMessage?.(uid, message),
      removeProgressRumors: (uid) => this.deps.removeProgressRumors?.(uid),
      removeQuestorPostMessage: (uid) => this.deps.removeQuestorPostMessage?.(uid),
      removeQuestRumors: (uid) => this.deps.removeQuestRumors?.(uid),
      removeQuestInfoTopics: (uid) => this.deps.removeQuestInfoTopics?.(uid),
      addFace: (resource) => this.deps.addFace?.(resource),
      dropFace: (resource) => this.deps.dropFace?.(resource),
      // Q4-iv: EndQuest's notebook filing - the host wires
      // PlayerNotebook.addFinishedQuest (systems/notebook.js).
      addFinishedQuest: (messages) => this.deps.addFinishedQuest?.(messages),
      // The item-mint facts (Q2b-ii): the guild record for the quest's
      // faction ({ guildGroup, rank, power, isNonMember } or null) and
      // the current region's PriceAdjustment.
      getGuild: (factionId) => this.deps.getGuild?.(factionId) ?? null,
      regionPriceAdjustment: () => this.deps.regionPriceAdjustment?.() ?? 0,
      // The player-inventory seams (Q2b-ii; Q4 wires the real
      // inventory): give/remove take the minted item OBJECT;
      // carriesQuestItem answers ItemCollection.Contains(Item)'s
      // uid+symbol match; playerHasItem answers Contains(dfItem);
      // releaseQuestItem is PlayerEntity.ReleaseQuestItemForReoffer's
      // player-side sweep (unequip + remove every matching held item);
      // makeHeldQuestItemsPermanent syncs MakePermanent over held
      // matches; offerReward opens the QuestComplete loot window.
      giveItemToPlayer: (dfItem, front) => this.deps.giveItemToPlayer?.(dfItem, front),
      removeItemFromPlayer: (dfItem) => this.deps.removeItemFromPlayer?.(dfItem),
      playerHasItem: (dfItem) => this.deps.playerHasItem?.(dfItem) ?? false,
      carriesQuestItem: (itemResource) => this.deps.carriesQuestItem?.(itemResource) ?? false,
      releaseQuestItem: (questUID, itemResource) => this.deps.releaseQuestItem?.(questUID, itemResource),
      makeHeldQuestItemsPermanent: (questUID, symbol) => this.deps.makeHeldQuestItemsPermanent?.(questUID, symbol),
      offerReward: (q, dfItem) => this.deps.offerReward?.(q, dfItem),
      isPlayerInTown: () => this.deps.isPlayerInTown?.() ?? false,
      // StartQuest schedules child quests through the machine's own
      // data seam (QuestListsManager.GetQuest -> ScheduleQuest).
      startQuest: (questName) => this.scheduleQuestByName(questName),
      globalVars: this.globalVars,
      // The Q3-i world seam + site machinery. deps.world is the
      // world-data/player-state surface a running host wires (contract
      // below); the SiteLink halves are the machine's own.
      world: this.deps.world ?? null,
      // Q3-ii: the questor click context (QuestMachine.LastNPCClicked
      // - { factionID, nameSeed, gender } | null) and factionRep's
      // GetReputation (ReputeExceedsDo reads it; an unknown faction
      // reads 0, factionRep's own law).
      lastNPCClicked: () => this.getLastNPCClicked(),
      // AUDIT 24 (the seven-slice sweep): StaticNPC identity. C#'s
      // `lastClicked == clickMemory` is a REFERENCE compare on a scene
      // MonoBehaviour, and one NPC has exactly one of those - so it
      // means "the same NPC". The port's hosts mint a FRESH NPCData
      // literal on every click, which no reference compare can ever
      // match, so the consumer needs the identity compare the machine
      // already owns (IsNPCDataEqual's four fields).
      isNPCDataEqual: (a, b) => this.isNPCDataEqual(a, b),
      playerName: () => this.deps.playerName?.() ?? null,
      playerRaceName: () => this.deps.playerRaceName?.() ?? null,
      addFactionListener: (factionID, owner) => this.addFactionListener(factionID, owner),
      removeFactionListener: (factionID) => this.removeFactionListener(factionID),
      activeFactionPersons: (factionID) => this.activeFactionPersons(factionID),
      makePcDiseased: (diseaseType) => this.deps.makePcDiseased?.(diseaseType),
      cureDisease: (diseaseType) => this.deps.cureDisease?.(diseaseType),
      endVampirism: () => this.deps.endVampirism?.(),
      endLycanthropy: () => this.deps.endLycanthropy?.(),
      getReputation: (factionId) => this.deps.getReputation?.(factionId) ?? 0,
      forceTopicListsUpdate: () => this.deps.forceTopicListsUpdate?.(),
      getAllActiveQuestSites: () => this.getAllActiveQuestSites(),
      cullResourceTarget: (resource, newPlaceSymbol) => this.cullResourceTarget(resource, newPlaceSymbol),
      hasSiteLink: (quest, placeSymbol) => this.hasSiteLink(quest, placeSymbol),
      createSiteLink: (quest, placeSymbol) => this.createSiteLink(quest, placeSymbol),
    };
  }

  /** Parse a quest from source lines and schedule it to start on the
   *  next tick (DFU's InstantiateQuest -> ScheduleQuest shape).
   *  nowSeconds and hooks ride the PARSE opts - PlaySound's create
   *  stamps the live clock, the Item mint reads the live world. */
  scheduleQuest(sourceLines, factionId = 0, { rolls } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    const quest = this.parser.parse(sourceLines, factionId,
      { rolls, actionFactory: this._actionFactory, nowSeconds, hooks: this._buildHooks() });
    this.questsToInvoke.push(quest);
    return quest;
  }

  /** Schedule by quest name through the data seam. */
  scheduleQuestByName(questName, factionId = 0, opts = {}) {
    const lines = this.deps.getQuestSourceLines?.(questName);
    if (!lines) { console.warn(`[quest] no source for quest ${questName}`); return null; }
    return this.scheduleQuest(lines, factionId, opts);
  }

  /** ScheduleQuest(quest) - the parsed-quest arm (QuestMachine.cs's
   *  own ScheduleQuest signature): starts on the NEXT tick. The
   *  offer-accept flow schedules here (Q4). */
  scheduleParsedQuest(quest) {
    this.questsToInvoke.push(quest);
    return quest;
  }

  /** StartQuest(quest) (QuestMachine.cs:719-735) - the IMMEDIATE arm:
   *  Start, the talk-topic registration, the live table, then
   *  OnQuestStarted, synchronously; exceptions PROPAGATE to the
   *  caller (the Tick invoke loop wraps its own try). InitAtGameStart
   *  quests come through here, as C#'s do (Q2b-ii VERIFY: the first
   *  draft only scheduled them, so they were absent from the live
   *  table until the next tick). The questor-behaviour relink that
   *  follows in C# is scene work (Q3). */
  startQuestImmediate(quest) {
    quest.start();
    this.deps.addQuestTopics?.(quest);
    this.quests.set(quest.uid, quest);
    this.deps.onQuestStarted?.(quest);
    return quest;
  }

  /** The QuestListsManager's parseQuest dep: parse with THIS
   *  machine's registry, clock and hooks, without scheduling. The
   *  lists dep is positional - parseQuest(lines, factionId,
   *  partialParse) - so a host wires
   *  `(l, f, p) => machine.parseQuestForLists(l, f, { partialParse: p })`. */
  parseQuestForLists(lines, factionId = 0, { rolls, partialParse = false } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    return this.parser.parse(lines, factionId,
      { partialParse, rolls, actionFactory: this._actionFactory, nowSeconds, hooks: this._buildHooks() });
  }

  getQuest(uid) { return this.quests.get(uid) ?? null; }

  // ---- Q4-ii: the questor click + the offer prompt ----
  // (QuestMachine.cs:888-985; offerFlow.js drives these.)

  /** LastNPCClicked: the machine's own field once setLastNPCClicked
   *  ran; the deps seam stays for hosts/tests that inject the click
   *  context directly (Q3-ii's door). */
  getLastNPCClicked() { return this.lastNPCClicked ?? this.deps.lastNPCClicked?.() ?? null; }

  /** SetLastNPCClicked (:948-966): stores the click, then sweeps
   *  EVERY quest's Persons for a QuestorData match and marks them
   *  clicked. No IsQuestor gate and no QuestComplete skip here - both
   *  are IsLastNPCClickedAnActiveQuestor's filters, not this sweep's,
   *  verbatim. npcData is StaticNPC.NPCData's identity: { hash,
   *  mapID, nameSeed, buildingKey, factionID, gender } (equality
   *  reads the first four; the offer flow reads the last three). */
  setLastNPCClicked(npcData) {
    this.lastNPCClicked = npcData;
    for (const quest of this.quests.values()) {
      for (const resource of quest.resources.values()) {
        if (resource.isPerson && this.isNPCDataEqual(resource.questorData, npcData)) {
          resource.setPlayerClicked();
        }
      }
    }
  }

  /** IsNPCDataEqual (:973-985): the four-field identity. C#'s NPCData
   *  is a STRUCT - a never-assigned QuestorData is the default struct
   *  (all zeros), so null reads as zero fields here to keep the
   *  struct semantics (two unassigned sides ARE equal). */
  isNPCDataEqual(person1, person2) {
    return (person1?.hash ?? 0) === (person2?.hash ?? 0)
      && (person1?.mapID ?? 0) === (person2?.mapID ?? 0)
      && (person1?.nameSeed ?? 0) === (person2?.nameSeed ?? 0)
      && (person1?.buildingKey ?? 0) === (person2?.buildingKey ?? 0);
  }

  /** IsLastNPCClickedAnActiveQuestor (:918-941): scans INCOMPLETE
   *  quests for a questor Person matching the last click; a match
   *  stamps quest.externalMCP with the passed provider (the offer
   *  window hands the guild in - %pct's context) and answers true.
   *  C#'s log line formats only its {1} arg, dropping the UID.
   *  DELTA (recorded): a never-clicked machine compares the zero
   *  struct here where C# NREs on lastNPCClicked.Data - unreachable
   *  through the windows, which only open off a click. */
  isLastNPCClickedAnActiveQuestor(mcp = null) {
    const clicked = this.getLastNPCClicked();
    for (const quest of this.quests.values()) {
      if (quest.questComplete) continue;
      for (const resource of quest.resources.values()) {
        if (!resource.isPerson || !resource.isQuestor) continue;
        if (this.isNPCDataEqual(resource.questorData, clicked)) {
          console.log(`[quest] This person is used in quest as Person ${resource.symbol?.original}`);
          if (mcp != null) quest.externalMCP = mcp;
          return true;
        }
      }
    }
    return false;
  }

  /** CreateMessagePrompt (:888-910): a Yes/No prompt descriptor from
   *  a quest message - tokens at DEFAULT expansion (the macro pass,
   *  no dialog reveal; the variant draw rides quest.rolls, Ledger A),
   *  YesNo buttons, no click-anywhere, no cancel. The UI host draws
   *  it and routes the answer; a missing message answers null and
   *  the offer silently shows nothing, verbatim. */
  createMessagePrompt(quest, id) {
    const message = quest.getMessage(id);
    if (!message) return null;
    return {
      tokens: message.getTextTokens(-1, quest.rolls),
      buttons: 'YesNo',
      clickAnywhereToClose: false,
      allowCancel: false,
    };
  }

  // ---- Q4-iii: the individual-NPC scene halves + the world signals ----
  // (QuestMachine.cs:1310-1421; sceneMount.js drives the marker walk.)

  /** IsIndividualNPC (:1310-1321): the faction record's type is
   *  Individual. C#'s PlayerEntity-null guard maps to the absent
   *  world seam - both answer false. */
  isIndividualNPC(factionID) {
    const factionData = this.deps.world?.getFactionData?.(factionID) ?? null;
    return factionData != null && factionData.type === FACTION_TYPES.Individual;
  }

  /** IsIndividualQuestNPCAtSiteLink (:1368-1421): walks SiteLink >
   *  Quest > Place > selectedMarker targets for an individual Person
   *  placed AWAY from home - layout builders disable the home copy
   *  when true. A link whose selected marker carries no targets logs
   *  and walks on, verbatim. */
  isIndividualQuestNPCAtSiteLink(factionID) {
    if (!this.isIndividualNPC(factionID)) return false;
    for (const link of this.siteLinks) {
      const quest = this.getQuest(link.questUID);
      if (!quest) continue;
      const place = quest.getPlace(link.placeSymbol);
      if (!place) continue;
      const marker = place.siteDetails.selectedMarker;
      if (!marker?.targetResources) {
        console.log('[quest] IsIndividualQuestNPCAtSiteLink() found a SiteLink with no targetResources assigned.');
        continue;
      }
      for (const target of marker.targetResources) {
        const resource = quest.getResource(target);
        if (!resource) continue;
        if (!resource.isPerson) continue;
        if (!resource.isIndividualNPC || resource.isIndividualAtHome) continue;
        if (resource.factionData?.id === factionID) return true;
      }
    }
    return false;
  }

  /** SetupIndividualStaticNPC (:1331-1358): the layout builders call
   *  this for every individual StaticNPC they stand. Placed elsewhere
   *  on a quest -> the home copy deactivates, answers false. Else an
   *  individual ALWAYS gets a behaviour - the follow-up-quest
   *  bootstrap click needs one even before any quest uses the NPC -
   *  assigned to the first active Person of that faction when one
   *  exists; answers the behaviour. A non-individual answers true
   *  with nothing attached, C#'s own shape. */
  setupIndividualStaticNPC(host, factionID) {
    if (this.isIndividualNPC(factionID)) {
      if (this.isIndividualQuestNPCAtSiteLink(factionID)) {
        host?.setActive?.(false);
        return false;
      }
      const behaviour = new QuestResourceBehaviour(this, host);
      const activePersonResources = this.activeFactionPersons(factionID);
      if (activePersonResources && activePersonResources.length > 0) {
        const person = activePersonResources[0];
        behaviour.assignResource(person);
        person.questResourceBehaviour = behaviour;
      }
      return behaviour;
    }
    return true;
  }

  /** PlayerEnterExit.OnTransitionExterior + OnTransitionDungeonExterior
   *  (CreateFoe.cs:56-57): every action holding pending scene state
   *  drops it - foes pending placement into an interior are invalid
   *  outside. The port walks live AND scheduled quests where C#
   *  subscribes each action instance; same population, one door. */
  notifyExteriorTransition() {
    this._forEachAction((action) => action.onTransitionExterior?.());
  }

  /** StreamingWorld.OnInitWorld (CreateFoe.cs:58): a world rebuild
   *  invalidates pending placements the same way. */
  notifyInitWorld() {
    this._forEachAction((action) => action.onInitWorld?.());
  }

  /** PlayerEffectManager.OnNewReadySpell (CastSpellDo.cs:44): the
   *  player readied a bundle. AUDIT 24 (the seven-slice sweep): C#
   *  LATCHES this on the action, and the latch is not the same thing
   *  as the host's live readied state - an abort clears the host and
   *  leaves the latch standing. Same door as the transitions. */
  notifyNewReadySpell(spell) {
    this._forEachAction((action) => action.onNewReadySpell?.(spell));
  }

  /** PlayerEffectManager.OnCastReadySpell (CastSpellDo.cs:45): the
   *  readied bundle was CAST - the one event that clears the latch. */
  notifyCastReadySpell(spell) {
    this._forEachAction((action) => action.onCastReadySpell?.(spell));
  }

  _forEachAction(fn) {
    for (const list of [this.quests.values(), this.questsToInvoke]) {
      for (const quest of list) {
        for (const task of quest.tasks?.values?.() ?? []) {
          for (const action of task.actions) fn(action);
        }
      }
    }
  }

  // ---- Q4-iv: the journal walk + the save envelope ----

  /** GetAllQuestLogMessages (QuestMachine.cs:616-635): the journal's
   *  ACTIVE page - every live quest's log entries resolved to their
   *  Message objects. Insertion order, NO sort; a completed quest's
   *  null log skips whole. */
  getAllQuestLogMessages() {
    const questMessages = [];
    for (const quest of this.quests.values()) {
      const logEntries = quest.getLogMessages();
      if (!logEntries || logEntries.length === 0) continue;
      for (const logEntry of logEntries) {
        const message = quest.getMessage(logEntry.messageID);
        if (message) questMessages.push(message);
      }
    }
    return questMessages;
  }

  /** GetSaveData (QuestMachine.cs:1900-1916): SiteLinks + every live
   *  quest. SiteLink placeSymbols round-trip as plain {original,
   *  name} data - the shape C#'s serializer writes for Symbol, and
   *  every consumer reads by .name. */
  getSaveData() {
    return {
      siteLinks: this.siteLinks.map((l) => structuredClone(l)),
      quests: [...this.quests.values()].map((q) => q.getSaveData()),
    };
  }

  /** RestoreSaveData (QuestMachine.cs:1918-1944): each quest restores
   *  under a per-quest catch - a quest that cannot reconstruct (the
   *  removed-mod law: an unknown action or resource type) warns, adds
   *  the HUD line, and the load continues; a duplicate UID throws
   *  into the same catch, as Dictionary.Add does. Restored quests
   *  ride THIS machine's hooks and clock (C#'s ambient singletons
   *  re-injected). ReassignLegacyQuestMarkers is legacy-save marker
   *  migration with no port-side legacy saves (recorded). Stale
   *  SiteLinks scrub after. */
  /** ClearState (QuestMachine.cs:533-546): the load path wipes the
   *  live state before RestoreSaveData lands the envelope. C#'s
   *  questsToTombstone/questsToRemove queues are the port's inline
   *  sweeps (nothing standing to clear), and the HUD place-marker
   *  debugger has no port surface; factionListeners survive exactly as
   *  C#'s dictionary does. Q4-v: the host's quickload calls this
   *  through the bridge. */
  clearState() {
    this.quests.clear();
    this.siteLinks = [];
    this.questsToInvoke = [];
    this.lastNPCClicked = null;
  }

  restoreSaveData(data) {
    this.siteLinks = (data.siteLinks ?? []).map((l) => structuredClone(l));
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    for (const questData of data.quests ?? []) {
      try {
        const quest = new Quest({ nowSeconds, actionFactory: this._actionFactory, hooks: this._buildHooks() });
        quest.restoreSaveData(questData, this._saveResolvers());
        if (this.quests.has(quest.uid)) throw new Error('An item with the same key has already been added.');
        this.quests.set(quest.uid, quest);
      } catch (e) {
        console.warn(`[quest] Failed to load quest data for '${questData.displayName} [${questData.questName}]' with UID ${questData.uid}. This is expected after removing a mod with custom quest actions. Exception message is '${e?.message ?? e}'`);
        this.deps.addHUDText?.(`Failed to load quest '${questData.displayName} [${questData.questName}]'. This is expected if quest mod removed.`);
      }
    }
    this.removeStaleSiteLinks();
  }

  /** RemoveStaleSiteLinks (:1946-1970). */
  removeStaleSiteLinks() {
    const stale = this.siteLinks.filter((link) => !this.getQuest(link.questUID));
    for (const link of stale) {
      console.warn(`[quest] Removing stale SiteLink ${link.placeSymbol?.original}. Quest UID ${link.questUID} not present.`);
      this.siteLinks.splice(this.siteLinks.indexOf(link), 1);
    }
  }

  /** The reflection stand-in: the resource registry and the ACTION
   *  registry keyed by each template's explicit typeName (built
   *  fresh so late registerAction calls are honored). */
  _saveResolvers() {
    const actionTypeMap = new Map(this.actionTemplates.map((t) => [t.typeName, t.constructor]));
    return {
      Task,
      resolveResourceType: (name) => RESOURCE_TYPES[name] ?? null,
      resolveActionType: (name) => actionTypeMap.get(name) ?? null,
    };
  }

  /** One machine tick (QuestMachine.cs Tick). */
  tick() {
    // Invoke scheduled quests (QuestMachine.cs StartQuest:719-725):
    // Start, then the talk-topic registration, then the live table.
    // The questor-behaviour relink that follows in C# is scene work
    // (Q3). Q2b-VERIFY: the addQuestTopics half was silently absent
    // while its tombstone-side removal was wired - the scrub would
    // have deleted topics no one ever added.
    for (const quest of this.questsToInvoke) {
      try {
        this.startQuestImmediate(quest);
        // QUIRK KEPT (QuestMachine.cs:450-451): Tick raises
        // OnQuestStarted AGAIN after StartQuest already raised it -
        // every SCHEDULED quest fires the event twice, and a one-time
        // quest is recorded twice in the lists' accepted array (a
        // Contains gate, so offers are unaffected - but the recorded
        // list is save state). Direct starts raise once.
        this.deps.onQuestStarted?.(quest);
      } catch (e) {
        console.warn(`[quest] QuestMachine failed to start quest ${quest.questName}: ${e?.message ?? e}`);
      }
    }
    this.questsToInvoke.length = 0;

    // Update quests; collect completed for tombstoning and expired or
    // faulting for removal. AUDIT quest-P3: an exception in a quest's
    // update ERROR-TERMINATES it unless the quest is protected (the
    // main-quest spine) - C# removes faulting quests rather than
    // letting them throw every tick forever. Q2b-VERIFY: the catch
    // only COLLECTS (QuestMachine.cs:486) - the faulting quest is
    // tombstoned by removeQuest AFTER every other quest's update and
    // after the regular tombstone pass, so its tombstone talk hooks
    // fire in C#'s order. The tombstone/expiry checks sit OUTSIDE the
    // try, as in C#.
    const questsToTombstone = [], questsToRemove = [];
    for (const quest of this.quests.values()) {
      try {
        if (!quest.questComplete) quest.update();
      } catch (e) {
        console.warn(`[quest] QuestMachine encountered an exception in quest ${quest.questName}: ${e?.message ?? e}`);
        if (!isProtectedQuest(quest)) questsToRemove.push(quest);
      }
      if (quest.questComplete && !quest.questTombstoned) questsToTombstone.push(quest);
      if (quest.questTombstoned
        && (this.deps.nowSeconds?.() ?? 0) - quest.questTombstoneTime > SECONDS_PER_WEEK) {
        questsToRemove.push(quest);
      }
    }

    for (const quest of questsToTombstone) this.tombstoneQuest(quest);
    for (const quest of questsToRemove) this.removeQuest(quest);
  }

  /** Dispose resources then task actions (Quest.cs Dispose order,
   *  AUDIT quest-P5), mark tombstoned (site-link scrub rides Q3). */
  tombstoneQuest(quest) {
    for (const resource of quest.resources.values()) resource.dispose();
    for (const task of quest.tasks.values()) task.disposeActions();
    // RemoveAllQuestSiteLinks (QuestMachine.cs:1042-1048): a
    // tombstoned quest's SiteLinks die with it - stale links would
    // make hasSiteLink lie to the NEXT quest at the same site (the
    // sequential-guild-hall case; Q3-i VERIFY: the scrub was missing).
    this.siteLinks = this.siteLinks.filter((link) => link.questUID !== quest.uid);
    quest.tombstone();
  }

  /** RemoveQuest (QuestMachine.cs): tombstones first if the quest is
   *  not already - the error-termination path lands here - then drops
   *  it from the live table. */
  removeQuest(quest) {
    if (!quest) return false;
    if (!quest.questTombstoned) this.tombstoneQuest(quest);
    this.quests.delete(quest.uid);
    return true;
  }

  // ---- SiteLinks (Q3-i): "reserved by 'create npc at'" and every
  // placement action - the bridge layout builders walk to discover
  // which quest resources stand at a site. ----

  /** AddSiteLink (QuestMachine.cs). */
  addSiteLink(siteLink) { this.siteLinks.push(siteLink); }

  /** GetSiteLinks(siteType, mapId, buildingKey, magicNumberIndex) -
   *  the layout builders' query. buildingKey/magicNumberIndex of 0
   *  match any, as in C# (the callers pass 0 when not applicable). */
  getSiteLinks(siteType, mapId, buildingKey = 0, magicNumberIndex = 0) {
    return this.siteLinks.filter((link) =>
      link.siteType === siteType && link.mapId === mapId
      && (buildingKey === 0 || link.buildingKey === buildingKey)
      && (magicNumberIndex === 0 || link.magicNumberIndex === magicNumberIndex));
  }

  /** HasSiteLink(parentQuest, placeSymbol) (QuestMachine.cs:1739). */
  hasSiteLink(parentQuest, placeSymbol) {
    const place = parentQuest.getPlace(placeSymbol);
    if (!place) throw new Error(`HasSiteLink() could not find Place symbol ${placeSymbol?.name}`);
    return this.getSiteLinks(place.siteDetails?.siteType, place.siteDetails?.mapId,
      place.siteDetails?.buildingKey ?? 0, place.siteDetails?.magicNumberIndex ?? 0).length > 0;
  }

  /** CreateSiteLink(parentQuest, placeSymbol) (QuestMachine.cs:1757). */
  createSiteLink(parentQuest, placeSymbol) {
    const place = parentQuest.getPlace(placeSymbol);
    if (!place) throw new Error(`Attempted to add SiteLink for invalid Place symbol ${placeSymbol?.name}`);
    this.addSiteLink({
      questUID: parentQuest.uid,
      placeSymbol: placeSymbol.clone(),
      siteType: place.siteDetails?.siteType,
      mapId: place.siteDetails?.mapId,
      buildingKey: place.siteDetails?.buildingKey ?? 0,
      magicNumberIndex: place.siteDetails?.magicNumberIndex ?? 0,
    });
  }

  /** GetAllActiveQuestSites (QuestMachine.cs:769): every Place's site
   *  across INCOMPLETE quests - the already-assigned exclusions in
   *  the site collectors read it. */
  getAllActiveQuestSites() {
    const sites = [];
    for (const quest of this.quests.values()) {
      if (quest.questComplete) continue;
      for (const resource of quest.resources.values()) {
        if (resource.isPlace && resource.siteDetails) sites.push(resource.siteDetails);
      }
    }
    return sites;
  }

  /** ActiveFactionPersons (QuestMachine.cs:1085-1107): Person
   *  resources of the faction across all NON-COMPLETE quests -
   *  completed/tombstoned quests must not lock an NPC out. */
  activeFactionPersons(factionID) {
    const found = [];
    for (const quest of this.quests.values()) {
      if (quest.questComplete) continue;
      for (const resource of quest.resources.values()) {
        if (resource.isPerson && resource.factionId === factionID) found.push(resource);
      }
    }
    return found;
  }

  /** Add/RemoveFactionListener (QuestMachine.cs:1183-1200): first
   *  claim wins, a missing claim is a no-op. TalkManager reads the
   *  map to know a quest wants that individual (Q4 wires). */
  addFactionListener(factionID, owner) {
    if (!this.factionListeners.has(factionID)) this.factionListeners.set(factionID, owner);
  }

  removeFactionListener(factionID) {
    this.factionListeners.delete(factionID);
  }

  /** CullResourceTarget (QuestMachine.cs:1496): removes a resource
   *  from the SELECTED marker of every linked Place of its quest
   *  before it lands at a new one - a moved resource must not stand
   *  in two sites. QUIRKS KEPT: the newPlace parameter is DEAD in C#
   *  (the arriving place is pruned too, then re-added); a stale link
   *  whose quest or place cannot resolve ABORTS the whole cull
   *  (return, not continue); a marker symbol that no longer resolves
   *  to a resource is skipped. */
  cullResourceTarget(resource, _newPlaceSymbol) {
    if (!resource) return;
    for (const link of this.siteLinks) {
      if (link.questUID !== resource.parentQuest.uid) continue;
      const quest = this.quests.get(link.questUID);
      if (!quest) { console.warn(`[quest] CullResourceTarget() could not find active quest for UID ${link.questUID}`); return; }
      const place = quest.getPlace(link.placeSymbol);
      if (!place) { console.warn(`[quest] CullResourceTarget() could not find Place symbol ${link.placeSymbol?.name} in quest UID ${link.questUID}`); return; }
      const selected = place.siteDetails?.selectedMarker;
      if (selected?.targetResources) {
        const i = selected.targetResources.findIndex((s) =>
          quest.getResource(s) != null
          && s.name === resource.symbol.name && s.original === resource.symbol.original);
        if (i !== -1) selected.targetResources.splice(i, 1);
      }
    }
  }
}
