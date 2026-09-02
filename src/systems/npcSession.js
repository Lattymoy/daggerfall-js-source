// TalkManager's NPC-SESSION half, 1:1 (TK-iv).
//
// TK-i gave the mill its lifecycle, TK-ii the topic tree, TK-iii the
// answer ladder. All three answer questions for an NPC that nothing
// has yet chosen. This is the module that chooses one: the click
// arms (TalkToMobileNPC / TalkToStaticNPC), the target chain
// (SetTargetNPC's two overloads), the faction resolution the whole
// conversation reads from, the greeting ladder that decides whether
// the window opens at all, and the questor pool the Work arm draws
// from.
//
// SEAMS the host fills (absent seams idle LOUDLY, the headless
// charter - every one of them reads a C# default here):
//   factionData(id)             - PersistentFactionData.GetFactionData
//   factionName(id)             - .GetFactionName
//   peopleOfCurrentRegion()     - PlayerGPS
//   courtOfCurrentRegion()      - PlayerGPS
//   currentLocationIndex()      - PlayerGPS
//   nameBankOfCurrentRegion()   - PlayerGPS
//   buildingType()              - PlayerEnterExit (for faction id 0)
//   isPlayerInsideCastle()      - GameManager
//   guildMemberships()          - GuildManager.GetMemberships, as
//                                 [{factionId, isMember}]
//   guildOfBuildingFaction()    - GuildManager.GetGuild(FactionID)
//   sgroupReputation(sgroup)    - PlayerEntity.SGroupReputations
//   reactionToPlayer(faction)   - T3a's GetReactionToPlayer
//   suppressTalk()              - the racial override's veto
//   expandRandomTextRecord(id)  - the macro layer
//   randomTokens(id)            - TextProvider.GetRandomTokens
//   rolls()                     - UnityEngine.Random.Range(0,1)
//   questorPostMessages()       - the mill's questor-post dictionary
//   getQuest(questID)           - QuestMachine
//   isNPCDataEqual(a, b)        - QuestMachine
//   isLastNPCClickedAnActiveQuestor()
//   expandQuestMessage(quest, tokens, reveal)
//   fullName(nameBank, gender, nameSeed)
//   portraitForBillboard(npcData)
//   messageBox(textOrTokens)    - the UI face
//   pushTalkWindow()            - the UI face
//   onTargetChanged(npcData)    - portrait/name refresh
//   assembleTopicListPerson()   - TK-ii's tree
//   setupRumorMill()            - TK-i's mill
//   assembleTopicLists()        - TK-ii's tree
//   needsTopicListRebuild()     - the tree's rebuildTopicLists flag
//   raiseTopicListRebuild()     - and the event handlers' raise
//   getBuildingList()           - the tree's building refresh
//   clearQuestInfo() / clearRumorMill() - OnStartGame's two
//   clearTopicListRebuild()     - and its reset
//   resetNPCKnowledge()         - TK-ii's tree
//   resetToneSession()          - TK-iii's pipeline
import { srand } from '../formats/dfRandom.js';
import { randomRangeInclusive } from '../formats/dfRandom.js';
import { isAlly, isEnemy, flatArchive, flatRecord } from '../formats/factionFile.js';
import { tokensToString } from './rumorMill.js';
import { GENDERS } from '../characters/nameHelper.js';
import {
  NO_RESPONSE_TEXT_ID, MIN_NEUTRAL_REACTION, MIN_LIKE_REACTION,
  MIN_VERY_LIKE_REACTION, REFUSE_TALK_REACTION,
} from './talkSession.js';

/** FactionFile.FactionTypes, the four the parent walks stop on. */
export const FACTION_TYPE = Object.freeze({
  None: -1, Daedra: 0, God: 1, Group: 2, Subgroup: 3, Individual: 4,
  Official: 5, VampireClan: 6, Province: 7, WitchesCoven: 8, Temple: 9,
  KnightlyGuard: 10, MagicUser: 11, Generic: 12, Thieves: 13,
  Courts: 14, People: 15,
});

/** FactionFile.SocialGroups. */
export const SOCIAL_GROUP = Object.freeze({
  None: -1, Commoners: 0, Merchants: 1, Scholars: 2, Nobility: 3,
  Underworld: 4, SGroup5: 5, SupernaturalBeings: 6, GuildMembers: 7,
});

/** FactionFile.FactionIDs, the three generic ones GetStaticNPCFactionData
 *  redirects to the region's court (:898-904 - DFU's change from
 *  classic, whose generic factions "have no use at all"). */
export const RANDOM_RULER = 852;
export const RANDOM_NOBLE = 242;
export const RANDOM_KNIGHT = 853;

/** The greeting records extracted from FALL.EXE (:118-119). Read as
 *  greetings[3 * index + n]: n=0 the well-liked face, n=1 the ordinary
 *  one, n=2 the rejection. Note 8562, 8564, 8566, 8568 and 8570 each
 *  appear TWICE - the table is not a clean 3-per-index run, and that
 *  is the table, not a typo. */
