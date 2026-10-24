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
//   sharedClock()              - the shared world (REPUTE-GATE:
//                                onlineRepute.js; absent = offline)
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
import { localizedText } from '../textManager.js';   // L10N3d: the wait box's two lines
import { reputeGated } from './onlineRepute.js';   // REPUTE-GATE: online, two quests wait for their headers' standing

/** DaggerfallQuestPopupWindow.cs:92 - TEXT.RSC's "You're too late, I
 *  gave the job to some spellsword" flavour family. */
export const FAIL_QUEST_FLAVOUR_ID = 600;
/** Internal_Strings gettingQuests1/2 (the quest-picker's wait box);
 *  %pcf expands in the message box's generic pass, not here. */
export const GETTING_QUESTS_1 = 'Hmm, let me see what tasks we have available.';
export const GETTING_QUESTS_2 = 'Please have patience and wait here a moment, %pcf.';
/** QUESTOR-SAID: why a door closed - the clicked NPC is the questor of a quest still open. */
export const ACTIVE_QUESTOR = 'activeQuestor';

/**
 * QUESTOR-SAID (FIELD BUGS 2026-10-19f, players' private reports: a guild - the Fighters Guild, the Knights of the
 * Dragon - answered "That service is not available yet." while one of its quests was still open). A popup's door that
 * closes on IsLastNPCClickedAnActiveQuestor says WHY, and names the quest still open: `{ kind: 'close', reason, quest }`
 * (the quest null where the scan cannot be asked). DFU closes the window and says nothing - the guild's GetQuest
 * (DaggerfallGuildServicePopupWindow.cs:550-553) and the coven's (DaggerfallWitchesCovenPopupWindow.cs:125-129) - and
 * the port's guild popup read that silence as no service at all. The departure is the words (questBridge.offerBoxes
 * says them); the law - no new quest from a questor whose quest is open - is DFU's. The social door keeps DFU's bare
 * close: its talk session declines such a questor before it is reached (npcSession.isNpcOfferingQuest).
 */
