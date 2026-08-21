// THE QUEST OFFER FLOW (Q4-ii) - DaggerfallQuestOfferWindow.cs whole,
// DaggerfallQuestPopupWindow.cs's offer/accept/refuse half, and
// DaggerfallGuildServicePopupWindow.cs's Quests service (:546-667),
// headless. The windows are geometry; this is what they DO: draw a
// quest from the lists, put the QuestorOffer prompt up, and on the
// answer either start the quest behind the AcceptQuest popup or scrub
// the TalkManager and show RefuseQuest. Every entry answers a STEP
// descriptor the UI host renders (guildServiceFlow's convention);
// respond/onClose/onPick callbacks carry the flow forward.
//
// THE TWO DOORS: offerSocialQuest is DaggerfallQuestOfferWindow -
// TalkManager's "work" answer and the merchant/noble click open it;
// it never sets an external MCP (C#'s own `TODO - need to provide an
// mcp for macros?`) and its fail flavour stays silent inside castles,
// as classic. offerGuildQuest is the guild popup's GetQuest override:
// the Temple deity folds into MembershipStatus, rank can ride player
// level (IsSatisfyQuestReqByLevel), the offered quest carries the
// GUILD as quest.externalMCP when the player is a member (%pct's
// GuildTitle context - the srcDataUnknown chain's second provider),
// and the whole pool clears after one offer.
//
// KEPT QUIRKS: IsLastNPCClickedAnActiveQuestor stamps the mcp on the
// ACTIVE quest scanned, not the offered one (machine.js); the
// accept/refuse popup reads this.offeredQuest.externalMCP - the
// FIELD, never its quest argument; the quest picker's failure prune
// replays C#'s RemoveAt-by-original-index bug, index drift and the
// out-of-range throw included; a missing QuestorOffer message shows
// NOTHING and the drawn quest leaks unstarted, verbatim.
//
// OUT OF SLICE: the popup descriptors carry `mcp` for the message
// box's second, GENERIC MacroHelper pass (SetTextTokens' UI-layer
// expansion - the talk/text arc owns it; the quest pass already ran
// at getTextTokens). GETTING_QUESTS_2's %pcf rides the same pass.
// The DaedraSummoning service stays a flagged arm in guildServiceFlow.
//
// deps (all injectable):
//   isPlayerInsideCastle()     - GameManager.IsPlayerInsideCastle
//                                (the social ctor's questor-pool
//                                removal gate AND the fail-message
//                                silence)
//   removeNpcQuestor(nameSeed) - TalkManager.RemoveNpcQuestor: the
//                                clicked questor leaves the work pool
//   getGuildFactionId(guildGroup) - GuildManager.GetGuildFactionId
//                                (non-order guilds' reputation home)
//   guildQuestListBox          - DaggerfallUnity.Settings
//                                .GuildQuestListBox (default false =
//                                classic random draw)
//   getLocalizedQuestDisplayName(questName) - the localization table
//                                override for picker labels (null =
//                                the quest's own DisplayName)
//
// The GUILD object a host passes offerGuildQuest is DFU's Guild:
// { isMember(), rank, deity, getReputation(),
//   isSatisfyQuestReqByLevel() } plus whatever macro-source surface
// quest.externalMCP consumers read - it rides through OPAQUE.
// The TalkManager scrubs and the player facts (playerLevel,
// getReputation) ride the machine's own deps - one wiring point.

import { MEMBERSHIP_STATUS } from './questLists.js';
import { QUEST_MESSAGES } from './quest.js';
import { GUILD_GROUPS } from '../../formats/factionFile.js';
import { GENDERS } from '../../characters/nameHelper.js';

/** DaggerfallQuestPopupWindow.cs:92 - TEXT.RSC's "You're too late, I
 *  gave the job to some spellsword" flavour family. */
export const FAIL_QUEST_FLAVOUR_ID = 600;
/** Internal_Strings gettingQuests1/2 (the quest-picker's wait box);
 *  %pcf expands in the message box's generic pass, not here. */
export const GETTING_QUESTS_1 = 'Hmm, let me see what tasks we have available.';
export const GETTING_QUESTS_2 = 'Please have patience and wait here a moment, %pcf.';

export class QuestOfferFlow {
  constructor(machine, questLists, deps = {}) {
    this.machine = machine;
    this.questLists = questLists;
    this.deps = deps;
    this.offeredQuest = null;
    this.questPool = null;
    this.menu = false;      // the social window's ctor flag: popups
    //                        opened from a talk MENU close back to it
    //                        (QuestPopupMessage_OnClose's override)
    this._guild = null;
    this._guildCtx = null;
  }

  // ---- the social door (DaggerfallQuestOfferWindow.cs) ----