export const GREETINGS = Object.freeze([
  8550, 8551, 8552, 8553, 8554, 8555, 8556, 8557, 8558, 8559, 8560, 8561, 8562, 8562,
  8563, 8564, 8564, 8565, 8566, 8566, 8567, 8568, 8568, 8569, 8570, 8570, 8571,
]);

/** The four mobile-greeting records the ladder falls back to
 *  (:981-984), the same four talkSession.js already carries. */
export const DISLIKE_GREETING = 7206;
export const NEUTRAL_GREETING = 7207;
export const LIKE_GREETING = 7208;
export const VERY_LIKE_GREETING = 7209;

/** NPCType (:196-201). */
export const NPC_TYPE = Object.freeze({ Static: 'Static', Mobile: 'Mobile', Unset: 'Unset' });

/** The NPCData class (:179-192), field for field - allowGuildResponse
 *  is the only one C# initialises, and it initialises it TRUE.
 *
 *  KEPT: **THE NAMES NOBODY READS.** npcFactionName, pcFactionName,
 *  allyFactionName and enemyFactionName are commented "kept for guild
 *  related greetings" (:185-188) and are written by every arm of
 *  GetGreetingIndex - but a grep of the whole DFU tree finds no
 *  reader, in TalkManager or out of it. The guild-flavoured greeting
 *  macros that would spend them are unimplemented. Ported as written,
 *  because the day those macros land the values have to already be
 *  right. */
export function newNPCData(over = {}) {
  return {
    race: '',
    socialGroup: SOCIAL_GROUP.Commoners,
    guildGroup: 0,
    factionData: null,
    npcFactionName: '',
    pcFactionName: '',
    allyFactionName: '',
    enemyFactionName: '',
    numAnswersGivenTellMeAboutOrRumors: 0,
    isSpyMaster: false,
    allowGuildResponse: true,
    ...over,
  };
}

const EMPTY_FACTION = Object.freeze({
  id: 0, parent: 0, type: 0, rep: 0, sgroup: 0, ggroup: 0, name: '',
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
});

export class NPCSession {
  constructor(deps = {}) {
    this.deps = deps;
    this.npcData = newNPCData();
    this.currentNPCType = NPC_TYPE.Unset;
    this.nameNPC = '';
    this.reactionToPlayer = 0;
    this.alreadyRejectedOnce = false;
    this.sameTalkTargetAsBefore = false;
    this.lastTargetStaticNPC = null;
    this.lastTargetMobileNPC = null;
    this.targetStaticNPC = null;
    this.npcGreetingText = '';
    // TalkManager's toneReactionForTalkSession (:2660-2662) - T3f's
    // per-session reaction cache, which reactionTier012 reads and
    // fills. It is TalkManager's FIELD and TalkToNpc's to clear, so it
    // is owned here rather than left with the host: the caller passes
    // this array into the tier, and a host that forgot to clear it
    // would answer for the next NPC with the last one's reaction.
    this.toneReactionForTalkSession = [0, 0, 0];
    // numQuestionsAsked / questionOpeningText / currentQuestionListItem
    // are TalkManager fields in C# but live on TK-iii's AnswerPipeline
    // here - see startNewConversation. Deliberately absent.
    // the questor pool (:388-395)
    this.npcsWithWork = new Map();
    this.castleNPCsSpokenTo = new Map();
    this.selectedNpcWorkKey = 0;
    this.exteriorUsedForQuestors = 0;
  }

  _rolls() { return this.deps.rolls ?? Math.random; }
  /** UnityEngine.Random.Range(0, n) - int, exclusive top. */
  _range(n) { return Math.floor(this._rolls()() * n); }
  _faction(id) { return this.deps.factionData?.(id) ?? null; }

  // ---- the faction resolution (:884-907) ----

  /** GetStaticNPCFactionData: an NPC with a NULL faction id belongs to
   *  the region's court inside a palace and to its people anywhere
   *  else (matched to classic); the three generic Random_* factions
   *  are redirected to the court, DFU's own change. */
  getStaticNPCFactionData(factionId, buildingType) {
    let id = factionId;
    if (id === 0) {
      id = buildingType === 'Palace'
        ? (this.deps.courtOfCurrentRegion?.() ?? 0)
        : (this.deps.peopleOfCurrentRegion?.() ?? 0);
    } else if (id === RANDOM_RULER || id === RANDOM_NOBLE || id === RANDOM_KNIGHT) {
      id = this.deps.courtOfCurrentRegion?.() ?? 0;
    }
    return this._faction(id);
  }

  /** PersistentFactionData.GetParentGroupFaction
   *  (PersistentFactionData.cs:876-886): walk up until the parent is 0
   *  or the faction is a Group, a Province or a Temple. */
  getParentGroupFaction(faction) {
    let parent = faction ?? EMPTY_FACTION;
    while (parent.parent !== 0
      && parent.type !== FACTION_TYPE.Group
      && parent.type !== FACTION_TYPE.Province
      && parent.type !== FACTION_TYPE.Temple) {
      const next = this._faction(parent.parent);
      if (!next) break;   // headless: no faction table, no walk
      parent = next;
    }
    return parent;
  }

