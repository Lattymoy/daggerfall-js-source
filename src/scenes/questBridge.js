// THE QUEST BRIDGE (Q4-v) - the machine goes LIVE in the hosts. One
// module owns the wiring: it builds the QuestMachine over the world
// seam the host composes, the QuestListsManager over the vendored
// pack (scenes/questData.js loads it in the browser; tests feed fs),
// the offer flow, and the player notebook - and hands the scenes a
// small verb set: tick with the frame, click an NPC, open the Quests
// service, mount a scene's quest resources, snapshot/restore the
// whole envelope. Everything here is PURE WIRING over the pinned
// Q1-Q4 law modules - node-testable with a mock ctx; the scenes pass
// their live objects.
//
// ctx (the host's contract; every member optional unless noted):
//   data: { readListTable(name), getQuestSourceLines(name) }  REQUIRED
//   world                       - the machine's deps.world, composed by
//                                 the host per machine.js's contract
//                                 (maps/getBlock/player state/...);
//                                 absent members idle, and the bridge
//                                 NAMES them once at construction -
//                                 the headless charter (AUDIT-QUEST F1)
//   classicSeconds()            - the classic game clock in seconds
//                                 (the ticker's minutes * 60) - TIME3:
//                                 the quest's clock, the CHARACTER's
//                                 own online (playerTicker.ownMinutes;
//                                 the one clock offline)
//   skySeconds()                - TIME3: the sky (skyMinutes() * 60) -
//                                 a quest's hour, date and season
//   worldSeconds()              - TIME3: the event clock (worldMinutes()
//                                 * 60) - the journal's dates
//   raisedSeconds()             - TIME3: the session's raises
//                                 (raisedMinutes() * 60), charged nothing (QCLOCK-WORLD)
//   playerEntity                - { name, level, gender, ... }
//   playerRaceName()            - the birth race name (%ra)
//   getReputation(factionId)    - factionRep.getReputation over the
//                                 player's store
//   getGoldPieces()/deductGoldPieces(n)/deductGold(n)/addGold(n),
//   giveItemToPlayer(dfItem),
//   removeItemFromPlayer, playerHasItem, carriesQuestItem,
//   releaseQuestItem, makeHeldQuestItemsPermanent, offerReward,
//   isPlayerInTown()            - the item/click seams (Q2b)
//   showPopup(quest, tokens)    - ONE already-expanded message box
//                               (tokens ride the
//                                 message; the host chunks)
//   addHUDText(text), playVideo(name), playSound(id)
//   playSong(name)              - one MIDI.BSA record name; the
//                                 PlaySong action has already resolved
//                                 the SongFiles member (systems/
//                                 songFiles.js)
//   the talk seams              - addQuestTopics/dialogLink/addDialog/
//                                 rumor + scrub family (TalkManager's
//                                 consumers pend the talk arc; absent
//                                 is silent, recorded)
//   isPlayerInsideCastle(), removeNpcQuestor(nameSeed),
//   getGuildFactionId(guildGroup) - the offer flow's own seams
//   dateTimeString()/midDateTimeString()/cityName() - the notebook's
//   onQuestStarted(quest)       - extra listener beside the one-time
//                                 recording (optional)
//
// THE NPC-DATA LAW (StaticNPC.cs:210-224, :331-337) lives here too:
// the hash is x ^ y<<2 ^ z>>2 over the RAW layout ints; the nameSeed
// is position ^ (buildingKey + locationIndex) - C#'s + binds TIGHTER
// than ^, the famous precedence, kept; gender is flags & 32; the
// billboard indices ride along for the questor flat-pick (Q4-iii).

import { QuestMachine, TICKS_PER_SECOND } from '../systems/quest/machine.js';
import { clockCounts } from '../systems/quest/clock.js';   // DEAD-CLOCK: a clock whose end changes nothing is no deadline
import { repairActiveQuests } from '../systems/quest/questRepair.js';   // QREPAIR: the Settings' repair
import { QuestListsManager } from '../systems/quest/questLists.js';
import { QuestOfferFlow } from '../systems/quest/offerFlow.js';
import { PlayerNotebook } from '../systems/notebook.js';
import { GENDERS } from '../characters/nameHelper.js';
import { ZERO_NPC_DATA, NPC_CONTEXT, raceFromFaction } from '../characters/staticNpc.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';
import { expandMacroValues, setMacroWorld } from '../systems/quest/questMacros.js';   // GQL1: the wait box's %pcf
import { firstName } from '../systems/talkSession.js';
import { getBool } from '../systems/settings.js';
import { noteOfferPending } from '../ui/pendingOffer.js';   // AUDIT 58: DaggerfallUI's GivePc.OnOfferPending subscription
import { getTitle } from '../systems/guilds.js';
import { addQuestResourceObjects } from '../systems/quest/sceneMount.js';
import { QuestLens } from '../ui/questLens.js';   // GUIDE1: the modern faces' one read-only picture of this machine
import { questHerald, heraldOn } from '../ui/questHerald.js';   // GUIDE3: the news the lens sees, told
import { questTracker, followOn } from '../ui/questTracker.js';   // GUIDE4: the quest the HUD follows (GUIDE5: the card's or the marks')