  /** The ctor (:27-40) + GetQuest (:56-92). npcData is the clicked
   *  StaticNPC's NPCData ({ factionID, nameSeed, gender, ... };
   *  gender is GENDERS enum, as the questor-click contract). */
  offerSocialQuest(npcData, socialGroup, menu = false) {
    this.offeredQuest = null;
    this.questPool = null;
    this._guild = null;
    this.menu = menu;
    // The ctor half: the potential questor leaves the talk work pool
    // BEFORE the offer resolves - the active-questor bail below keeps
    // the removal - unless the player is inside a castle.
    if (!this.deps.isPlayerInsideCastle?.()) this.deps.removeNpcQuestor?.(npcData.nameSeed);
    // Just exit if this NPC is already involved in an active quest
    if (this.machine.isLastNPCClickedAnActiveQuestor()) return { kind: 'close' };
    const factionId = npcData.factionID;
    const gender = npcData.gender === GENDERS.Female ? 'female' : 'male';
    const reputation = this.machine.deps.getReputation?.(factionId) ?? 0;
    const level = this.machine.deps.playerLevel?.() ?? 0;
    this.offeredQuest = this.questLists.getSocialQuest(socialGroup, factionId, gender, reputation, level);
    if (this.offeredQuest) {
      const prompt = this.machine.createMessagePrompt(this.offeredQuest, QUEST_MESSAGES.QuestorOffer);
      if (!prompt) return { kind: 'close' };   // no message 1000: nothing shows, the quest leaks
      return { kind: 'offer', prompt, respond: (yes) => this._offerResponse(yes) };
    }
    // Failed get quest messages do not appear inside castles in classic.
    if (!this.deps.isPlayerInsideCastle?.()) return this._failGetQuestMessage();
    return { kind: 'close' };
  }

  // ---- the guild door (DaggerfallGuildServicePopupWindow.cs:546-667) ----

  /** GetQuest (:546-593). guild is the DFU Guild surface (contract in
   *  the header); buildingFactionId homes the reputation change for
   *  the holy/knightly orders. */
  offerGuildQuest({ guildGroup, guild, buildingFactionId = 0 }) {
    this.offeredQuest = null;
    this.menu = false;
    this._guild = guild;
    this._guildCtx = { guildGroup, buildingFactionId };
    // Just exit if this NPC is already involved in an active quest -
    // the guild rides in as the active quest's external MCP.
    if (this.machine.isLastNPCClickedAnActiveQuestor(guild)) return { kind: 'close' };
    // Member status, including the Temple's deity-specific statuses
    // (Enum.Parse throws on a name outside the enum, mirrored).
    let status = guild.isMember() ? MEMBERSHIP_STATUS.Member : MEMBERSHIP_STATUS.Nonmember;
    if (guild.isMember() && guildGroup === GUILD_GROUPS.HolyOrder) {
      status = MEMBERSHIP_STATUS[guild.deity];
      if (status == null) throw new Error(`Requested value '${guild.deity}' was not found.`);
    }
    const factionId = this._getFactionIdForGuild();
    // Effective rank: player level can override for some guilds
    // (e.g. Mages/Knights).
    let rank = guild.rank;
    const level = this.machine.deps.playerLevel?.() ?? 0;
    if (guild.isSatisfyQuestReqByLevel?.() && level > rank) rank = level;
    this.questPool = this.questLists.getGuildQuestPool(guildGroup, status, factionId, guild.getReputation(), rank);
    if (this.deps.guildQuestListBox) {
      return {
        kind: 'gettingQuests',
        textLines: [GETTING_QUESTS_1, GETTING_QUESTS_2],
        clickAnywhereToClose: true,
        onClose: () => this._gettingQuestsBoxClose(),
      };
    }
    this.offeredQuest = this.questLists.selectQuest(this.questPool, factionId);
    return this._offerQuest();
  }

  /** GetFactionIdForGuild (:595-598): orders affect the BUILDING's
   *  faction, everyone else their guild's. Recomputed per use, as
   *  each C# call site does. */
  _getFactionIdForGuild() {
    const { guildGroup, buildingFactionId } = this._guildCtx;
    return (guildGroup === GUILD_GROUPS.HolyOrder || guildGroup === GUILD_GROUPS.KnightlyOrder)
      ? buildingFactionId : (this.deps.getGuildFactionId?.(guildGroup) ?? 0);
  }