  // ---- the greeting ladder (:943-1063) ----

  /** GetGreetingIndex (:1002-1063): walk the PC's guild memberships
   *  against the NPC's parent GROUP faction and take the closest
   *  relationship found, lowest index winning, adjusting the running
   *  reputation as it goes. C# passes `reputation` by ref, so the
   *  adjustments are the caller's - here they ride the return.
   *
   *  KEPT: **THE UNGUARDED FIRST ARM.** The ally and enemy tests read
   *  `IsAlly(a, b) || IsAlly(b, a) && greetingIndex > 2` (:1035,
   *  :1046). `&&` binds tighter than `||`, so the greetingIndex guard
   *  applies ONLY to the second, reversed test - a forward ally match
   *  overwrites an index that is already better. The same-parent test
   *  above it parenthesises correctly, and the four loops below it
   *  guard properly, which is what makes these two stand out. Kept
   *  exactly.
   *
   *  KEPT: the enemy arm's `reputation -= 20`, with DFU's comment
   *  noting classic SET it to 20 instead of decreasing it. */
  getGreetingIndex(reputation, npcGroupFaction) {
    let greetingIndex = 8;
    let rep = reputation;
    const npcF = npcGroupFaction ?? EMPTY_FACTION;
    const names = this.npcData;
    for (const guild of (this.deps.guildMemberships?.() ?? [])) {
      const g = this._faction(guild.factionId) ?? EMPTY_FACTION;
      // the same guild: nothing beats it, and it returns at once
      if (npcF.id === g.id) {
        names.npcFactionName = g.name;
        names.pcFactionName = g.name;
        return { greetingIndex: 0, reputation: rep };
      }
      // a shared parent, or one being the other's parent
      if ((g.parent !== 0 && npcF.parent !== 0 && g.parent === npcF.parent
        || g.parent === npcF.id
        || npcF.parent === g.id)
        && greetingIndex > 1) {
        names.npcFactionName = npcF.name;
        names.pcFactionName = g.name;
        greetingIndex = 1;
        rep += 15;
      }
      // allies - THE UNGUARDED FIRST ARM
      if (isAlly(g, npcF) || (isAlly(npcF, g) && greetingIndex > 2)) {
        names.npcFactionName = npcF.name;
        names.pcFactionName = g.name;
        rep += 10;
        greetingIndex = 2;
      }
      // enemies - the same shape, the same quirk
      if (isEnemy(g, npcF) || (isEnemy(npcF, g) && greetingIndex > 3)) {
        names.npcFactionName = npcF.name;
        names.pcFactionName = g.name;
        rep -= 20;
        greetingIndex = 3;
      }
      const guildEnemies = [g.enemy1, g.enemy2, g.enemy3];
      const npcEnemies = [npcF.enemy1, npcF.enemy2, npcF.enemy3];
      // an enemy in common
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (guildEnemies[i] !== 0 && guildEnemies[i] === npcEnemies[j] && greetingIndex > 4) {
            names.npcFactionName = npcF.name;
            names.pcFactionName = g.name;
            names.enemyFactionName = this.deps.factionName?.(guildEnemies[i]) ?? '';
            greetingIndex = 4;
            rep += 5;
          }
        }
      }
      const guildAllies = [g.ally1, g.ally2, g.ally3];
      const npcAllies = [npcF.ally1, npcF.ally2, npcF.ally3];
      // an ally in common
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (guildAllies[i] !== 0 && guildAllies[i] === npcAllies[j] && greetingIndex > 5) {
            names.npcFactionName = npcF.name;
            names.pcFactionName = g.name;
            names.allyFactionName = this.deps.factionName?.(guildAllies[i]) ?? '';
            greetingIndex = 5;
            rep += 5;
          }
        }
      }
      // one of the guild's allies is an NPC enemy
      for (let i = 0; i < 3; i++) {
        const enemy = this._faction(npcEnemies[i]);
        if (enemy && isAlly(g, enemy) && greetingIndex > 6) {
          names.npcFactionName = npcF.name;
          names.pcFactionName = g.name;
          names.enemyFactionName = enemy.name;
          greetingIndex = 6;
          rep -= 5;
        }
      }
      // one of the guild's enemies is an NPC ally
      for (let i = 0; i < 3; i++) {
        const ally = this._faction(npcAllies[i]);
        if (ally && isEnemy(g, ally) && greetingIndex > 7) {
          names.npcFactionName = npcF.name;
          names.pcFactionName = g.name;
          names.allyFactionName = ally.name;
          greetingIndex = 7;
          rep -= 5;
        }
      }
    }
    return { greetingIndex, reputation: rep };
  }

  /** GetNPCGreetingRecord (:943-993): the faction-flavoured greeting
   *  when the NPC's parent group is anything but a PROVINCE, else the
   *  plain reaction ladder.
   *
   *  KEPT: the province exclusion is "almost matched to classic" -
   *  classic blocked it only for the region's people and court; DFU
   *  blocks every child of a province so a unique court NPC cannot
   *  greet you with "As a member of Sentinel...".
   *
   *  KEPT: **THE STRANGER FLOOR.** DFU's improvement over classic -
   *  at greeting index 8 classic always answered 8570 ("Well met,
   *  stranger.") however well liked you were; here rep >= 30 takes
   *  the warm face unless the index IS 8, and the ordinary face is
   *  taken when rep <= 5 OR the index is not 8. An NPC at index 8
   *  with rep between 6 and 29 therefore matches NEITHER arm and
   *  falls all the way through to the plain reaction ladder. */
  getNPCGreetingRecord() {
    const parentFactionData = this.getParentGroupFaction(this.npcData.factionData);
    if (parentFactionData.type !== FACTION_TYPE.Province) {
      const faction = this.npcData.factionData ?? EMPTY_FACTION;
      const walked = this.getGreetingIndex(faction.rep, parentFactionData);
      const greetingIndex = walked.greetingIndex;
      let reputation = walked.reputation;
      if (faction.sgroup < 5) reputation += this.deps.sgroupReputation?.(faction.sgroup) ?? 0;
      const reaction = randomRangeInclusive(0, 15) - 10;
      if (reputation >= reaction) {
        if (faction.rep >= 30 && greetingIndex !== 8) return GREETINGS[3 * greetingIndex];
        if (faction.rep <= 5 || greetingIndex !== 8) return GREETINGS[1 + 3 * greetingIndex];
      } else {
        this.alreadyRejectedOnce = true;
        return GREETINGS[2 + 3 * greetingIndex];
      }
    }
    if (this.reactionToPlayer >= MIN_VERY_LIKE_REACTION) return VERY_LIKE_GREETING;
    if (this.reactionToPlayer >= MIN_LIKE_REACTION) return LIKE_GREETING;
    if (this.reactionToPlayer >= MIN_NEUTRAL_REACTION) return NEUTRAL_GREETING;
    return DISLIKE_GREETING;
  }

  // ---- the target chain (:805-865) ----

  /** SetTargetNPC, the MOBILE overload (:805-831). A repeat click on
   *  the same mobile is a no-op that only reports sameTalkTargetAsBefore
   *  - the NPCData, and with it the one-answer counter, survives. */
  setTargetMobileNPC(targetMobileNPC, factionData) {
    this.sameTalkTargetAsBefore = false;
    if (targetMobileNPC === this.lastTargetMobileNPC) {
      this.sameTalkTargetAsBefore = true;
      return;
    }
    this.alreadyRejectedOnce = false;
    this.lastTargetMobileNPC = targetMobileNPC;
    this.nameNPC = targetMobileNPC?.nameNPC ?? '';
    this.npcData = newNPCData({
      // every mobile is a Commoner of no guild - C#'s own literal,
      // not the faction's sgroup
      socialGroup: SOCIAL_GROUP.Commoners,
      guildGroup: 0,
      factionData,
      race: targetMobileNPC?.race ?? '',
      isSpyMaster: false,
    });
    this.deps.onTargetChanged?.({
      kind: NPC_TYPE.Mobile, nameNPC: this.nameNPC,
      portrait: { archive: 'CommonFaces', record: targetMobileNPC?.personFaceRecordId ?? 0 },
    });
    // "Update Where Is -> Person since this list may hide the questor
    // (if talking to the questor)"
    this.deps.assembleTopicListPerson?.();
  }

  /** SetTargetNPC, the STATIC overload (:833-865). Same shape, but the
   *  social group comes from the faction - CLAMPED to Merchants at 5
   *  and above, matched to classic - and the guild group with it. */
  setTargetStaticNPC(targetNPC, factionData) {
    this.sameTalkTargetAsBefore = false;
    if (targetNPC === this.lastTargetStaticNPC) {
      this.sameTalkTargetAsBefore = true;
      return;
    }
    this.alreadyRejectedOnce = false;
    this.targetStaticNPC = targetNPC;
    this.lastTargetStaticNPC = targetNPC;
    this.nameNPC = targetNPC?.displayName ?? '';
    const f = factionData ?? EMPTY_FACTION;
    this.npcData = newNPCData({
      socialGroup: f.sgroup < 5 ? f.sgroup : SOCIAL_GROUP.Merchants,
      guildGroup: f.ggroup,
      factionData,
      race: targetNPC?.data?.race ?? '',
      isSpyMaster: false,
    });
    this.deps.onTargetChanged?.({
      kind: NPC_TYPE.Static, nameNPC: this.nameNPC,
      portrait: this.deps.portraitForBillboard?.(targetNPC) ?? null,
    });
    this.deps.assembleTopicListPerson?.();
  }

  /** StartNewConversation (:867-878) - the WINDOW's reset, not the
   *  click's. TalkToNpc owns the tone half (:2657-2662); this owns the
   *  question counter, the opening text, the standing list item and
   *  the deferred rebuild.
   *
   *  The first three are TalkManager fields in C# but live on TK-iii's
   *  AnswerPipeline here, so they are reset THROUGH a seam rather than
   *  shadowed: a second copy on this object would be a reset that
   *  never reaches the thing doing the answering. */
  startNewConversation() {
    this.deps.resetQuestionSession?.();
    // `rebuildTopicLists` is ONE TalkManager field in C#: the topic
    // machinery raises it (ResetNPCKnowledge, the add/remove sweeps)
    // and this is where it is spent. It lives with the lists in the
    // port, so it is read and cleared through seams - a copy here
    // would be a flag nothing ever raises.
    if (this.deps.needsTopicListRebuild?.() ?? false) {
      this.deps.assembleTopicLists?.();
      this.deps.clearTopicListRebuild?.();
    }
    this.deps.setupRumorMill?.();
  }

  // ---- the click arms (:726-803) ----

  /** TalkToMobileNPC (:726-744). Every mobile speaks for the region's
   *  people, whatever they look like. */
  talkToMobileNPC(targetNPC) {
    this.currentNPCType = NPC_TYPE.Mobile;
    const npcFactionId = this.deps.peopleOfCurrentRegion?.() ?? 0;
    const npcFactionData = this._faction(npcFactionId);
    this.reactionToPlayer = this.deps.reactionToPlayer?.(npcFactionData) ?? 0;
    this.sameTalkTargetAsBefore = false;
    this.setTargetMobileNPC(targetNPC, npcFactionData);
    // "Important to reset this here so even if NPC is the same as
    // previous talk session PC will give one correct answer if NPC
    // knows about topic (as implemented in classic)" - and it is reset
    // AFTER SetTargetNPC, so it lands on the surviving NPCData of a
    // repeat click too
    this.npcData.numAnswersGivenTellMeAboutOrRumors = 0;
    return this.talkToNpc();
  }

  /** TalkToStaticNPC (:746-803). The QUESTOR DOOR comes first: a
   *  static NPC carrying work opens the quest offer instead of the
   *  talk window, and never reaches the conversation at all.
   *
   *  KEPT: the offer door is closed to CHILD NPCs (both arms), and
   *  the parent walk that follows stops on Group, Province, Temple,
   *  People, Courts AND Individual - the last three being DFU's own
   *  additions "since they have their own reputation". */
  talkToStaticNPC(targetNPC, { menu = true, isSpyMaster = false } = {}) {
    let npcFactionData = this.getStaticNPCFactionData(
      targetNPC?.data?.factionID ?? 0, this.deps.buildingType?.() ?? null);
    const isChildNPC = targetNPC?.isChildNPC ?? false;
    const nameSeed = targetNPC?.data?.nameSeed ?? 0;
    if (!isChildNPC && this.isNpcOfferingQuest(nameSeed)) {
      const entry = this.npcsWithWork.get(nameSeed);
      return { kind: 'questOffer', npc: entry.npc, socialGroup: entry.socialGroup, menu };
    }
    if (!isChildNPC && this.isCastleNpcOfferingQuest(nameSeed)) {
      return {
        kind: 'questOffer', npc: targetNPC?.data ?? null,
        socialGroup: (npcFactionData ?? EMPTY_FACTION).sgroup, menu,
      };
    }
    this.currentNPCType = NPC_TYPE.Static;
    while (npcFactionData && npcFactionData.parent !== 0
      && npcFactionData.type !== FACTION_TYPE.Group
      && npcFactionData.type !== FACTION_TYPE.Province
      && npcFactionData.type !== FACTION_TYPE.Temple
      && npcFactionData.type !== FACTION_TYPE.People
      && npcFactionData.type !== FACTION_TYPE.Courts
      && npcFactionData.type !== FACTION_TYPE.Individual) {
      const next = this._faction(npcFactionData.parent);
      if (!next) break;   // headless: no table, no walk
      npcFactionData = next;
    }
    this.reactionToPlayer = this.deps.reactionToPlayer?.(npcFactionData) ?? 0;
    this.sameTalkTargetAsBefore = false;
    this.setTargetStaticNPC(targetNPC, npcFactionData);
    this.npcData.numAnswersGivenTellMeAboutOrRumors = 0;
    this.npcData.isSpyMaster = isSpyMaster;
    // "Disables guild response for spymasters when talk is not from
    // guild menu" - the double negative is C#'s
    this.npcData.allowGuildResponse = !(!menu && isSpyMaster);
    return this.talkToNpc();
  }

  /** TalkToNpc (:2615-2663). Three doors can close before the window
   *  opens, and the greeting itself can slam one of them.
   *
   *  KEPT: **THE REJECTION FOUND MID-GREETING.** alreadyRejectedOnce
   *  is tested at the top (:2630) AND again after
   *  GetNPCGreetingRecord (:2641) - which SETS it (:978) when the
   *  reputation roll goes against the player. So a rejection the
   *  greeting lookup itself just decided answers with the RAW tokens
   *  of that greeting record in a message box, and the window never
   *  opens. */
  talkToNpc() {
    const suppress = this.deps.suppressTalk?.();
    if (suppress) {
      this.deps.messageBox?.(suppress);
      return { kind: 'suppressed', message: suppress };
    }
    if (this.reactionToPlayer < REFUSE_TALK_REACTION || this.alreadyRejectedOnce) {
      this.deps.messageBox?.(NO_RESPONSE_TEXT_ID);
      return { kind: 'noResponse', textId: NO_RESPONSE_TEXT_ID };
    }
    this.npcGreetingText = this.getNPCQuestGreeting();
    if (!this.npcGreetingText) {
      const npcGreetingRecord = this.getNPCGreetingRecord();
      if (this.alreadyRejectedOnce) {
        const tokens = this.deps.randomTokens?.(npcGreetingRecord) ?? null;
        this.deps.messageBox?.(tokens);
        return { kind: 'rejected', record: npcGreetingRecord, tokens };
      }
      this.npcGreetingText = this.deps.expandRandomTextRecord?.(npcGreetingRecord) ?? '';
    }
    if (!this.sameTalkTargetAsBefore) this.deps.resetNPCKnowledge?.();
    this.deps.pushTalkWindow?.();
    // the tone half of the session reset (:2658-2662), BOTH parts of
    // it: lastToneIndex lives on TK-iii's pipeline and rides a seam,
    // the three-tone reaction cache is this object's own field
    this.deps.resetToneSession?.();
    this.toneReactionForTalkSession[0] = 0;
    this.toneReactionForTalkSession[1] = 0;
    this.toneReactionForTalkSession[2] = 0;
    return { kind: 'talk', greeting: this.npcGreetingText };
  }

  // ---- the questor pool (:2553-2610, :2762-2876) ----

  /** WorkAvailable (:2606-2609). Note C# has TWO of these: the public
   *  property here tests `Count != 0`, and the one at :494 tests
   *  `npcsWithWork != null && Count > 0`. Same answer, kept as one. */
  get workAvailable() { return this.npcsWithWork.size !== 0; }

  /** IsNpcOfferingQuest (:2551-2554): in the pool, and not already
   *  the questor of a running quest. */
  isNpcOfferingQuest(nameSeed) {
    return this.npcsWithWork.has(nameSeed)
      && !(this.deps.isLastNPCClickedAnActiveQuestor?.() ?? false);
  }

  /** IsCastleNpcOfferingQuest (:2556-2572): a castle NPC gets ONE
   *  roll ever, at 25%, and is added to castleNPCsSpokenTo either way
   *  so "don't offer more than one quest at a time".
   *
   *  KEPT: the pool is stamped only when the three guards pass - an
   *  NPC clicked outside a castle, or while a questor is active, is
   *  never marked as spoken to and can still be rolled later. */
  isCastleNpcOfferingQuest(nameSeed) {
    if (!(this.deps.isPlayerInsideCastle?.() ?? false)
      || this.castleNPCsSpokenTo.has(nameSeed)
      || (this.deps.isLastNPCClickedAnActiveQuestor?.() ?? false)) {
      return false;
    }
    const rand = this._range(4);
    const result = rand === 0;
    this.castleNPCsSpokenTo.set(nameSeed, true);
    return result;
  }

  /** SetRandomQuestor (:2574-2584). C# uses `new System.Random()` here
   *  rather than UnityEngine.Random - a DIFFERENT generator from every
   *  other roll in TalkManager, unseeded and wall-clock dependent
   *  (Ledger A: unspecified, so the port's own roll is as faithful).
   *  An empty pool leaves the standing key alone. */
  setRandomQuestor() {
    if (!this.workAvailable) return;
    const keys = [...this.npcsWithWork.keys()];
    this.selectedNpcWorkKey = keys[this._range(keys.length)];
  }

  /** GetQuestorName (:2586-2590): the name is SEEDED by the questor's
   *  own nameSeed, so it is the same name every time it is asked. */
  getQuestorName() {
    const entry = this.npcsWithWork.get(this.selectedNpcWorkKey);
    if (!entry) return '';
    srand(entry.npc.nameSeed);
    return this.deps.fullName?.(entry.npc.nameBank, entry.npc.gender) ?? '';
  }

  getQuestorGender() { return this.npcsWithWork.get(this.selectedNpcWorkKey)?.npc?.gender ?? null; }
  getQuestorLocation() { return this.npcsWithWork.get(this.selectedNpcWorkKey)?.buildingName ?? ''; }

  /** RemoveNpcQuestor (:2600-2604) - the offer flow's seam. */
  removeNpcQuestor(nameSeed) { this.npcsWithWork.delete(nameSeed); }

  /** The questor half of GetBuildingList (:2762-2876). The block walk
   *  itself is the host's (it already feeds TK-ii's getBuildingList);
   *  what rides here is the pool policy over the candidates it finds:
   *  `buildings` is [{buildingType, buildingKey, buildingName,
   *  isNamedBuilding, npcs: [{nameSeed, factionID, gender, isChild,
   *  ...}]}] - the NPC's social group is NOT taken as given: C#
   *  resolves each candidate's faction through GetStaticNPCFactionData
   *  with the BUILDING's own type (:2814-2816), so the id-0 court /
   *  people redirect and the three generic Random_* redirects apply
   *  here exactly as they do at a click, and the sgroup is read
   *  UNCLAMPED (the Merchants clamp belongs to SetTargetNPC alone).
   *
   *  KEPT, in C#'s own order:
   *  - the pool is cleared and rebuilt only when the location CHANGED
   *    (exteriorUsedForQuestors), so a re-entered town keeps its
   *    questors and its spent ones stay spent;
   *  - the 25% roll is `Range(0, 4)` with `< 3` CONTINUING, so it is
   *    the roll of 3 alone that offers work;
   *  - the roll is spent BEFORE the child test and before the
   *    already-in-pool test, so those NPCs consume a roll they can
   *    never use;
   *  - only Merchants, Commoners and Nobility are candidates;
   *  - an UNNAMED building's candidate is built and then dropped -
   *    it never enters the pool;
   *  - selectedNpcWorkKey is left pointing at the LAST NPC added, so
   *    a pool build silently reselects the questor. */
  // QP1 (2026-08-28) FED IT: townTalk's rebuildDirectory - the port's
  // GetBuildingList - hands in talkTopics.questorCandidateBuildings,
  // the per-building people walk over the same block correlation the
  // directory rides, each person through the one SetLayoutData law.
  // AUDIT 24 had found this dead and silent (the host's building seam
  // carried no NPC records, so npcsWithWork stayed empty for ever and
  // no townsperson had "any work").
  buildQuestorPool(buildings = []) {
    const locationIndex = this.deps.currentLocationIndex?.() ?? 0;
    if (this.exteriorUsedForQuestors === locationIndex) return false;
    this.npcsWithWork.clear();
    const nameBank = this.deps.nameBankOfCurrentRegion?.() ?? 0;
    for (const building of buildings) {
      for (const npc of (building.npcs ?? [])) {
        const factionData = this.getStaticNPCFactionData(npc.factionID ?? 0, building.buildingType);
        const socialGroup = (factionData ?? EMPTY_FACTION).sgroup;
        if (socialGroup !== SOCIAL_GROUP.Merchants
          && socialGroup !== SOCIAL_GROUP.Commoners
          && socialGroup !== SOCIAL_GROUP.Nobility) continue;
        const randomChance = this._range(4);
        if (randomChance < 3) continue;
        if (npc.isChild) continue;
        if (this.npcsWithWork.has(npc.nameSeed)) continue;
        if (!building.isNamedBuilding) continue;
        this.npcsWithWork.set(npc.nameSeed, {
          npc: { ...npc, buildingKey: building.buildingKey, nameBank },
          socialGroup,
          buildingName: building.buildingName,
        });
        this.selectedNpcWorkKey = npc.nameSeed;
      }
      // C# stamps the flag inside the per-building loop (:2874), so
      // the FIRST building processed claims the location - a walk that
      // dies later still counts as done
      this.exteriorUsedForQuestors = locationIndex;
    }
    return true;
  }

  // ---- the post-quest greeting (:909-941) ----

  /** GetNPCQuestGreeting: a STATIC NPC who was the questor of a quest
   *  that left a post-quest message greets with that message instead
   *  of any faction greeting. Mobiles never do.
   *
   *  KEPT: the match is EITHER the questor's stored NPC data equalling
   *  this one, OR - for an individual NPC - the faction ids matching;
   *  and the tokens are expanded with reveal TRUE, so greeting a
   *  finished questor can still reveal dialog-linked resources. */
  getNPCQuestGreeting() {
    // the guild is looked up BEFORE the type gate in C# (:911-913),
    // for a mobile as much as a static
    const guild = this.deps.guildOfBuildingFaction?.() ?? null;
    if (this.currentNPCType !== NPC_TYPE.Static) return '';
    const posts = this.deps.questorPostMessages?.() ?? new Map();
    for (const [questID, tokens] of posts) {
      const quest = this.deps.getQuest?.(questID) ?? null;
      if (!quest) continue;
      for (const person of (quest.resources?.values?.() ?? [])) {
        if (!person.isPerson) continue;
        const matches = (this.deps.isNPCDataEqual?.(person.questorData, this.lastTargetStaticNPC?.data) ?? false)
          || (person.isIndividualNPC && person.factionData?.id === (this.lastTargetStaticNPC?.data?.factionID ?? null));
        if (!person.isQuestor || !matches) continue;
        if (guild?.isMember?.()) quest.externalMCP = guild;
        // KEPT: **THE UNCLONED QUESTOR POST.** ExpandQuestMessage
        // writes each expanded string back into the token it came
        // from (QuestMacroHelper.cs:157), and C# hands it the array
        // straight out of dictQuestorPostQuestMessage (:927) - so the
        // STORED message is permanently expanded by the first
        // greeting. GetAnswerFromTokensArray clones before expanding
        // for exactly this reason, with DFU's own comment naming the
        // altering macros that must re-evaluate; this arm does not,
        // so an altering macro in a post-quest message freezes at its
        // first value. Kept: the tokens are passed through uncloned,
        // and the conversion uses the DEFAULT separator (:936), not
        // the mill's `false`.
        this.deps.expandQuestMessage?.(quest, tokens, true);
        return tokensToString(tokens);
      }
    }
    return '';
  }

  // ---- the conversation save halves this slice owns (:2426-2447) ----

  getSaveData() {
    return {
      npcsWithWork: [...this.npcsWithWork.entries()].map(([k, v]) => [k, { ...v, npc: { ...v.npc } }]),
      castleNPCsSpokenTo: [...this.castleNPCsSpokenTo.entries()],
    };
  }

  /** RestoreConversationData's halves (:2541-2546): each is restored
   *  only when the save CARRIES it, so an older save keeps whatever
   *  the running session had rather than being emptied. */
  restoreSaveData(data) {
    const d = data ?? {};
    if (d.npcsWithWork != null) {
      this.npcsWithWork = new Map(d.npcsWithWork.map(([k, v]) => [k, { ...v, npc: { ...v.npc } }]));
    }
    if (d.castleNPCsSpokenTo != null) this.castleNPCsSpokenTo = new Map(d.castleNPCsSpokenTo);
  }

  // ---- the event handlers (:3593-3629) ----
  //
  // Six subscriptions (:506-511), and between them they do only three
  // things. Ported here because TalkToDungeonInterior's is the ONLY
  // reader of castleNPCsSpokenTo's reset, and because a host that
  // wires four of the six has a topic list that quietly goes stale.

  /** OnMapPixelChanged (:3593-3597) / OnTransitionToExterior
   *  (:3599-3603) / OnTransitionToDungeonExterior (:3605-3609) /
   *  OnLoadEvent (:3616-3620) - all four are the SAME two lines: ask
   *  for a rebuild, and refresh the building list now. */
  onWorldChanged() {
    this.deps.raiseTopicListRebuild?.();
    this.deps.getBuildingList?.();
  }

  /** OnTransitionToDungeonInterior (:3611-3614). Entering a dungeon
   *  interior - which is what a castle is - forgets who has already
   *  been spoken to, so every castle NPC gets a fresh 25% roll on
   *  each visit. Note it does NOT ask for a rebuild: this is the one
   *  transition that does not. */
  onEnterDungeonInterior() {
    this.castleNPCsSpokenTo.clear();
  }

  /** OnStartGame (:3625-3629). C#'s comment: "important when starting
   *  from classic save import" - a new game inherits neither quest
   *  topics nor rumors. Both live elsewhere in the port, so both ride
   *  seams. */
  onStartGame() {
    this.deps.clearQuestInfo?.();
    this.deps.clearRumorMill?.();
  }
}

