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
//                                 absent members idle LOUDLY, the
//                                 headless charter
//   classicSeconds()            - the classic game clock in seconds
//                                 (the ticker's minutes * 60)
//   playerEntity                - { name, level, gender, ... }
//   playerRaceName()            - the birth race name (%ra)
//   getReputation(factionId)    - factionRep.getReputation over the
//                                 player's store
//   getGold()/deductGold(n)/addGold(n), giveItemToPlayer(dfItem),
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
import { QuestListsManager } from '../systems/quest/questLists.js';
import { QuestOfferFlow } from '../systems/quest/offerFlow.js';
import { PlayerNotebook } from '../systems/notebook.js';
import { GENDERS } from '../characters/nameHelper.js';
import { ZERO_NPC_DATA, NPC_CONTEXT, raceFromFaction } from '../characters/staticNpc.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';
import { getBool } from '../systems/settings.js';
import { getTitle } from '../systems/guilds.js';
import { addQuestResourceObjects } from '../systems/quest/sceneMount.js';

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

export function createQuestBridge(ctx) {
  const notebook = new PlayerNotebook({
    dateTimeString: () => ctx.dateTimeString?.() ?? '',
    midDateTimeString: () => ctx.midDateTimeString?.() ?? '',
    cityName: () => ctx.cityName?.() ?? '',
  });

  let questLists = null;
  const machine = new QuestMachine({
    world: ctx.world ?? null,
    nowSeconds: () => ctx.classicSeconds?.() ?? 0,
    getQuestSourceLines: (name) => ctx.data.getQuestSourceLines(name),
    playerLevel: () => ctx.playerEntity?.level ?? 0,
    playerGender: () => ctx.playerEntity?.gender ?? 'male',
    playerName: () => ctx.playerEntity?.name ?? null,
    playerRaceName: () => ctx.playerRaceName?.() ?? null,
    getReputation: (fid) => ctx.getReputation?.(fid) ?? 0,
    getGold: () => ctx.getGold?.() ?? 0,
    deductGold: (n) => ctx.deductGold?.(n),
    addGold: (n) => ctx.addGold?.(n),
    addHUDText: (t) => ctx.addHUDText?.(t),
    showPopup: (q, tokens) => ctx.showPopup?.(q, tokens),
    showPrompt: (q, message, respond) => ctx.showPrompt?.(q, message, respond),
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
    // H1: DaggerfallBankManager.IsHouseOwned. place.js has read this
    // since the quest arc landed (:439 - a house you own is never
    // handed out as a quest site) and nothing could answer it, so it
    // defaulted false and your own home stayed eligible.
    isHouseOwned: (buildingKey) => ctx.isHouseOwned?.(buildingKey) ?? false,
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
    dialogLink: (...a) => ctx.dialogLink?.(...a),
    addDialog: (...a) => ctx.addDialog?.(...a),
    addQuestRumor: (uid, m) => ctx.addQuestRumor?.(uid, m),
    addProgressRumor: (uid, m) => ctx.addProgressRumor?.(uid, m),
    addQuestorPostMessage: (uid, m) => ctx.addQuestorPostMessage?.(uid, m),
    removeProgressRumors: (uid) => ctx.removeProgressRumors?.(uid),
    removeQuestorPostMessage: (uid) => ctx.removeQuestorPostMessage?.(uid),
    removeQuestRumors: (uid) => ctx.removeQuestRumors?.(uid),
    removeQuestInfoTopics: (uid) => ctx.removeQuestInfoTopics?.(uid),
    forceTopicListsUpdate: () => ctx.forceTopicListsUpdate?.(),
    addFace: (r) => ctx.addFace?.(r),
    dropFace: (r) => ctx.dropFace?.(r),
    // Q4-iv: the tombstone filing lands in the notebook here
    addFinishedQuest: (messages) => notebook.addFinishedQuest(messages),
    // the one-time recording IS the OnQuestStarted subscription
    onQuestStarted: (q) => { questLists.noteQuestStarted(q); ctx.onQuestStarted?.(q); },
  });

  questLists = new QuestListsManager({
    readListTable: (name) => ctx.data.readListTable(name),
    getQuestSourceLines: (name) => ctx.data.getQuestSourceLines(name),
    parseQuest: (lines, factionId, partialParse) =>
      machine.parseQuestForLists(lines, factionId, { partialParse }),
    // AUDIT 24 (the seven-slice sweep): a LIVE read, not a hardcoded
    // false. DaggerfallUnity.Settings.PlayerNudity is a real setting
    // the port already stores and the launcher already renders as a
    // toggle - and questLists.js:154 gates adult quests on it, so
    // flipping it did nothing at all. A GETTER because C# reads the
    // setting at the point of use, and the consumer reads
    // `deps.playerNudity` as a value.
    get playerNudity() { return getBool('ChildGuard', 'PlayerNudity'); },
  });

  const offerFlow = new QuestOfferFlow(machine, questLists, {
    isPlayerInsideCastle: () => ctx.isPlayerInsideCastle?.() ?? false,
    removeNpcQuestor: (seed) => ctx.removeNpcQuestor?.(seed),
    getGuildFactionId: (g) => ctx.getGuildFactionId?.(g) ?? 0,
    // likewise: offerFlow.js:144 branches on this and the launcher
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
    return true;
  }

  /** GetRaceFromFaction's two inputs, off the machine's own world. */
  const npcRaceLookups = () => ({
    getFaction: (id) => ctx.world?.getFactionData?.(id) ?? null,
    raceOfCurrentRegion: () => ctx.world?.currentRegionRace?.() ?? 0,
  });

  return {
    machine, questLists, offerFlow, notebook,
    tick,

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
        default: return [];
      }
    },

    /** The scene mount (Q4-iii's walk) over the host's adapter. */
    mountScene(adapter, siteType, buildingKey = 0) {
      addQuestResourceObjects(machine, adapter, siteType, buildingKey);
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
      machine.restoreSaveData(data.machine ?? { siteLinks: [], quests: [] });
      notebook.restoreSaveData(data.notebook ?? { notebookEntries: [], finishedQuestEntries: [] });
      questLists.oneTimeQuestsAccepted = data.oneTimeQuestsAccepted ? [...data.oneTimeQuestsAccepted] : null;
    },
  };
}