  /** OfferQuest (:600-621): the member's guild becomes the quest's
   *  external MCP; the pool clears WHATEVER happened (an unknown
   *  guild group's null pool reaches here through the port's
   *  null-guarded selectQuest where C# NREs first - recorded
   *  Q2b-ii). */
  _offerQuest() {
    let step = null;
    if (this.offeredQuest) {
      if (this._guild.isMember()) this.offeredQuest.externalMCP = this._guild;
      const prompt = this.machine.createMessagePrompt(this.offeredQuest, QUEST_MESSAGES.QuestorOffer);
      if (prompt) step = { kind: 'offer', prompt, respond: (yes) => this._offerResponse(yes) };
    } else {
      step = this._failGetQuestMessage();
    }
    if (this.questPool) this.questPool.length = 0;
    return step;
  }

  /** GettingQuestsBox_OnClose (:624-652): label every pool row by a
   *  header-only parse; rows that fail it are pruned by C#'s OWN BUG
   *  - RemoveAt walks the ORIGINAL indices while each removal shifts
   *  the list, so a second failure prunes the wrong row or throws
   *  past the end (the ArgumentOutOfRangeException mirrored). C#
   *  Dispose()s each partial quest; the port's Quest holds nothing
   *  to release. */
  _gettingQuestsBoxClose() {
    const factionId = this._getFactionIdForGuild();
    const entries = [];
    const failures = [];
    for (let i = 0; i < this.questPool.length; i++) {
      try {
        const quest = this.questLists.loadQuest(this.questPool[i], factionId, true);
        let displayName = quest.displayName;
        const localized = this.deps.getLocalizedQuestDisplayName?.(quest.questName);
        if (localized) displayName = localized;
        entries.push(displayName ?? quest.questName);
      } catch {
        failures.push(i);
      }
    }
    for (const i of failures) {
      if (i >= this.questPool.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
      this.questPool.splice(i, 1);
    }
    return { kind: 'pickQuest', entries, onPick: (index) => this._questPicked(index) };
  }

  /** QuestPicker_OnItemPicked (:655-664): a FULL parse this time; a
   *  load failure throws out, as C#'s uncaught LoadQuest does. An
   *  index past the pool answers nothing. */
  _questPicked(index) {
    if (index < this.questPool.length) {
      this.offeredQuest = this.questLists.loadQuest(this.questPool[index], this._getFactionIdForGuild());
      return this._offerQuest();
    }
    return null;
  }

  // ---- the shared answer half (DaggerfallQuestPopupWindow.cs) ----

  /** OfferQuest_OnButtonClick (:128-155). Yes: the AcceptQuest popup
   *  tokens draw FIRST (pre-start state - questStartTime is still
   *  unset under them), then StartQuest runs immediately; a missing
   *  AcceptQuest message still starts the quest. No: the three
   *  TalkManager scrubs in C#'s order - info topics, quest rumors,
   *  progress rumors - then RefuseQuest with exitOnClose false. */
  _offerResponse(yes) {
    if (yes) {
      // C#'s accept call rides the exitOnClose DEFAULT (two args)
      const popup = this._showQuestPopupMessage(this.offeredQuest, QUEST_MESSAGES.AcceptQuest);
      this.machine.startQuestImmediate(this.offeredQuest);
      return { kind: 'accepted', popup };
    }
    const md = this.machine.deps;
    md.removeQuestInfoTopics?.(this.offeredQuest.uid);
    md.removeQuestRumors?.(this.offeredQuest.uid);
    md.removeProgressRumors?.(this.offeredQuest.uid);
    return { kind: 'refused', popup: this._showQuestPopupMessage(this.offeredQuest, QUEST_MESSAGES.RefuseQuest, false) };
  }

  /** ShowQuestPopupMessage (:104-127): quest tokens at default
   *  expansion (the variant draw rides quest.rolls); mcp is the
   *  OFFERED quest's external provider - C# reads the field, not its
   *  quest argument - for the message box's generic second pass.
   *  exitOnClose routes QuestPopupMessage_OnClose: the guild base
   *  closes the whole service window, the social override closes
   *  only a talk MENU (this.menu) - geometry the host owns. */
  _showQuestPopupMessage(quest, id, exitOnClose = true) {
    const message = quest.getMessage(id);
    if (!message) return null;
    return {
      tokens: message.getTextTokens(-1, quest.rolls),
      mcp: this.offeredQuest.externalMCP ?? null,
      clickAnywhereToClose: true,
      allowCancel: true,
      exitOnClose,
    };
  }

  /** ShowFailGetQuestMessage (:90-103): a random TEXT.RSC 600 record
   *  ("You're too late, I gave the job to some spellsword...") - no
   *  quest data, no MCP; the host draws the record. */
  _failGetQuestMessage() {
    return {
      kind: 'fail',
      textId: FAIL_QUEST_FLAVOUR_ID,
      random: true,
      clickAnywhereToClose: true,
      allowCancel: true,
    };
  }
}