/** ROAD-D D10 - GetPortraitIndexFromStaticNPCBillboard
 *  (TalkManager.cs:3505-3543), whole and pure. It answers WHICH face
 *  archive and WHICH record a static NPC's talk portrait comes from,
 *  and its three-step overwrite is DFU's own:
 *
 *   1. an INDIVIDUAL faction (type 4) portraits from its own `face`
 *      field and returns immediately - and the archive test is
 *      INVERTED against intuition: `face > 60` is a COMMON face
 *      (TFAC00I0.RCI), 60 and below a SPECIAL one (FACES.CIF), which
 *      is the same split ui/hudEscortFaces.js resolveFaceImage keeps;
 *   2. everyone else starts at record 410 - DFU's own comment calls
 *      it "oops", the face shown when nothing else resolves;
 *   3. the faction's FLAT (flat1, or flat2 for a female NPC) is
 *      decoded to archive/record and looked up in FLATS.CFG for a
 *      faceIndex; then the NPC's OWN billboard is looked up the same
 *      way and overwrites it when it resolves, "more specific than
 *      just the factiondata - which will always resolve to the same
 *      portrait for a specific faction".
 *
 *  `flatFaceIndex(archive, record)` is FlatsFile.GetFlatData's
 *  faceIndex (formats/flatsFile.js:84 returns -1 when the flat is
 *  absent, which is this function's not-found arm). */
export const OOPS_PORTRAIT_RECORD = 410;
export function portraitIndexFromStaticNPCBillboard(data, { factionData = null, flatFaceIndex = null } = {}) {
  const f = factionData ?? EMPTY_FACTION;
  if (f.type === FACTION_TYPE.Individual) {
    return { archive: (f.face ?? 0) > 60 ? 'CommonFaces' : 'SpecialFaces', record: f.face ?? 0 };
  }
  let record = OOPS_PORTRAIT_RECORD;
  const flat = (data?.gender ?? 0) === GENDERS.Female ? (f.flat2 ?? 0) : (f.flat1 ?? 0);
  const fromFaction = flatFaceIndex?.(flatArchive(flat), flatRecord(flat)) ?? -1;
  if (fromFaction >= 0) record = fromFaction;
  const fromBillboard = flatFaceIndex?.(data?.billboardArchiveIndex ?? 0, data?.billboardRecordIndex ?? 0) ?? -1;
  if (fromBillboard >= 0) record = fromBillboard;
  return { archive: 'CommonFaces', record };
}