export function questorBusy(machine) {
  return { kind: 'close', reason: ACTIVE_QUESTOR, quest: machine.lastNPCClickedQuestorOf?.()?.quest ?? null };
}

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

  /** QUEST-UID1: a LOAD discards the offer in hand. DFU cannot load under an open offer (the load window and the
   *  quickload key both stand on the HUD), so a pending offer never outlives the game it was parsed in; the port
   *  quickloaded from under any window (FIX-E) until DUPE-LOAD narrowed it to the death screen, and every load still
   *  replaces the game an offer was parsed in, so the bridge's restore calls this - the
   *  offered quest was parsed in the game being replaced, and answering Yes must not start it in the loaded one. */
  reset() {
    this.offeredQuest = null;
    this.questPool = null;
    this.menu = false;
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
  /**
   * G7 - the daedric summoning's own offer:
   * `QuestListsManager.GetQuest(daedraToSummon.quest, summonerFactionData.id)`
   * (DaggerfallQuestPopupWindow:272). A named quest with the SUMMONER's
   * faction as its context, not the prince's - the temple that called
   * is who the quest is for.
   */
  offerNamedQuest(questName, factionId = 0) {
    this.offeredQuest = null;
    this.menu = false;
    this._guild = null;
    this._guildCtx = { guildGroup: null, buildingFactionId: factionId };
    this.offeredQuest = this.questLists.getQuest(questName, factionId);
    // GetQuest answers null for a quest the reader has no source for, or
    // whose parse threw - a remote Place or Person with no site in the
    // player's region (ParseQuest swallows it) - and DFU then offers
    // nothing (:273-279). So does this: NO STEP, not a silent close step
    // - the summoning reads the null as "no quest here" before it spends
    // the gold or records the prince (daedraSummoning.js SUMMON-OFFER).
    if (!this.offeredQuest) return null;
    return this._offerQuest();
  }

  /** CW1 - DaggerfallWitchesCovenPopupWindow.GetQuest (:121-158): the
   *  coven is not a proper guild. The pool is the Witches group as
   *  NONMEMBER, rank = player level ("Not a proper guild so rank =
   *  player level"), and the witch NPC's own faction homes the offer.
   *  The window calls GetGuildQuest - pool + select in ONE call
   *  (QuestListsManager.cs:322-327) - so the coven never sees the
   *  guildQuestListBox picker, which is the guild POPUP's own UI. No
   *  guild rides the offer, so no ExternalMCP is set (the offerNamedQuest
   *  shape, not offerGuildQuest's). */
  offerCovenQuest(factionId, reputation = 0) {
    this.offeredQuest = null;
    this.questPool = null;
    this.menu = false;
    this._guild = null;
    this._guildCtx = { guildGroup: GUILD_GROUPS.Witches, buildingFactionId: factionId };
    // Just exit if this NPC already involved in an active quest (:125-129) - QUESTOR-SAID: saying why
    if (this.machine.isLastNPCClickedAnActiveQuestor()) return questorBusy(this.machine);
    const level = this.machine.deps.playerLevel?.() ?? 0;
    this.offeredQuest = this.questLists.getGuildQuest(
      GUILD_GROUPS.Witches, MEMBERSHIP_STATUS.Nonmember, factionId, reputation, level);
    return this._offerQuest();
  }

  offerGuildQuest({ guildGroup, guild, buildingFactionId = 0 }) {
    this.offeredQuest = null;
    this.menu = false;
    this._guild = guild;
    this._guildCtx = { guildGroup, buildingFactionId };
    // Just exit if this NPC is already involved in an active quest -
    // the guild rides in as the active quest's external MCP. QUESTOR-SAID: the close says why
    if (this.machine.isLastNPCClickedAnActiveQuestor(guild)) return questorBusy(this.machine);
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
    // REPUTE-GATE (onlineRepute.js): online, Guard the Guild and Protect an Honored Mage wait for the standing their
    // headers name - offline the pool is DFU's
    this.questPool = reputeGated(this.questLists.getGuildQuestPool(guildGroup, status, factionId, guild.getReputation(), rank),
      guild.getReputation(), !!this.deps.sharedClock?.());
    // QUEST-AUDIT III NO-WORK: with Choose Guild Jobs on and no work to offer, the wait box opened a picker of nothing;
    // the classic draw's own "no work" line answers instead (selectQuest of an empty pool -> OfferQuest's failure)
    if (this.deps.guildQuestListBox && !this.questPool?.length) return this._failGetQuestMessage();
    if (this.deps.guildQuestListBox) {
      return {
        kind: 'gettingQuests',
        textLines: [localizedText('gettingQuests1', GETTING_QUESTS_1), localizedText('gettingQuests2', GETTING_QUESTS_2)],   // :578-579
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
      // Quest.ExternalMCP (Quest.cs:179) is an IMacroContextProvider.
      // AUDIT 24: the port's engine reads a provider as the
      // `{ quest, source }` bundle getContextValue builds for the
      // primary - so the guild has to arrive in that shape or its
      // source is invisible. Normalised here as well as supplied by
      // the host, so a bare guild is still reachable.
      //
      // NO GUILD is a real arm, not a defensive one. The ExternalMCP
      // assignment exists ONLY inside DaggerfallGuildServicePopupWindow
      // .OfferQuest (:608), where `guild` is the window's own field and
      // is never null; the DAEDRIC offer is a different window
      // entirely (DaggerfallQuestPopupWindow.cs:272-279 loads the
      // quest, DaggerfallDaedraSummonedWindow.cs:96-121 shows it) and
      // sets no ExternalMCP at all. The port funnels both through this
      // one member, and offerNamedQuest sets _guild = null - so a bare
      // `.isMember()` threw a TypeError on the first successful daedra
      // summoning, after the gold was spent and the Summoned flag set.
      if (this._guild?.isMember()) {
        this.offeredQuest.externalMCP = this._guild.source
          ? { quest: this.offeredQuest, source: this._guild.source }
          : this._guild;
      }
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
    if (!entries.length) return this._failGetQuestMessage();   // NO-WORK: every row failed its parse - nothing to pick
    return { kind: 'pickQuest', entries, onPick: (index) => this._questPicked(index) };
  }

  /** QuestPicker_OnItemPicked (:655-664): a FULL parse this time, and
   *  the LoadQuest call is uncaught - but that is not the same as
   *  throwing. AUDIT 24 (the seven-slice sweep): LoadQuest reaches
   *  QuestMachine.ParseQuest, which swallows EVERY exception and
   *  answers null (:670-687), so a quest whose QBN the parser chokes
   *  on lands `offeredQuest = null` and OfferQuest shows its
   *  failure message. Only a missing FILE throws out. The port's
   *  parse had no catch, so this arm threw where DFU apologises, and
   *  the pin here recorded that. An index past the pool answers
   *  nothing. */
  _questPicked(index) {
    if (!this.questPool) return null;   // QUEST-UID1: a load took the pool away under its picker
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
    if (!this.offeredQuest) return { kind: 'close' };   // QUEST-UID1: a load took the offer away under its popup
    if (yes) {
      // C#'s accept call rides the exitOnClose DEFAULT (two args)
      const popup = this._showQuestPopupMessage(this.offeredQuest, QUEST_MESSAGES.AcceptQuest);
      this.machine.startQuestImmediate(this.offeredQuest);
      return { kind: 'accepted', popup, quest: this.offeredQuest };
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
