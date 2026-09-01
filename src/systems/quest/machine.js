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
//   nowSeconds()               - world time in EPOCH-RELATIVE seconds:
//                                the host injects classicMinutes*60,
//                                i.e. ToClassicDaggerfallTime scaled
//                                to seconds, NOT ToSeconds. Clocks use
//                                deltas so the base is invisible to
//                                them, and CLASSIC_EPOCH_IN_SECONDS is
//                                exactly 404 x 360-day years, so
//                                hour/minute/day/month/season read the
//                                same as DFU's WorldTime.Now off this
//                                base. Only the YEAR needs the epoch
//                                added back before the date is read
//                                (questMacros' nowDate does it), and
//                                only TrainPc's timeOfLastSkillTraining
//                                wants the counter raw.
//   getQuestSourceLines(name)  - quest source by name (the vendored
//                                pack through the host's data seam;
//                                the QuestListsManager stand-in that
//                                StartQuest schedules through)
//   showPopup(quest, tokens)   - ONE message box: the already-
//                              expanded token array of one chunk. The
//                              host stacks them (PushWindow), newest
//                              in front. (Q4 wires the
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
//   addNoteTokens(tokens)      - PlayerNotebook.AddNote(List<Token>),
//                                the OTHER overload (JournalNote)
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
//   getTotalGold()             - PlayerEntity.GetGoldAmount: coins
//                                PLUS letters of credit, what
//                                deductGold spends and what PayMoney's
//                                `money` arm gates on
//   playVideo(name)            - "ANIM0013.VID" (Q4 UI)
//   playSound(soundId)         - one-shot; return truthy if it PLAYED
//                                (C# skips while the source is busy,
//                                and only a real play re-stamps
//                                PlaySound's lastTimePlayed)
//   playSong(name)             - "DUNGEON5.HMI", a MIDI.BSA RECORD
//                                name: PlaySong resolves the SongFiles
//                                member through songFiles.js before it
//                                reaches the hook, because the port's
//                                whole song layer keys on the archive's
//                                spelling (DaggerfallSongPlayer.Play)
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
//   onQuestEnded(quest)        - RaiseOnQuestEndedEvent (TombstoneQuest,
//                                QuestMachine.cs:1047); the HUD escort
//                                faces' unlike-Daggerfall sweep listens
//                                (FE1 wires)
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
//   WhenNpcIsAvailable (PlayerActivate.StaticNPCClick reads the map)
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
import { SECONDS_PER_WEEK } from '../gameDate.js';
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
/** DaggerfallDateTime: tombstoned quests expire after one week. One
 *  home in systems/gameDate.js since V1 - re-exported here because
 *  the quest lane reads it by this name. */