// AUDIT 24 (wave 24): SetLayoutData's three overloads and
// GetPositionHash now live in characters/staticNpc.js, next to the
// rest of StaticNPC.cs. They were here AND there: staticNpc.js had a
// stale copy of the layout overload that predated the seven-slice
// sweep's corrections - no race, no context, no zero-struct base, and
// a gender written as the STRING 'female' where this one writes the
// Genders enum the way C# does. Re-exported so the bridge's callers
// are unchanged.
import { positionHash, staticNpcData, layoutNpcData } from '../characters/staticNpc.js';

export { positionHash, staticNpcData, layoutNpcData };

/** Guild.IsSatisfyQuestReqByLevel: base FALSE; the two overrides are
 *  MagesGuild.cs:67 and KnightlyOrder.cs:83 - player level stands in
 *  for rank on their quest gates. */
export const SATISFY_QUEST_BY_LEVEL_GROUPS = Object.freeze([GUILD_GROUPS.MagesGuild, GUILD_GROUPS.KnightlyOrder]);

/** The offer flow's Guild surface composed from the port's pieces:
 *  the U-series guild object (divine name), the membership record
 *  (rank), and the faction store (reputation on the guild's own
 *  faction). */
export function offerGuildSurface({ guildGroup, guild, membership, reputation, playerEntity = null }) {
  return {
    isMember: () => membership != null,
    rank: membership?.rank ?? 0,
    deity: guild?.divine ?? '',
    getReputation: () => reputation ?? 0,
    isSatisfyQuestReqByLevel: () => SATISFY_QUEST_BY_LEVEL_GROUPS.includes(guildGroup),
    // AUDIT 24 (the seven-slice sweep): THE SECOND MACRO PROVIDER.
    // Guild implements IMacroContextProvider (Guild.cs:355-380) and
    // the offer flow lends it to the quest as ExternalMCP, which
    // MacroHelper.GetValue consults when the quest's own source answers
    // NOT_IMPLEMENTED. The port's macro engine reads a provider as
    // `{ quest, source }` and `source(mcp) = mcp?.source ?? null`, so
    // the RAW guild object it was handed had no source at all - and
    // that `?? null` makes a wrong-shaped provider indistinguishable
    // from no provider, so %pct degraded silently to its mcp-null arm,
    // the PLAYER'S NAME. 42 corpus quests use %pct; a guild offer read
    // "Arkay be with you, Bob Smith." where DFU says "...Curate."
    // GuildMacroDataSource answers exactly two macros.
    source: {
      guildTitle: () => getTitle(membership, playerEntity, guild),
      amount: () => String(guild?.trainingPrice ?? 0),
    },
  };
}

/** Message tokens -> parchment rows (the ServiceFlowWindow shape):
 *  text tokens append to the line, every formatting token breaks it -
 *  the same pairing loadMessage emits. */
export function tokensToRows(tokens) {
  const rows = [];
  let line = '';
  let sawText = false;
  for (const token of tokens ?? []) {
    if (token.formatting === 'text') { line += token.text; sawText = true; continue; }
    rows.push(line);
    line = '';
    sawText = false;
  }
  if (sawText) rows.push(line);
  return rows;
}

/** StartGameBehaviour.cs:445-447 - the two quests a new character
 *  always starts, in this order. _BRISIEN is the main quest's first. */
export const GAME_START_QUESTS = Object.freeze(['_TUTOR__', '_BRISIEN']);

/**
 * THE CONTRACT, AND THE ONE LINE THAT SAYS WHAT A HOST DID NOT WIRE.
 *
 * AUDIT-QUEST F1/F2/F3, 2026-09-15. Three findings, one root cause: this
 * bridge never stated what it was given.
 *
 *   F1 - THE WORD "LOUDLY" WAS WRITTEN OVER AN OPERATION THAT IS
 *   SILENT. The header above said "absent members idle LOUDLY, the
 *   headless charter", and `machine.js` says the same of every Place
 *   pending its site. What actually happened was `sitePending = true` -
 *   a boolean. MEASURED: all 265 vendored quests start with no world
 *   seam at all, and 262 of them emit nothing whatsoever. Across the
 *   quest system 215 of 229 optional-chained seam calls are silent on
 *   absence.
 *
 *   F2 - `scenes/exterior.js` wires 30 of these 65 members. The 35 it
 *   does not include the whole item family, the reward, the disease and
 *   curse cures, video, song, and every talk and rumor seam - and
 *   `?exterior` is the scene a developer would reach for to test a
 *   quest. Nothing said so.
 *
 *   F3 - the gate that exists to catch exactly that,
 *   `test/audit24_questseams.test.js`'s "every bridge ctx seam is
 *   SUPPLIED or declared PENDING", opened `src/scenes/world.js` BY NAME
 *   and never looked at any other host.
 *
 * So the bridge reports, once, at construction. One line, naming what is
 * absent - which is what "loudly" was always supposed to mean.
 *
 * THE LIST IS GATED AGAINST THE BRIDGE'S OWN USAGE, both ways
 * (`test/auditquest_seams.test.js`), because a hand-kept contract list
 * would be F3 again in a new place.
 */
/** Every ctx member this bridge reads. DERIVED once and written down,
 *  and `test/auditquest_seams.test.js` re-derives it from this file's
 *  own source on every run and fails if the two disagree in EITHER
 *  direction - a member added to the code and not to this list, or a
 *  name here the bridge stopped reading. */