export { SECONDS_PER_WEEK };
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
    this.factionListeners = new Map();  // factionID -> action (Q3-iv; StaticNPCClick's shut-down signal)
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

  /** ST1: a quest-SHAPED context for expanding CONTEXT macros in
   *  non-quest text - the record-22 status box is DFU's
   *  SetTextTokens(22), whose macros resolve through MacroHelper's
   *  STATIC handlers reaching GameManager singletons; the port's
   *  equivalents are the questMacros HANDLERS reading these hooks.
   *  Only nowSeconds and hooks are read by that path
   *  (getContextValue builds its mcp from them). */
  macroContext() {
    return { nowSeconds: () => this.deps.nowSeconds?.() ?? 0, hooks: this._buildHooks() };
  }

  /** The per-quest hook surface over the machine deps. Built BEFORE
   *  the parse since Q2b-ii: the Item mint reads player/guild/region
   *  facts at create time, exactly as DFU parses with the live
   *  world (PlaySound's nowSeconds went through this door first). */
  _buildHooks() {
    return {
      showPopup: (q, tokens) => this.deps.showPopup?.(q, tokens),
      showPrompt: (q, message, respond) => this.deps.showPrompt?.(q, message, respond),
      // QG1: PromptMulti's 2-4 button box - BUTTONS.RCI record
      // numbers out, the clicked record number back
      showPromptMulti: (q, message, buttons, respond) => this.deps.showPromptMulti?.(q, message, buttons, respond),
      changeReputation: (fid, amount, propagate) => this.deps.changeReputation?.(fid, amount, propagate),
      changeLegalRep: (amount) => this.deps.changeLegalRep?.(amount),
      playerLevel: () => this.deps.playerLevel?.() ?? 0,
      playerGender: () => this.deps.playerGender?.() ?? 'male',
      getGold: () => this.deps.getGold?.() ?? 0,
      // PlayerEntity.GetGoldAmount - the quantity deductGold spends.
      getTotalGold: () => this.deps.getTotalGold?.() ?? 0,
      deductGold: (amount) => this.deps.deductGold?.(amount),
      addGold: (amount) => this.deps.addGold?.(amount),
      addHUDText: (text) => this.deps.addHUDText?.(text),
      playVideo: (name) => this.deps.playVideo?.(name),
      playSound: (soundId) => this.deps.playSound?.(soundId),
      playSong: (name) => this.deps.playSong?.(name),
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
      // M-X: the macro table's remaining globals - the live entity
      // (vitals, %ski, the biography modifiers) and the clock the
      // date/time block reads.
      playerEntity: () => this.deps.playerEntity ?? null,
      nowSeconds: () => this.deps.nowSeconds?.() ?? null,
      // Q5: the fourteen un-pended actions' doors
      setPlayerCrime: (crime) => this.deps.setPlayerCrime?.(crime),
      getGoldPieces: () => this.deps.getGoldPieces?.() ?? 0,
      deductGoldPieces: (n) => this.deps.deductGoldPieces?.(n),
      raiseTime: (seconds) => this.deps.raiseTime?.(seconds),
      spawnCityGuards: (immediate) => this.deps.spawnCityGuards?.(immediate),
      makeEnemiesHostile: () => this.deps.makeEnemiesHostile?.(),
      clearEnemies: () => this.deps.clearEnemies?.(),
      // MT-iii: every LIVE spawned instance of a quest Foe symbol -
      // DFU's ActiveGameObjectDatabase walk, QuestSpawn-filtered and
      // TargetSymbol-matched (ChangeFoeInfighting.cs:44-56 /
      // ChangeFoeTeam.cs:77-92). Answers [] with no host, which idles
      // both actions exactly as C# does with no enemy standing.
      questFoeInstances: (symbol) => this.deps.questFoeInstances?.(symbol) ?? [],
      getQuest: (uid) => this.getQuest(uid),
      // RunQuest.Dispose's teardown of a child quest still running
      // when the parent ends (QuestMachine.TombstoneQuest).
      tombstoneQuest: (quest) => this.tombstoneQuest(quest),
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

  /** StartQuest(questName, factionId) (QuestMachine.cs:705-713): parse
   *  by name and start IMMEDIATELY - the arm StartGameBehaviour uses
   *  for the two hard-coded main-quest starts. A quest that will not
   *  parse answers null and nothing starts, which is ParseQuest's own
   *  swallow-all contract. AUDIT 24 (the seven-slice sweep). */
  startQuestByName(questName, factionId = 0, opts = {}) {
    const lines = this.deps.getQuestSourceLines?.(questName);
    if (!lines) { console.warn(`[quest] no source for quest ${questName}`); return null; }
    const quest = this.parseQuestForLists(lines, factionId, opts);
    if (!quest) return null;
    this.startQuestImmediate(quest);
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
   *  table until the next tick).
   *
   *  AUDIT 24 (wave 25): and the TAIL (:729-734), which the port waved
   *  off as "scene work (Q3)" and never came back for:
   *
   *      // Assign QuestResourceBehaviour to questor NPC - this will
   *      // be last NPC clicked. This will ensure quests actions like
   *      // "hide npc" will operate on questor at quest startup
   *      if (LastNPCClicked != null)
   *          LastNPCClicked.AssignQuestResourceBehaviour();
   *
   *  Without it, the questor you have just accepted a quest from
   *  carries no behaviour until the next layout, so every action that
   *  reaches a Person through one - hide npc first among them, which
   *  the corpus fires at startup all over - operated on nothing. */
  startQuestImmediate(quest) {
    quest.start();
    this.deps.addQuestTopics?.(quest);
    this.quests.set(quest.uid, quest);
    this.deps.onQuestStarted?.(quest);
    if (this.lastNPCClicked != null) {
      this.assignQuestResourceBehaviour(this.lastNPCClickedHost ?? null, this.lastNPCClicked);
    }
    return quest;
  }

  /** The QuestListsManager's parseQuest dep: parse with THIS
   *  machine's registry, clock and hooks, without scheduling. The
   *  lists dep is positional - parseQuest(lines, factionId,
   *  partialParse) - so a host wires
   *  `(l, f, p) => machine.parseQuestForLists(l, f, { partialParse: p })`. */
  parseQuestForLists(lines, factionId = 0, { rolls, partialParse = false } = {}) {
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    // AUDIT 24 (the seven-slice sweep): ParseQuest wraps the WHOLE
    // parse in `try { ... } catch (Exception ex) { LogFormat("Parsing
    // quest {0} FAILED!..."); return null; }` (:670-687). The port had
    // no catch, so a quest whose source the parser chokes on threw out
    // of the picker instead of answering null - and questLists.loadQuest
    // already had the `if (!quest) return null;` arm C# feeds, sitting
    // unreachable. One broken row took the whole guild quest list with
    // it where DFU drops that row and offers the rest.
    try {
      return this.parser.parse(lines, factionId,
        { partialParse, rolls, actionFactory: this._actionFactory, nowSeconds, hooks: this._buildHooks() });
    } catch (ex) {
      console.warn(`[quest] Parsing quest FAILED!\r\n${ex?.message ?? ex}`);
      return null;
    }
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
  setLastNPCClicked(npcData, host = null) {
    this.lastNPCClicked = npcData;
    // AUDIT 24 (wave 25): C#'s LastNPCClicked is the StaticNPC
    // COMPONENT, so it still has its GameObject when StartQuest's tail
    // reaches for AssignQuestResourceBehaviour (:729-734). The port
    // stored the bare NPCData, so there was nothing to attach to; the
    // scene half rides alongside now.
    this.lastNPCClickedHost = host;
    for (const quest of this.quests.values()) {
      for (const resource of quest.resources.values()) {
        if (resource.isPerson && this.isNPCDataEqual(resource.questorData, npcData)) {
          resource.setPlayerClicked();
        }
      }
    }
  }

  /** ActiveQuestor (:1145-1169): the Person that a clicked StaticNPC
   *  is the questor for, over the LIVE quests.
   *
   *  C# QUIRK KEPT: the inner loop breaks on a match but the OUTER one
   *  does not, so a later quest's questor OVERWRITES an earlier match.
   *  With two quests from the same NPC in flight, the one that
   *  iterates last wins. */
  activeQuestor(npcData) {
    let found = null;
    for (const quest of this.quests.values()) {
      const questorSymbols = quest.getQuestors();
      if (!questorSymbols || questorSymbols.length === 0) continue;
      for (const symbol of questorSymbols) {
        const person = quest.getPerson(symbol);
        if (!person) continue;
        if (this.isNPCDataEqual(npcData, person.questorData)) { found = person; break; }
      }
    }
    return found;
  }

  /** AssignQuestResourceBehaviour (StaticNPC.cs:261-278): stand a
   *  behaviour on the clicked NPC's host and point it at the questor
   *  Person. A host that already carries one is left alone ("Can only
   *  have a single QuestResourceBehaviour"), and an NPC who is nobody's
   *  questor gets nothing.
   *
   *  Unlike SetupIndividualStaticNPC, C# does NOT write the back-link
   *  `person.QuestResourceBehaviour` here - only AssignResource runs,
   *  and the port's assignResource fills that link exactly when it is
   *  empty, which is the same shape. */
  assignQuestResourceBehaviour(host, npcData) {
    const questorPerson = this.activeQuestor(npcData);
    if (questorPerson == null) return null;
    if (host?.questBehaviour) return null;
    const behaviour = new QuestResourceBehaviour(this, host ?? null);
    behaviour.assignResource(questorPerson);
    behaviour.start();
    if (host) host.questBehaviour = behaviour;
    console.log(`[quest] Added new QuestResourceBehaviour and assigned Questor Person resource ${questorPerson.displayName}`);
    return behaviour;
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
   *  a quest message - tokens at DEFAULT expansion (the macro pass AND
   *  the dialog reveal, which GetTextTokens does unconditionally; the
   *  earlier "no dialog reveal" here was written against a
   *  fourth-parameter the port had invented and AUDIT 24 removed. The
   *  variant draw rides quest.rolls, Ledger A),
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
      // AUDIT 24 (the seven-slice sweep): C# gets Start() for free -
      // AddComponent schedules it and Unity runs it on the next frame,
      // AFTER the AssignResource above, which is exactly why
      // QuestResourceBehaviour.Start warns "This will fail if
      // targetQuest and targetSymbol are not set before Start()"
      // (:127). The port's stand-in for that lifecycle is an explicit
      // start(), which sceneMount calls at all three of its mints and
      // this one did not - so the bootstrap behaviour came back
      // permanently uncached, with targetResource null. Its own guard
      // handles the no-person case (questUID 0 returns false), which
      // is what C#'s deferred Start does there too.
      behaviour.start();
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
      // AUDIT 24 (the seven-slice sweep): THE 64 GLOBALS WERE IN NO
      // ENVELOPE AT ALL. DFU keeps them on PlayerEntity.GlobalVars and
      // serialises them with the PLAYER
      // (SerializablePlayer.cs:134, :303 -
      // SerializeGlobalVars/DeserializeGlobalVars); the port homed
      // them on the machine, where getSaveData wrote two keys and
      // clearState wiped four, and this store was in neither. Every
      // SAVEVARS.DAT flag a quest had set - the main quest's own
      // progress among them - was lost on save and reset on load. They
      // ride this envelope rather than the player's because that is
      // where the port's store lives; the same file carries both.
      globalVars: [...this.globalVars.entries()],
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
    // AUDIT 24: the globals are NOT cleared here, and that is C#'s
    // shape - ClearState (:533-546) wipes the machine's own four
    // collections, while the globals live on PlayerEntity and are
    // replaced wholesale by the player restore that follows.
    this.quests.clear();
    this.siteLinks = [];
    this.questsToInvoke = [];
    this.lastNPCClicked = null;
  }

  restoreSaveData(data) {
    this.siteLinks = (data.siteLinks ?? []).map((l) => structuredClone(l));
    // AUDIT 24: the globals ride the envelope now. A pre-AUDIT-24 save
    // carries none, which leaves whatever the fresh machine holds -
    // the all-false start, which is the additive-field shape DFU's own
    // serializer gives a missing member.
    if (data.globalVars) this.globalVars = new Map(data.globalVars);
    const nowSeconds = () => this.deps.nowSeconds?.() ?? 0;
    for (const questData of data.quests ?? []) {
      try {
        const quest = new Quest({ nowSeconds, actionFactory: this._actionFactory, hooks: this._buildHooks() });
        quest.restoreSaveData(questData, this._saveResolvers());
        if (this.quests.has(quest.uid)) throw new Error('An item with the same key has already been added.');
        this.quests.set(quest.uid, quest);
      } catch (e) {
        // QuestMachine.cs:1935-1938 uses LogWarningFormat / string.Format,
        // which render a null argument as EMPTY; a bare `${null}` in JS
        // is the four-letter string "null" (wave 26).
        const dn = questData.displayName ?? '';
        console.warn(`[quest] Failed to load quest data for '${dn} [${questData.questName}]' with UID ${questData.uid}. This is expected after removing a mod with custom quest actions. Exception message is '${e?.message ?? e}'`);
        this.deps.addHUDText?.(`Failed to load quest '${dn} [${questData.questName}]'. This is expected if quest mod removed.`);
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
    // RaiseOnQuestEndedEvent (QuestMachine.cs:1047) - LAST, after the
    // dispose, the tombstone and the SiteLink scrub, C#'s own order.
    // The HUD escorting faces' "unlike Daggerfall" sweep rides it.
    this.deps.onQuestEnded?.(quest);
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

  /** Add/RemoveFactionListener (QuestMachine.cs:1174-1198): first
   *  claim wins, a missing claim is a no-op.
   *
   *  AUDIT 24 (wave 25): three comments here named TALKMANAGER as the
   *  reader and marked the wiring "(Q4 wires)". Neither is true.
   *  `HasFactionListener` has exactly one consumer in the whole DFU
   *  tree - PlayerActivate.StaticNPCClick:1534, which returns before
   *  any routing when a quest is listening on the clicked NPC's
   *  faction ("This effectively shuts down several named NPCs during
   *  main quest") - and TalkManager.cs does not contain the word
   *  Listener at all. The port already ships that reader, at
   *  src/scenes/worldModes.js:451. A pending marker over shipped work
   *  is worse than no marker: it sends the next reader looking for
   *  work that is done, in a file that never had it. */
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