export const QUEST_CTX_CONTRACT = Object.freeze([
  'addDialog', 'addFace', 'addGold', 'addHUDText', 'addProgressRumor',
  'addQuestRumor', 'addQuestTopics', 'addQuestorPostMessage',
  'carriesQuestItem', 'changeLegalRep', 'changeReputation', 'cityName',
  'classicSeconds', 'clearEnemies', 'cureDisease', 'data',
  'dateTimeString', 'deductGold', 'deductGoldPieces', 'dialogLink',
  'dropFace', 'endLycanthropy', 'endVampirism', 'forceTopicListsUpdate',
  'getGoldPieces', 'getGuild', 'getGuildFactionId',
  'getReputation', 'getTotalGold', 'giveItemToPlayer', 'hasQuestTopics',
  'isPlayerInTown', 'isPlayerInsideCastle', 'makeEnemiesHostile',
  'makeHeldQuestItemsPermanent', 'makePcDiseased', 'midDateTimeString',
  'offerReward', 'onQuestEnded', 'onQuestStarted', 'ownMinutes', 'partySize', 'playSong',
  'playSound', 'playVideo', 'playerEntity', 'playerHasItem',
  'playerRaceName', 'questClockStepMax', 'questFoeInstances', 'questWhere',   // GUIDE4: the host's two questions for the lens's look
  'raiseTime', 'raisedSeconds', 'regionPriceAdjustment', 'releaseQuestItem',
  'relinkQuestTopics', 'removeItemFromPlayer', 'removeNpcQuestor',
  'removeProgressRumors', 'removeQuestInfoTopics', 'removeQuestRumors',
  'removeQuestorPostMessage', 'setPlayerCrime', 'sharedClock', 'showPopup',
  'showPrompt', 'showPromptMulti', 'skySeconds', 'spawnCityGuards',
  'undiscoverBuilding', 'waitOnline', 'world', 'worldSeconds',
]);

export const QUEST_CTX_REQUIRED = Object.freeze(['data']);

/** Members a host may decline on purpose. `onQuestStarted` is an EXTRA
 *  listener beside the bridge's own one-time recording, and the shipping
 *  host declines it - so its absence is not worth a word. */
export const QUEST_CTX_OPTIONAL_BY_DESIGN = Object.freeze(['onQuestStarted', 'hasQuestTopics']);   // QREPAIR: only a host with a topic tree can say whether a quest has its topics

/**
 * What this host did not wire. Returned as well as logged, so a caller
 * (or a test) can read it rather than scrape the console.
 */
export function reportUnwiredSeams(ctx, contract, label = 'host') {
  const absent = contract.filter((k) => ctx?.[k] == null && !QUEST_CTX_OPTIONAL_BY_DESIGN.includes(k));
  const missingRequired = QUEST_CTX_REQUIRED.filter((k) => ctx?.[k] == null);
  if (missingRequired.length) {
    console.error(`[quest] ${label} wired NO ${missingRequired.join(', ')} - the bridge cannot read quest source without it`);
  }
  if (absent.length) {
    console.warn(`[quest] ${label} wired ${contract.length - absent.length}/${contract.length} seams; `
      + `absent (these quest verbs will idle): ${absent.join(', ')}`);
  }
  return absent;
}

export function createQuestBridge(ctx, { label = 'host' } = {}) {
  // F1: the charter's "loudly", made true - one line, at construction.
  reportUnwiredSeams(ctx, QUEST_CTX_CONTRACT, label);
  const notebook = new PlayerNotebook({
    dateTimeString: () => ctx.dateTimeString?.() ?? '',
    midDateTimeString: () => ctx.midDateTimeString?.() ?? '',
    cityName: () => ctx.cityName?.() ?? '',
  });

  let questLists = null;
  const machine = new QuestMachine({
    world: ctx.world ?? null,
    nowSeconds: () => ctx.classicSeconds?.() ?? 0,
    // TIME3 (bible/06-Systems/Online-Time-Arc.md 6.3): the sky, the event clock and the session's raises beside the
    // character's clock above - null where a host names none (the machine falls back to the one clock)
    skySeconds: () => ctx.skySeconds?.() ?? null,
    worldSeconds: () => ctx.worldSeconds?.() ?? null,
    raisedSeconds: () => ctx.raisedSeconds?.() ?? null,
    // AUDIT LIVED1b D1 (A1, O6): the character's clock, for the stamps a quest makes on it (TrainPc's training time) -
    // AUDIT LIVED1 D gave the machine the hook and world.js the member, and the deps below are built key by key, so the
    // member never reached the machine: TrainPc stamped the world's minute, the guild's gate read the character's
    // (refused for 84 days of their time behind the world, open at once ahead of it)
    ownMinutes: () => ctx.ownMinutes?.() ?? null,
    questClockStepMax: () => ctx.questClockStepMax?.() ?? Infinity,   // WORLD7: online, a quest clock bounds the LIVED part of a gap to the host's step, a raise charged nothing (QCLOCK-WORLD; TIME3 charged it whole); a host that says nothing charges every clock, DFU's own
    sharedClock: () => !!ctx.sharedClock?.(),   // GUARD-ONLINE: online, a guarded quest's window is the player's arrival's (quest/onlineGuard.js)
    getQuestSourceLines: (name) => ctx.data.getQuestSourceLines(name),
    playerLevel: () => ctx.playerEntity?.level ?? 0,
    playerGender: () => ctx.playerEntity?.gender ?? 'male',
    playerName: () => ctx.playerEntity?.name ?? null,
    playerRaceName: () => ctx.playerRaceName?.() ?? null,
    playerEntity: ctx.playerEntity ?? null,   // M-X: the macro globals (vitals, %ski, the biography modifiers)
    // Q5: the un-pended actions' host doors
    setPlayerCrime: (crime) => ctx.setPlayerCrime?.(crime),
    getGoldPieces: () => ctx.getGoldPieces?.() ?? 0,
    deductGoldPieces: (n) => ctx.deductGoldPieces?.(n),
    raiseTime: (seconds) => ctx.raiseTime?.(seconds),
    waitOnline: (seconds, quest) => ctx.waitOnline?.(seconds, quest),   // FORAGE4: online, QAE's raise time is the host's wait (scenes/foragingWait.js)
    spawnCityGuards: (immediate) => ctx.spawnCityGuards?.(immediate),
    makeEnemiesHostile: () => ctx.makeEnemiesHostile?.(),
    clearEnemies: () => ctx.clearEnemies?.(),
    questFoeInstances: (symbol) => ctx.questFoeInstances?.(symbol) ?? [],   // MT-iii
    getReputation: (fid) => ctx.getReputation?.(fid) ?? 0,
    getTotalGold: () => ctx.getTotalGold?.() ?? 0,   // PayMoney's `money` arm - GetGoldAmount
    deductGold: (n) => ctx.deductGold?.(n),
    addGold: (n) => ctx.addGold?.(n),
    addHUDText: (t) => ctx.addHUDText?.(t),
    showPopup: (q, tokens) => ctx.showPopup?.(q, tokens),
    showPrompt: (q, message, respond) => ctx.showPrompt?.(q, message, respond),
    // QG1: PromptMulti's box - 2-4 BUTTONS.RCI records, the click
    // answering the record number back (the action routes by value)
    showPromptMulti: (q, message, buttons, respond) => ctx.showPromptMulti?.(q, message, buttons, respond),
    playVideo: (name) => ctx.playVideo?.(name),
    playSound: (id) => ctx.playSound?.(id),
    playSong: (name) => ctx.playSong?.(name),
    giveItemToPlayer: (item, front) => ctx.giveItemToPlayer?.(item, front),
    removeItemFromPlayer: (item) => ctx.removeItemFromPlayer?.(item),
    playerHasItem: (item) => ctx.playerHasItem?.(item) ?? false,
    carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false,
    releaseQuestItem: (uid, item) => ctx.releaseQuestItem?.(uid, item),
    makeHeldQuestItemsPermanent: (uid, sym) => ctx.makeHeldQuestItemsPermanent?.(uid, sym),
    offerReward: (q, item) => ctx.offerReward?.(q, item),
    isPlayerInTown: () => ctx.isPlayerInTown?.() ?? false,
    partySize: () => ctx.partySize?.() ?? 1,   // REALM P0.4: a shared quest's gold, split
    // AUDIT 58: DaggerfallUI.Awake's one subscription to GivePc's
    // static OnOfferPending event (DaggerfallUI.cs:352) - the handler
    // latches the sender and nothing else (:1731-1735). The two key
    // presses that spend the latch live in the hosts' rest and
    // fast-travel doors, through ui/pendingOffer.js's giveOffer().
    // That is the WHOLE of the subscription - no host fan-out to
    // forget to mount, because DFU has no second subscriber.
    onOfferPending: (givePc) => noteOfferPending(givePc),
    getGuild: (fid) => ctx.getGuild?.(fid) ?? null,
    regionPriceAdjustment: () => ctx.regionPriceAdjustment?.() ?? 0,
    changeReputation: (fid, amount, propagate) => ctx.changeReputation?.(fid, amount, propagate),
    changeLegalRep: (amount) => ctx.changeLegalRep?.(amount),
    makePcDiseased: (t) => ctx.makePcDiseased?.(t),
    cureDisease: (t) => ctx.cureDisease?.(t),
    endVampirism: () => ctx.endVampirism?.(),
    endLycanthropy: () => ctx.endLycanthropy?.(),
    // the talk seams (the talk arc's consumers; silent while absent)
    addQuestTopics: (q) => ctx.addQuestTopics?.(q),
    relinkQuestTopics: (q) => ctx.relinkQuestTopics?.(q),   // AUDIT 68 S29-share-topics: a resync's rebuilt resources
    dialogLink: (...a) => ctx.dialogLink?.(...a),
    addDialog: (...a) => ctx.addDialog?.(...a),
    addQuestRumor: (uid, m) => ctx.addQuestRumor?.(uid, m),
    addProgressRumor: (uid, m) => ctx.addProgressRumor?.(uid, m),
    addQuestorPostMessage: (uid, m) => ctx.addQuestorPostMessage?.(uid, m),
    removeProgressRumors: (uid) => ctx.removeProgressRumors?.(uid),
    removeQuestorPostMessage: (uid) => ctx.removeQuestorPostMessage?.(uid),
    removeQuestRumors: (uid) => ctx.removeQuestRumors?.(uid),
    removeQuestInfoTopics: (uid) => ctx.removeQuestInfoTopics?.(uid),
    undiscoverBuilding: (buildingKey, buildingName) => ctx.undiscoverBuilding?.(buildingKey, buildingName),   // AUDIT 63 F0: Quest.cs:655's tombstone sweep
    forceTopicListsUpdate: () => ctx.forceTopicListsUpdate?.(),
    addFace: (r) => ctx.addFace?.(r),
    dropFace: (r) => ctx.dropFace?.(r),
    // Q4-iv: the tombstone filing lands in the notebook here
    addFinishedQuest: (messages) => notebook.addFinishedQuest(messages),
    // the one-time recording IS the OnQuestStarted subscription
    onQuestStarted: (q) => { questLists.noteQuestStarted(q); ctx.onQuestStarted?.(q); },
    // FE1: the tombstone's OnQuestEnded (QuestMachine.cs:1047) - the
    // HUD escort faces' quest-end sweep rides the world ctx
    onQuestEnded: (q) => ctx.onQuestEnded?.(q),
  });
  // MACRO-ONE: this machine's hooks are the page's GameManager for every
  // macro walk that is not handed a context of its own (questMacros.js
  // setMacroWorld) - one registration, every window, every host.
  setMacroWorld(() => machine.macroContext());

  questLists = new QuestListsManager({
    readListTable: (name) => ctx.data.readListTable(name),
    getQuestSourceLines: (name) => ctx.data.getQuestSourceLines(name),
    parseQuest: (lines, factionId, partialParse) =>
      machine.parseQuestForLists(lines, factionId, { partialParse }),
    // AUDIT 24 (the seven-slice sweep): a LIVE read, not a hardcoded
    // false. DaggerfallUnity.Settings.PlayerNudity is a real setting
    // the port already stores and the launcher already renders as a
    // toggle - and questLists.js:203 gates adult quests on it, so
    // flipping it did nothing at all. A GETTER because C# reads the
    // setting at the point of use, and the consumer reads
    // `deps.playerNudity` as a value.
    get playerNudity() { return getBool('ChildGuard', 'PlayerNudity'); },
  });

  const offerFlow = new QuestOfferFlow(machine, questLists, {
    isPlayerInsideCastle: () => ctx.isPlayerInsideCastle?.() ?? false,
    removeNpcQuestor: (seed) => ctx.removeNpcQuestor?.(seed),
    getGuildFactionId: (g) => ctx.getGuildFactionId?.(g) ?? 0,
    // likewise: offerFlow.js:156 branches on this and the launcher
    // offers it, so the list-box arm was unreachable. Defaults off,
    // which is the classic random draw.
    get guildQuestListBox() { return getBool('Enhancements', 'GuildQuestListBox'); },
  });

  // QuestMachine.Update's pacing (QuestMachine.cs:305-320): tick at
  // ticksPerSecond of REAL time; the timer resets to ZERO on fire,
  // dropping the excess, verbatim.
  let updateTimer = 0;
  function tick(dtSeconds) {
    updateTimer += dtSeconds;
    if (updateTimer < 1 / TICKS_PER_SECOND) return false;
    machine.tick();
    updateTimer = 0;
    news();
    return true;
  }

  // GUIDE3: THE NEWS - one lens look after each machine tick, handed to
  // the herald (ui/questHerald.js), and only while it is listening (the
  // enhanced skin, its switch on), so a player who never hears it never
  // pays for the look. Here rather than in a host because every host
  // that has quests ticks this bridge (THE ONE CONSTRUCTION SEAM): the
  // news reaches all of them at once. A herald that starts listening
  // mid-game hears a baseline first, never the backlog of whatever
  // happened while it was off - the lens's: a look after a stretch with
  // no look is one (AUDIT GUIDE L8), and a lens the tracker kept looking
  // has no backlog, only this tick's news (AUDIT GUIDE H11: a flag of the
  // bridge's own dropped that tick). The look is the lens's quiet one
  // (GUIDE1's pin plays a game with a look at every tick and without:
  // the same save, the same popups, the same draws), and a look that
  // throws costs the news and never the frame: the machine has ticked.
  //
  // GUIDE4: THE TRACKER hears the same look - every one, the baseline
  // included, because what it shows is the quests as they stand and not
  // only what changed - and the look answers the host's own two questions
  // (`ctx.questWhere`: is a place on the player's map, which place is the
  // player in - GUIDE2's gates), so the card can say "(you are here)".
  let newsWarned = false, lookedLast = false, textHour = null;
  const warnNewsOnce = (err) => {
    if (newsWarned) return;
    newsWarned = true;
    console.warn(`[quest herald] the lens could not look (${err?.message ?? err}); the news is silent, the machine is not`);
  };
  // GUIDE5: THE QUEST THE PLAYER FOLLOWS has two faces now - the tracker's
  // card and the marks (ui/questMarks.js) - and one model (questTracker):
  // it hears every look while either face is on, and when neither is, what
  // it followed is forgotten here (the player's tracked choice is the
  // save's and stays).
  function news() {
    const herald = heraldOn(), follow = followOn();
    // AUDIT GUIDE T3: the tracked quest is let go when it is gone - every tick, faces on or off, so no save carries
    // a uid a later quest could be minted under (the uid counter is re-derived from the loaded quests, Q4-iv)
    if (questTracker.pinned != null) {
      const q = machine.quests.get(Number(questTracker.pinned));
      if (!q || q.questComplete) questTracker.pinned = null;
    }
    if (!follow && (questTracker.views.length || questTracker.follow != null)) questTracker.forget();
    if (!herald && !follow) { lookedLast = false; return; }
    // AUDIT GUIDE L8/T8: a look after a stretch with no look at all is a baseline, not a diff against the look before
    // the gap - its "news" would be the backlog in the walk's order, and the card would follow the last of it
    if (!lookedLast) lens.reset();
    lookedLast = true;
    // AUDIT GUIDE L6: a kept line whose macros read the world as it is (a clock's days, %di) is read again each game
    // hour - the card's opening says what the journal says now
    // TIME3: on either clock's hour - a clock's days run on the character's, %di and the dates on the sky's
    const hour = `${Math.floor((ctx.classicSeconds?.() ?? 0) / 3600)}|${Math.floor((ctx.skySeconds?.() ?? 0) / 3600)}`;
    if (textHour !== hour) { if (textHour != null) lens.rereadText(); textHour = hour; }
    // AUDIT GUIDE L4: the look AND its listeners: a face that throws costs the news, never the frame
    try {
      const seen = lens.look(ctx.questWhere ?? {});
      if (follow) questTracker.hear(seen);
      if (herald) questHerald.hear(seen);
    } catch (err) { warnNewsOnce(err); }
  }

  /** GetRaceFromFaction's two inputs, off the machine's own world. */
  const npcRaceLookups = () => ({
    getFaction: (id) => ctx.world?.getFactionData?.(id) ?? null,
    raceOfCurrentRegion: () => ctx.world?.currentRegionRace?.() ?? 0,
  });

  // GUIDE1: the quest lens is made HERE, once, over this bridge's own
  // walk - THE ONE CONSTRUCTION SEAM: every host that has quests holds
  // the bridge, so no host builds a lens of its own - and a load resets
  // it (restore, below), so the loaded game's quests are its baseline.
  const lens = new QuestLens({ questLog: () => bridge.questLog() });

  const bridge = {
    machine, questLists, offerFlow, notebook, lens,
    tick,

    /**
     * MAC-K2 - THE QUEST WALK, ONE HOME.
     *
     * `{active, finished, ended}`: one row per live quest that has
     * written a log entry, its messages in the machine's own order
     * (and, GUIDE1, the step each was written at), and the TIGHTEST
     * RUNNING clock on the quest's resources (Clock carries
     * `remainingTimeInSeconds` in game seconds beside
     * `clockEnabled`/`clockFinished`, quest/clock.js:329,164). The
     * archive is the notebook's filed entries; `ended` the completed
     * quests the machine still holds, with their verdict.
     *
     * IT WAS WRITTEN THREE TIMES - world.js's pause hooks,
     * dungeonContext.js's, and exterior.js's `pauseQuestLog`, whose own
     * comment said "world.js keeps two copies of this walk; two copies
     * is two laws the day one of them moves". MAC-K2 needed a FOURTH
     * reader (the chronicle's Quests section, which is what the L key
     * opens), so the walk moved here instead - the bridge is the one
     * thing every host that has quests already holds.
     */
    questLog() {
      const active = [];
      // GUIDE1: a quest that has COMPLETED - its log is gone
      // (Quest.getLogMessages answers null) but it lingers a week as a
      // tombstone - with the verdict the notebook files it under
      // ('completed' when the quest paid out, notebook.js
      // _createFinishedQuest). The quest lens reads it to say how a
      // quest it was showing ended.
      const ended = [];
      for (const q of machine.quests.values()) {
        if (q.questComplete) {
          notebook?.unhideQuest?.(q.uid);   // JOURNAL-CLEAN: an ended quest is no longer hidden (one that filed no entry never reached addFinishedQuest's drop)
          ended.push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', success: !!q.questSuccess });
          continue;
        }
        const les = q.getLogMessages();
        if (!les?.length) continue;
        // GUIDE1: each message beside the step it was written at -
        // `steps[i]` is `messages[i]`'s - so a face can order the
        // entries by when they were written (ui/questRail.js
        // writtenOrder) and tell a new one from one it has read.
        const messages = [], steps = [];
        for (const le of les) {
          const message = q.getMessage(le.messageID);
          if (!message) continue;
          messages.push(message);
          steps.push({ stepID: le.stepID, messageID: le.messageID, time: le.time ?? null });
        }
        if (!messages.length) continue;
        let clockSeconds = null;
        const clocks = [];   // AUDIT GUIDE H1: each counting clock by name - the lens counts only one the journal names
        // REST8 (2026-10-03, bible/06-Systems/Rest-Arc.md section 8; Mac's OPEN 12): online a DELAY is no time left to
        // show - it lands on the short wait (quest/clock.js waitsShort) - so the walk skips it, and no surface it feeds
        // counts a letter down; a DEADLINE keeps its "Time remains", its rail line and the herald's urgency, in played
        // time. TIMEFREE's walk skipped every clock online.
        for (const r of q.resources.values()) {
          if (r.waitsShort) continue;   // REST8
          if (r.clockEnabled && !r.clockFinished && Number.isFinite(r.remainingTimeInSeconds) && clockCounts(q, r)) {   // DEAD-CLOCK
            const left = r.liveRemainingSeconds(q);   // QT-LIVE1: as of NOW, not as of the last tick the pause gate let through
            clockSeconds = clockSeconds == null ? left : Math.min(clockSeconds, left);
            clocks.push({ name: r.symbol?.name ?? '', seconds: left });
          }
        }
        active.push({ id: String(q.uid), name: q.displayName || null, questName: q.questName || '', clockSeconds, clocks, messages, steps });
      }
      // JOURNAL-CLEAN: `hidden` is the uids the player hid from the journal. The rows stay in `active` - the lens,
      // the tracker and the marks read this walk and a hidden quest still runs - and the journal's rail
      // (ui/questRail.js) is what leaves them out.
      // AUDIT JOURNAL-CLEAN F3: an id hidden for a quest no longer running is dropped - whatever ended it
      notebook?.pruneHiddenQuests?.([...machine.quests.values()].filter((q) => !q.questComplete).map((q) => q.uid));
      return { active, finished: notebook?.getFinishedQuests() ?? [], ended, hidden: notebook?.getHiddenQuests?.() ?? [] };
    },

    /**
     * JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from
     * your journal for a cleaner look?"): the enhanced journal's four tidy-ups, one home - every host that hands its
     * pause window `questLog` hands `journalClean` beside it (world.js, worldModes.js through world.js's host,
     * exterior.js, dungeonContext.js). Removing an archived entry and clearing the archive act on the notebook's
     * filed entries (the classic logbook's right-click remove, ui/questJournal.js removeEntry, is the same store);
     * hide/unhide only file a uid in the notebook's hidden list, which saves with the notebook.
     */
    journalClean: {
      /** The archived entry at notebook index `i` (the rail's `f:<i>` key); answers whether one went. */
      removeFinished(i) {
        if (!notebook || !Number.isInteger(i) || i < 0 || i >= notebook.getFinishedQuests().length) return false;
        notebook.removeFinishedQuest(i);
        return true;
      },
      /** Every archived entry; answers how many went. */
      clearFinished() {
        const n = notebook?.getFinishedQuests().length ?? 0;
        notebook?.clearFinishedQuests();
        return n;
      },
      hide: (id) => notebook?.hideQuest(id) ?? false,
      unhide: (id) => notebook?.unhideQuest(id) ?? false,
    },

    /** SetLayoutData's direct overload for a host that has a quest
     *  Person rather than a block record (worldModes' quest-flat
     *  click). AUDIT 24: it is a bridge method now so the race lookup
     *  rides along - the host used to hand-roll the object literal and
     *  leave race and context off it. */
    layoutNpcData(fields) { return layoutNpcData({ ...fields, ...npcRaceLookups() }); },

    /** PlayerActivate's questor half: derive the NPCData and store the
     *  click (the Person sweep rides setLastNPCClicked). Answers the
     *  data for the caller's own use. */
    clickNpc(pn, sceneCtx) {
      const data = staticNpcData(pn, { ...sceneCtx, ...npcRaceLookups() });
      // wave 25: the person record IS the GameObject on this side -
      // StartQuest's tail attaches the questor behaviour to it.
      machine.setLastNPCClicked(data, pn ?? null);
      return data;
    },

    /** TK-iv: the SOCIAL door - a plain static-NPC click that the NPC
     *  session's questor pool answered for. TalkToStaticNPC opens
     *  DaggerfallQuestOfferWindow instead of the talk window when the
     *  clicked NPC is carrying work (:758-770), so this is the arm
     *  that finally makes a townsperson a questor. */
    /** G7: the daedric quest a successful summoning offers. */
    offerDaedricQuest(questName, summonerFactionId) {
      return offerFlow.offerNamedQuest(questName, summonerFactionId);
    },
    /** CW1: the coven popup's Quest button - the Witches pool as
     *  nonmember, homed on the witch NPC's own faction. */
    offerCovenQuest(factionId, reputation = 0) {
      return offerFlow.offerCovenQuest(factionId, reputation);
    },
    offerSocialQuest(npcData, socialGroup, menu = false) {
      return offerFlow.offerSocialQuest(npcData, socialGroup, menu);
    },

    /** The guild popup's Quests service (guildServiceFlow's questOffer
     *  destination): compose the offer-flow guild surface and run the
     *  guild door. */
    offerGuildQuest({ guildGroup, guild, membership, reputation, buildingFactionId = 0 }) {
      return offerFlow.offerGuildQuest({
        guildGroup,
        guild: offerGuildSurface({ guildGroup, guild, membership, reputation, playerEntity: ctx.playerEntity ?? null }),
        buildingFactionId,
      });
    },

    /** An offer-flow step as a ServiceFlowWindow box chain. C#'s
     *  silent faces ('close', a null step) show nothing. rows(id) is
     *  the host's TEXT.RSC record reader (townTalk.lines). */
    offerBoxes(step, rows) {
      if (!step) return [];
      switch (step.kind) {
        case 'close': return [];
        case 'fail': return [{ rows: rows?.(step.textId) ?? [] }];
        case 'offer': return [{
          rows: tokensToRows(step.prompt.tokens),
          buttons: 'YesNo',
          onYes: () => this.offerBoxes(step.respond(true), rows),
          onNo: () => this.offerBoxes(step.respond(false), rows),
        }];
        case 'accepted':
        case 'refused':
          return step.popup ? [{ rows: tokensToRows(step.popup.tokens) }] : [];
        // GQL1 (Discord, kurkku, 2026-09-21: "this service isn't
        // available" on every guild quest): with Choose Guild Jobs ON
        // the flow's first step is the 'gettingQuests' wait box and its
        // dismissal is the 'pickQuest' picker - and this switch boxed
        // neither, so the chain came back EMPTY, the questOffer arm
        // read empty as C#'s silent close, and the popup printed its
        // no-flow refusal. GettingQuestsBox (:610-622) is a
        // click-anywhere DaggerfallMessageBox whose generic macro pass
        // expands %pcf; its OnClose raises the DaggerfallListPickerWindow
        // (:624-652), whose pick runs OfferQuest and whose cancel just
        // pops the window.
        case 'gettingQuests': return [{
          rows: step.textLines.map((line) => expandMacroValues(line, { pcf: firstName(ctx.playerEntity?.name ?? '') })),
          onClick: () => this.offerBoxes(step.onClose(), rows),
        }];
        case 'pickQuest': return [{
          picker: step.entries,
          onPick: (index) => this.offerBoxes(step.onPick(index), rows),
          onCancel: () => [],
        }];
        default: return [];
      }
    },

    /** The scene mount (Q4-iii's walk) over the host's adapter. */
    mountScene(adapter, siteType, buildingKey = 0) {
      addQuestResourceObjects(machine, adapter, siteType, buildingKey);
    },

    /** QREPAIR (Mac: "Add a quest refresh option to settings" - "Repair active quests"): the one pass
     *  (systems/quest/questRepair.js) over this machine and this host's seams. Answers the report; `text` is the line
     *  the Settings row shows. */
    repair() {
      const world = ctx.world ?? null;
      return repairActiveQuests(machine, {
        discoverLocation: (region, location) => world?.discoverLocation?.(region, location),
        hasQuestTopics: ctx.hasQuestTopics ? (q) => ctx.hasQuestTopics(q) : null,
        addQuestTopics: ctx.addQuestTopics ? (q) => ctx.addQuestTopics(q) : null,
        carriesQuestItem: (item) => ctx.carriesQuestItem?.(item) ?? false,
        mountCurrentSite: () => world?.mountCurrentSiteQuestResources?.(),
      });
    },

    /** The NEW-GAME quest start, whole (StartGameBehaviour.cs:444-456).
     *
     *  AUDIT 24 (the seven-slice sweep): the port called only the
     *  InitAtGameStart half - and with vanilla tables that list is
     *  EMPTY, so a new character started no quests at all. The two
     *  lines above it in C# are hard-coded:
     *      QuestMachine.Instance.StartQuest("_TUTOR__");
     *      QuestMachine.Instance.StartQuest("_BRISIEN");
     *  _BRISIEN is the MAIN QUEST's first quest. Both files are
     *  vendored; neither had ever been parsed. The optional
     *  LaunchQuest arm between them has no port-side setter and is
     *  recorded rather than invented. */
    initAtGameStart() {
      for (const name of GAME_START_QUESTS) machine.startQuestByName(name);
      questLists.initAtGameStartQuests((q) => machine.startQuestImmediate(q));
    },

    onExteriorTransition() { machine.notifyExteriorTransition(); },
    onInitWorld() { machine.notifyInitWorld(); },

    /** The save envelope: the machine's shape + the notebook's + the
     *  one-time list (C# carries the last two on SerializablePlayer -
     *  :196/:434 - the port keeps them beside the machine's). */
    snapshot() {
      return {
        machine: machine.getSaveData(),
        notebook: notebook.getSaveData(),
        oneTimeQuestsAccepted: questLists.oneTimeQuestsAccepted ? [...questLists.oneTimeQuestsAccepted] : null,
      };
    },
    restore(data) {
      if (!data) return;
      machine.clearState();   // C#'s load path: ClearState before RestoreSaveData
      offerFlow.reset();   // QUEST-UID1: an offer parsed in the game being replaced is not the loaded game's to start
      machine.restoreSaveData(data.machine ?? { siteLinks: [], quests: [] });
      // AUDIT 26 F102: DFU restores the notebook only when the save
      // CARRIES one (`if (!string.IsNullOrEmpty(notebookDataJson))`,
      // SaveLoadManager.cs:1451-1456) - the empty-block substitute
      // wiped every note and filed quest of the session on an
      // old-version envelope.
      if (data.notebook) notebook.restoreSaveData(data.notebook);
      // AUDIT JOURNAL-CLEAN F3: ...and at the load, before any new quest can take a uid a stale id names
      notebook?.pruneHiddenQuests?.([...machine.quests.values()].filter((q) => !q.questComplete).map((q) => q.uid));
      questLists.oneTimeQuestsAccepted = data.oneTimeQuestsAccepted ? [...data.oneTimeQuestsAccepted] : null;
      lens.reset();   // GUIDE1: a loaded game is not news
      questTracker.forget();   // GUIDE4: ...nor what the last game's card followed (the tracked quest is the save's own record)
      questHerald.clear();   // AUDIT GUIDE O2: ...nor the last game's news - a notice standing over the loaded game could merge a same-uid quest's news under its verdict
    },
  };
  return bridge;
}
