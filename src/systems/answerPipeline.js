// THE ANSWER PIPELINE (TK-iii) - TalkManager.cs's question/answer half
// (MIT, Daggerfall Workshop): GetQuestionText's ladder (:1298-1353),
// GetAnswerText's dispatch (:1992-2043), GetAnswerTellMeAboutTopic
// (:2045-2062), GetAnswerWhereIs (:1839-1866),
// GetAnswerWhereIsRegionalBuilding + GetRegionalLocationCityName +
// GetLocationWithRegionalBuilding + CheckLocationKeyForRegionalBuilding
// (:1868-1990), GetNPCKnowledgeAboutItem (:567-627),
// GetClassicQuestionIndex (:691-724), the dialog hints (:1768-1793),
// GetKeySubjectPersonHint (:1725-1766), the building-hint fork
// (:1692-1723), the compass family (:1163-1281),
// MarkKeySubjectLocationOnMap (:1283-1296), the PC opening texts
// (:1133-1156), GetWorkString (:1158-1161), GetOrganizationInfo
// (:1552-1556), GetHonoric/GetOldLeaderFateString (:1826-1837) and
// GetAnswerWhereAmI (:1521-1550).
//
// The TABLES this rides on already live in systems/talkTopics.js
// (T3c-T3f shipped them): answersToDirections/answersToNonDirections,
// knowledgeModifiers, the reaction-tier machinery, the compass bands
// and the 0.35 map-reveal fork. This module is the LADDER over them -
// which record a question draws, which answer arm a topic takes, and
// what each arm marks on the way through.
//
// KEPT QUIRKS, each by C# line:
//   - THE DEAD KEY OVERRIDE (:1727-1731): GetKeySubjectPersonHint
//     assigns `key = currentQuestionListItem.key`, then tests whether
//     that same field is non-empty and assigns it AGAIN. The branch
//     cannot change anything.
//   - THE ONE-ANSWER GATE IS TELL-ME-ABOUT ONLY (:2050-2052): the
//     where-is arm never counts against
//     numAnswersGivenTellMeAboutOrRumors, and never increments it -
//     an NPC gives directions all day but discusses ONE topic.
//   - THE KNOWS-BUT-SILENT ARM (:2050): a topic the NPC KNOWS still
//     answers the doesn't-know record once the one-answer gate has
//     closed - unless they are in the same building, a spymaster, or
//     the debug flag is up. The gate is checked with an OR against
//     the knowledge, so knowledge alone does not win.
//   - GetAnswerWhereIs's DoesNotKnow arm checks NPCsKnowEverything
//     but NOT isSpyMaster (:1844) where the tell-me-about arm checks
//     both - asymmetric in C#, kept.
//   - GetDialogHint2's spymaster arm reads anyInfo where everyone
//     else reads rumors, and NPCsKnowEverything deliberately does NOT
//     apply (:1783's own comment); an empty rumors list falls back to
//     anyInfo.
//   - THE COMPASS MARK (:1192-1198): asking for a direction stamps
//     ReceivedDirectionalHints - but never downgrades a resource
//     already marked LocationWasMarkedOnMap.
//   - GetKeySubjectBuildingHint takes the DIRECTION arm when the roll
//     is > 0.35 OR the player is inside (:1713) - inside, a map mark
//     is impossible.
//
// deps (the host wires; absent members idle LOUDLY):
//   expandRandomTextRecord(id)   - the TEXT.RSC record + macro pass
//   localizedText(key)           - the Internal_Strings literals
//   getNewsOrRumors(session)     - the mill (TK-i)
//   tree                         - the TopicTree (TK-ii): dictQuestInfo,
//                                  the gates, the building lookups
//   npcSession                   - { socialGroup, isSpyMaster,
//                                  numAnswersGivenTellMeAboutOrRumors,
//                                  factionData } (TK-iv owns it)
//   npcsKnowEverything() / npcsAlwaysFriendly()
//   reactionTier()               - GetReactionToPlayer_0_1_2 through
//                                  talkTopics (T3f), already shipped
//   isPlayerInside()
//   currentRegion()              - { locationCount, mapTable, mapNames }
//   getLocation(regionIndex, i) / currentRegionIndex()
//   discoverBuilding(buildingKey)
//   buildingCompassDirection(buildingKey) - the geometry (TK-v wires
//                                  the live automap coordinates)
//   rolls                        - Math.random-compatible

import {
  ANSWERS_TO_DIRECTIONS, ANSWERS_TO_NON_DIRECTIONS, KNOWLEDGE_MODIFIERS,
  CHANCE_TO_REVEAL_LOCATION_ON_MAP, DIRECTION_TEXT_ID, MAP_REVEAL_TEXT_ID,
} from './talkTopics.js';
import { QUESTION_TYPE, NPC_KNOWLEDGE, BUILDING_HINT_TYPE, FACTIONS_AND_BUILDINGS } from './topicTree.js';
import { randomRangeInclusive, srand } from '../formats/dfRandom.js';

/** The question records (:1298-1353). */
export const QUESTION_RECORDS = Object.freeze({
  news: 7231,          // + toneIndex
  tellMeAbout: 7212,   // + toneIndex (orgs, quest topics, work)
  whereIs: 7225,       // + toneIndex (buildings, persons, regional)
});

/** The Work answer records (:2021-2037). */
export const WORK_RECORDS = Object.freeze({ noWork: 8078, tier0: 8075, tier1: 8076, tier2: 8077 });

/** GetWorkString (:1158-1161) and the PC opening records (:1133-1147). */
export const WORK_STRING_RECORD = 7211;
export const PC_GREETING_RECORD = 7215;    // + toneIndex
export const PC_FOLLOWUP_RECORD = 7218;    // + toneIndex
export const PC_STRANGER_RECORD = 7221;    // + toneIndex

/** GetOrganizationInfo (:1552-1556): 860 + the index, with the >7
 *  SKIP that DFU's own comment calls error-prone. */
export const ORGANIZATION_INFO_BASE = 860;
export const organizationInfoRecord = (index) => ORGANIZATION_INFO_BASE + (index > 7 ? index + 1 : index);

/** GetAnswerWhereIsRegionalBuilding (:1868-1874). */
export const REGIONAL_FOUND_RECORD = 10;
export const REGIONAL_NOT_FOUND_RECORD = 11;

/** GetRegionalLocationCityName's lookUpIndexes (:1878-1879) - one per
 *  FactionsAndBuildings row. */
export const REGIONAL_LOOKUP_INDEXES = Object.freeze([
  0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d, 0x0d,
  0x19, 0x1a, 0x1b, 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23,
  0x24, 0x27,
  0x00, 0x0b, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0a, 0x0c,
]);

/** GetClassicQuestionIndex (:691-724): the knowledge/reaction tables
 *  are indexed by CLASSIC question, not by the port's QuestionType.
 *  The default 2 "gives no bonus or penalty" (DFU's own words). */
export function getClassicQuestionIndex(questionType) {
  switch (questionType) {
    case QUESTION_TYPE.LocalBuilding:
    case QUESTION_TYPE.Regional:
      return 0;
    case QUESTION_TYPE.Person:
      return 1;
    case QUESTION_TYPE.Thing:
      return 2;
    case QUESTION_TYPE.Work:
      return 3;
    case QUESTION_TYPE.QuestLocation:
    case QUESTION_TYPE.OrganizationInfo:
      return 4;
    case QUESTION_TYPE.QuestPerson:
      return 5;
    case QUESTION_TYPE.QuestItem:
      return 6;
    default:
      return 2;
  }
}

/** CheckLocationKeyForRegionalBuilding (:1920-1990): the classic
 *  location KEY is three flag bytes - temples in byte 0, stores in
 *  byte 1, guilds in byte 2 - and each building asks for one bit.
 *  C#'s `(byte)(flags << n) >> 7` truncates to 8 bits BEFORE the
 *  unsigned shift, which reads bit (7 - n); the port spells that as
 *  `((flags << n) & 0xff) >> 7`. */
const bitAt = (flags, shiftLeft) => (((flags << shiftLeft) & 0xff) >> 7);

export function checkLocationKeyForRegionalBuilding(key, index, faction) {
  const templeFlags = key & 0xff;
  const storeFlags = (key >> 8) & 0xff;
  const guildFlags = (key >> 16) & 0xff;
  if (index > 0x27) return 0;   // out of range
  switch (index) {
    case 0: return storeFlags & 1;            // Tavern
    case 3: return bitAt(storeFlags, 6);      // Weapon Smith
    case 4: return bitAt(storeFlags, 5);      // Armorer
    case 5: return bitAt(storeFlags, 4);      // Alchemist
    case 6: return bitAt(storeFlags, 3);      // Bank
    case 7: return bitAt(storeFlags, 2);      // Bookstore
    case 8: return bitAt(storeFlags, 1);      // Clothing store
    case 0xa: return storeFlags >> 7;         // Gem store
    case 0xb: return guildFlags & 1;          // Library
    case 0xc: return bitAt(guildFlags, 1);    // Pawn Shop
    case 0xd:                                  // Temples, by divine faction
      switch (faction) {
        case 21: return bitAt(templeFlags, 6);   // Arkay
        case 22: return templeFlags >> 7;        // Zen
        case 24: return bitAt(templeFlags, 2);   // Mara
        case 26: return templeFlags & 1;         // Akatosh
        case 27: return bitAt(templeFlags, 4);   // Julianos
        case 29: return bitAt(templeFlags, 5);   // Dibella
        case 33: return bitAt(templeFlags, 1);   // Stendarr
        case 35: return bitAt(templeFlags, 3);   // Kynareth
        default: return 0;
      }
    case 0x19: case 0x1a: case 0x1b: case 0x1d: case 0x1e:
    case 0x1f: case 0x20: case 0x21: case 0x22: case 0x23:
      return bitAt(guildFlags, 6);            // the ten knightly orders
    case 0x24: return bitAt(guildFlags, 5);   // Mages Guild
    case 0x27: return bitAt(guildFlags, 2);   // Fighters Guild
    default: return 0;
  }
}

export class AnswerPipeline {
  constructor(deps = {}) {
    this.deps = deps;
    this.currentQuestionListItem = null;
    this.currentKeySubject = '';
    this.currentKeySubjectType = 'Unset';
    this.currentKeySubjectBuildingKey = -1;
    this.numQuestionsAsked = 0;
    this.questionOpeningText = '';
    this.markLocationOnMap = false;
    this.locationOfRegionalBuilding = '';
    this.reactionToPlayer012 = 0;
    // GetReactionToPlayer_0_1_2 stamps this as part of its own
    // recompute (:682); GetAnswerText's gate reads it (:1994) and
    // StartNewConversation resets it to -1 (:2659).
    this.lastToneIndex = -1;
  }

  /** The tone gate C# spells inline at the head of GetAnswerText
   *  (:1994-1995): the reaction tier is recomputed only when the tone
   *  CHANGED since the last question, and the recompute stamps
   *  lastToneIndex on its way through (C# does that inside
   *  GetReactionToPlayer_0_1_2 itself). Held HERE rather than in the
   *  caller so a host cannot forget it. */
  _refreshReactionTier(questionType) {
    const toneIndex = this.deps.toneIndex?.() ?? -1;
    if (this.lastToneIndex === toneIndex) return;
    const tier = this.deps.reactionTier?.(questionType, this._session().socialGroup);
    if (tier == null) return;   // no seam: the standing tier holds (headless)
    this.reactionToPlayer012 = tier;
    this.lastToneIndex = toneIndex;
  }

  /** StartNewConversation's half of the reset (:2659). */
  resetToneSession() { this.lastToneIndex = -1; }

  _rolls() { return this.deps.rolls ?? Math.random; }
  _record(id) { return this.deps.expandRandomTextRecord?.(id) ?? ''; }
  _text(key) { return this.deps.localizedText?.(key) ?? ''; }
  _session() { return this.deps.npcSession?.() ?? { socialGroup: 0, isSpyMaster: false, numAnswersGivenTellMeAboutOrRumors: 0 }; }
  _knowsEverything() { return this.deps.npcsKnowEverything?.() ?? false; }

  // ---- the question half (:1298-1353) ----

  /** GetQuestionText: which record the PC's question draws, and the
   *  key-subject state each type leaves behind. */
  getQuestionText(listItem, toneIndex = 1) {
    this.currentKeySubject = listItem.caption;
    this.currentQuestionListItem = listItem;
    switch (listItem.questionType) {
      case QUESTION_TYPE.News:
        return this._record(QUESTION_RECORDS.news + toneIndex);
      case QUESTION_TYPE.WhereAmI:
        return this._text('WhereAmI');
      case QUESTION_TYPE.OrganizationInfo:
        this.currentKeySubjectType = 'Organization';
        return this._record(QUESTION_RECORDS.tellMeAbout + toneIndex);
      case QUESTION_TYPE.LocalBuilding:
        this.currentKeySubjectType = 'Building';
        this.currentKeySubjectBuildingKey = listItem.buildingKey;
        return this._record(QUESTION_RECORDS.whereIs + toneIndex);
      case QUESTION_TYPE.Person:
        this.currentKeySubjectType = 'Person';
        return this._record(QUESTION_RECORDS.whereIs + toneIndex);
      case QUESTION_TYPE.Thing:
        return 'Not implemented';   // classic did not implement this either
      case QUESTION_TYPE.Regional:
        this.currentKeySubjectType = 'Building';
        // an improvement over classic DFU keeps: "Any" lower-cased
        // mid-sentence
        this.currentKeySubject = this.currentKeySubject.replace(this._text('toBeReplacedStringRegional'), this._text('replacementStringRegional'));
        return this._record(QUESTION_RECORDS.whereIs + toneIndex);
      case QUESTION_TYPE.QuestLocation:
      case QUESTION_TYPE.QuestPerson:
      case QUESTION_TYPE.QuestItem:
        this.currentKeySubjectType = 'QuestTopic';
        return this._record(QUESTION_RECORDS.tellMeAbout + toneIndex);
      case QUESTION_TYPE.Work:
        this.currentKeySubjectType = 'Work';
        return this._record(QUESTION_RECORDS.tellMeAbout + toneIndex);
      default:
        return '';
    }
  }

  /** GetPCGreetingText / GetPCFollowUpText / GetPCGreetingOrFollowUpText
   *  (:1133-1156): the first question opens with a greeting, later
   *  ones with a follow-up; the NPC is addressed by name only when
   *  they like the player (reaction > 0). */
  getPCGreetingOrFollowUpText(toneIndex = 1, reactionToPlayer = 0, nameNPC = '') {
    if (this.numQuestionsAsked === 0) {
      const greetingNameNPC = reactionToPlayer <= 0 ? this._record(PC_STRANGER_RECORD + toneIndex) : nameNPC;
      this.questionOpeningText = this._record(PC_GREETING_RECORD + toneIndex);
      this.lastGreetingNameNPC = greetingNameNPC;   // the %n the record expands
    } else {
      this.questionOpeningText = this._record(PC_FOLLOWUP_RECORD + toneIndex);
    }
    return this.questionOpeningText;
  }

  getWorkString() { return this._record(WORK_STRING_RECORD); }

  /** GetOrganizationInfo (:1552-1556). */
  getOrganizationInfo(listItem) { return this._record(organizationInfoRecord(listItem.index)); }

  /** GetHonoric (:1826-1832) / GetOldLeaderFateString (:1834-1837). */
  getHonoric(gender) { return gender === 'male' ? this._text('Sir') : this._text("Ma'am"); }
  getOldLeaderFateString(index) { return this._text(`oldLeaderFate${index}`); }

  // ---- the knowledge roll (:567-627) ----

  /** GetNPCKnowledgeAboutItem: the region gate, the always-knows
   *  arms, the organization-membership fix, the quest-person
   *  building dependency, then the seeded 1..20 roll against the
   *  knowledge modifier. `npcSeed` stands in for C#'s
   *  GetHashCode() on the NPC object (Ledger A - an engine identity
   *  the port supplies itself). */
  getNPCKnowledgeAboutItem(listItem, npcSeed = 0) {
    const tree = this.deps.tree;
    const session = this._session();
    // outside the current region an NPC never knows
    if (tree && !tree.checkNPCcanKnowAboutTellMeAboutTopic(listItem)) return NPC_KNOWLEDGE.DoesNotKnowAboutItem;
    if ((tree && tree.checkNPCisInSameBuildingAsTopic(listItem)) || session.isSpyMaster || this._knowsEverything()) {
      return NPC_KNOWLEDGE.KnowsAboutItem;
    }
    // fixed from classic: an NPC of an organization knows about it
    if (listItem.questionType === QUESTION_TYPE.OrganizationInfo
      && (this.deps.isFaction2RelatedToFaction1?.(session.factionData?.id ?? 0, listItem.factionID) ?? false)) {
      return NPC_KNOWLEDGE.KnowsAboutItem;
    }
    // fixed from classic: an NPC who cannot place the BUILDING cannot
    // place the person inside it
    if (listItem.questionType === QUESTION_TYPE.Person && this.currentKeySubjectBuildingKey !== -1 && tree) {
      for (const group of tree.listTopicLocation) {
        const buildingListItem = (group.listChildItems ?? []).find((x) => x.buildingKey === this.currentKeySubjectBuildingKey);
        if (buildingListItem) {
          if (buildingListItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.NotSet) {
            buildingListItem.npcKnowledgeAboutItem = this.getNPCKnowledgeAboutItem(buildingListItem, npcSeed);
          }
          if (buildingListItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.DoesNotKnowAboutItem) return NPC_KNOWLEDGE.DoesNotKnowAboutItem;
          break;   // found the building, no need to continue
        }
      }
    }
    // the roll is stable per (NPC, topic): the NPC's identity plus
    // the building key, else the resource key's hash, else the
    // caption's
    let seed = npcSeed >>> 0;
    if (listItem.buildingKey !== -1) seed = (seed + (listItem.buildingKey >>> 0)) >>> 0;
    else if (listItem.key !== '') seed = (seed + (stringHash(listItem.key) >>> 0)) >>> 0;
    else seed = (seed + (stringHash(listItem.caption) >>> 0)) >>> 0;
    srand(seed);
    const classicQuestionIndex = getClassicQuestionIndex(listItem.questionType);
    const rollToBeat = KNOWLEDGE_MODIFIERS[classicQuestionIndex * 5 + session.socialGroup] + 10;
    return randomRangeInclusive(1, 20) <= rollToBeat ? NPC_KNOWLEDGE.KnowsAboutItem : NPC_KNOWLEDGE.DoesNotKnowAboutItem;
  }

  // ---- the answer half (:1839-2062) ----

  /** GetAnswerText (:1992-2043): the dispatch, the question counter
   *  and the opening-text reset. `reactionTier` is T3f's
   *  GetReactionToPlayer_0_1_2, recomputed only when the tone
   *  changed (the caller owns that gate, exactly as C# does). */
  getAnswerText(listItem, { npcSeed = 0, workAvailable = false } = {}) {
    this._refreshReactionTier(listItem.questionType);
    this.currentQuestionListItem = listItem;
    let answer = '';
    switch (listItem.questionType) {
      case QUESTION_TYPE.News:
        answer = this.deps.getNewsOrRumors?.(this._session()) ?? '';
        break;
      case QUESTION_TYPE.WhereAmI:
        answer = this.getAnswerWhereAmI();
        break;
      case QUESTION_TYPE.LocalBuilding:
      case QUESTION_TYPE.Person:
      case QUESTION_TYPE.Thing:   // never reached - no where-is for things in classic
        answer = this.getAnswerWhereIs(listItem, npcSeed);
        break;
      case QUESTION_TYPE.Regional:
        answer = this.getAnswerWhereIsRegionalBuilding(listItem);
        break;
      case QUESTION_TYPE.OrganizationInfo:
      case QUESTION_TYPE.QuestLocation:
      case QUESTION_TYPE.QuestPerson:
      case QUESTION_TYPE.QuestItem:
        answer = this.getAnswerTellMeAboutTopic(listItem, npcSeed);
        break;
      case QUESTION_TYPE.Work:
        if (!workAvailable) { answer = this._record(WORK_RECORDS.noWork); break; }
        if (this.reactionToPlayer012 === 0) { answer = this._record(WORK_RECORDS.tier0); break; }
        if (this.reactionToPlayer012 === 1) answer = this._record(WORK_RECORDS.tier1);
        else if (this.reactionToPlayer012 === 2) answer = this._record(WORK_RECORDS.tier2);
        this.deps.setRandomQuestor?.();
        break;
      default:
        break;
    }
    this.numQuestionsAsked++;
    this.questionOpeningText = '';   // re-created for the next question
    return answer;
  }

  /** GetAnswerTellMeAboutTopic (:2045-2062) - THE KNOWS-BUT-SILENT
   *  ARM and the one-answer gate. */
  getAnswerTellMeAboutTopic(listItem, npcSeed = 0) {
    const session = this._session();
    if (listItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.NotSet) {
      listItem.npcKnowledgeAboutItem = this.getNPCKnowledgeAboutItem(listItem, npcSeed);
    }
    const gateClosed = session.numAnswersGivenTellMeAboutOrRumors >= 1
      && !(this.deps.tree?.checkNPCisInSameBuildingAsTopic(listItem) ?? false)
      && !session.isSpyMaster && !this._knowsEverything();
    if (listItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.DoesNotKnowAboutItem || gateClosed) {
      return this._record(ANSWERS_TO_NON_DIRECTIONS[3 * session.socialGroup + this.reactionToPlayer012]);
    }
    session.numAnswersGivenTellMeAboutOrRumors++;
    return this._record(ANSWERS_TO_NON_DIRECTIONS[15 + 3 * session.socialGroup + this.reactionToPlayer012]);
  }

  /** GetAnswerWhereIs (:1839-1866). The doesn't-know arm checks
   *  NPCsKnowEverything but NOT isSpyMaster - asymmetric with the
   *  tell-me-about arm above, kept; and the where-is answers never
   *  touch the one-answer counter. */
  getAnswerWhereIs(listItem, npcSeed = 0) {
    const session = this._session();
    if (listItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.NotSet) {
      listItem.npcKnowledgeAboutItem = this.getNPCKnowledgeAboutItem(listItem, npcSeed);
    }
    if (listItem.npcKnowledgeAboutItem === NPC_KNOWLEDGE.DoesNotKnowAboutItem && !this._knowsEverything()) {
      return this._record(ANSWERS_TO_DIRECTIONS[3 * session.socialGroup + this.reactionToPlayer012]);
    }
    if (listItem.questionType === QUESTION_TYPE.LocalBuilding && listItem.npcInSameBuildingAsTopic) {
      return format(this._text('YouAreInSameBuilding'), listItem.caption);
    }
    if (listItem.questionType === QUESTION_TYPE.Person && listItem.npcInSameBuildingAsTopic) {
      const building = this.deps.tree?.getBuildingInfoCurrentBuildingOrPalace();
      if (building && building.name !== '') return format(this._text('NpcInSameBuilding'), listItem.caption, building.name);
      return this._text('resolvingError');
    }
    return this._record(ANSWERS_TO_DIRECTIONS[15 + 3 * session.socialGroup + this.reactionToPlayer012]);
  }

  /** GetAnswerWhereAmI (:1521-1550): every NPC knows this one, and
   *  it has FOUR arms - a building (its discovered display name, else
   *  the building list's own name), a dungeon or castle (its special
   *  name + the dungeon's region), the outdoors (location + region),
   *  and the unreachable-in-practice fall-through: inside, with no
   *  exterior door and not a dungeon, C# answers resolvingError. */
  getAnswerWhereAmI() {
    const tmpl = this._text('AnswerTextWhereAmI');
    if (this.deps.isPlayerInside?.() ?? false) {
      const buildingKey = this.deps.currentExteriorDoorBuildingKey?.() ?? null;
      if (buildingKey != null) {
        const discovered = this.deps.getAnyBuilding?.(buildingKey) ?? null;
        if (discovered) return format(tmpl, discovered.displayName, this.deps.currentLocationName?.() ?? '');
        // the fallback when no discovery record exists
        const currentBuilding = (this.deps.tree?.listBuildings ?? []).find((x) => x.buildingKey === buildingKey);
        return format(tmpl, currentBuilding?.name ?? '', this.deps.currentLocationName?.() ?? '');
      }
      if ((this.deps.isPlayerInsideCastle?.() ?? false) || (this.deps.isPlayerInsideDungeon?.() ?? false)) {
        return format(tmpl, this.deps.specialDungeonName?.() ?? '', this.deps.dungeonRegionName?.() ?? '');
      }
    } else {
      return format(tmpl, this.deps.currentLocationName?.() ?? '', this.deps.currentRegionName?.() ?? '');
    }
    return this._text('resolvingError');
  }

  /** GetAnswerWhereIsRegionalBuilding (:1868-1874) +
   *  GetRegionalLocationCityName (:1876-1889). */
  getAnswerWhereIsRegionalBuilding(listItem) {
    return this.getRegionalLocationCityName(listItem)
      ? this._record(REGIONAL_FOUND_RECORD)
      : this._record(REGIONAL_NOT_FOUND_RECORD);
  }

  getRegionalLocationCityName(listItem) {
    const location = this.getLocationWithRegionalBuilding(REGIONAL_LOOKUP_INDEXES[listItem.index], FACTIONS_AND_BUILDINGS[listItem.index]);
    if (location) {
      this.locationOfRegionalBuilding = location.name;
      return true;
    }
    return false;
  }

  /** GetLocationWithRegionalBuilding (:1891-1918): count the region's
   *  locations carrying the building, then walk again to the
   *  Range(0, count) + 1 pick. */
  getLocationWithRegionalBuilding(index, faction) {
    const region = this.deps.currentRegion?.() ?? null;
    if (!region) return null;
    let count = 0;
    for (let i = 0; i < region.locationCount; i++) {
      count += checkLocationKeyForRegionalBuilding(region.mapTable[i].key, index, faction);
    }
    if (count <= 0) return null;
    let locationToChoose = Math.floor(this._rolls()() * count) + 1;
    for (let i = 0; i < region.locationCount; i++) {
      locationToChoose -= checkLocationKeyForRegionalBuilding(region.mapTable[i].key, index, faction);
      if (locationToChoose === 0) {
        return this.deps.getLocation?.(this.deps.currentRegionIndex?.() ?? -1, i) ?? null;
      }
    }
    return null;
  }

  // ---- the hints (:1692-1793) ----

  /** GetKeySubjectBuildingDirection (:1692-1696) /
   *  GetKeySubjectBuildingOnMap (:1698-1705) / the fork
   *  (:1707-1723): a roll ABOVE the 0.35 chance, or being indoors,
   *  takes the direction arm. */
  getKeySubjectBuildingDirection() {
    this.markLocationOnMap = false;
    return this._record(DIRECTION_TEXT_ID);
  }

  getKeySubjectBuildingOnMap() {
    this.markLocationOnMap = true;
    const answer = this._record(MAP_REVEAL_TEXT_ID);
    this.markLocationOnMap = false;
    return answer;
  }

  getKeySubjectBuildingHint() {
    const randomFloat = this._rolls()();
    if (randomFloat > CHANCE_TO_REVEAL_LOCATION_ON_MAP || (this.deps.isPlayerInside?.() ?? false)) {
      return this.getKeySubjectBuildingDirection();
    }
    return this.getKeySubjectBuildingOnMap();
  }

  /** GetKeySubjectPersonHint (:1725-1766) - THE DEAD KEY OVERRIDE
   *  kept, the key-subject backup/restore, and the residence
   *  fallback to the person's own home building. */
  getKeySubjectPersonHint() {
    const item = this.currentQuestionListItem;
    let key = item.key;
    // C# reassigns the SAME field behind a non-empty test - the
    // branch cannot change anything (:1729-1731)
    if (item.key !== '') key = item.key;
    const backupKeySubject = this.currentKeySubject;
    this.currentKeySubject = '';
    const person = this.deps.tree.getPersonResource(item.questID, key);
    let buildingKey;
    if (person.isQuestor) {
      buildingKey = this.deps.tree.getPersonBuildingKey(person);
    } else {
      const siteDetails = this.deps.tree.getPersonSiteDetails(person);
      buildingKey = siteDetails.buildingKey;
      this.currentKeySubject = siteDetails.buildingName;
    }
    if (!this.currentKeySubject || this.currentKeySubject === this._text('residence')) {
      this.currentKeySubject = person.homeBuildingName;
    }
    this.currentKeySubjectBuildingKey = buildingKey;
    this.markLocationOnMap = true;
    const answer = this.getKeySubjectBuildingHint();
    this.markLocationOnMap = false;
    this.currentKeySubject = backupKeySubject;
    return answer;
  }

  /** GetDialogHint (:1768-1776) - the anyInfo answers. */
  getDialogHint(listItem) {
    const info = this._resourceInfo(listItem);
    if (info) return this._answerFromTokensArray(listItem.questID, info.anyInfoAnswers);
    return this._text('resolvingError');
  }

  /** GetDialogHint2 (:1778-1793): the spymaster reads anyInfo where
   *  everyone else reads rumors (and NPCsKnowEverything deliberately
   *  does NOT apply here - C#'s own note); an empty rumors list
   *  falls back to anyInfo. */
  getDialogHint2(listItem) {
    const info = this._resourceInfo(listItem);
    if (!info) return this._text('resolvingError');
    let answers = this._session().isSpyMaster ? info.anyInfoAnswers : info.rumorsAnswers;
    if (answers == null || answers.length === 0) answers = info.anyInfoAnswers;
    return this._answerFromTokensArray(listItem.questID, answers);
  }

  _resourceInfo(listItem) {
    return this.deps.tree?.dictQuestInfo.get(listItem.questID)?.resourceInfo.get(listItem.key) ?? null;
  }

  /** GetAnswerFromTokensArray (:3545-3559): a random variant, CLONED
   *  before expansion so altering macros re-evaluate every time
   *  (C#'s own comment names %di and the Missing Prince quest). */
  _answerFromTokensArray(questID, answers) {
    if (!answers || answers.length === 0) return this._text('resolvingError');
    const randomNumAnswer = Math.floor(this._rolls()() * answers.length);
    const tokens = answers[randomNumAnswer].map((t) => ({ ...t }));
    return this.deps.expandQuestTokens?.(questID, tokens) ?? tokens.map((t) => t.text ?? '').join('');
  }

  // ---- the compass + the map mark (:1189-1296) ----

  /** GetKeySubjectLocationCompassDirection (:1189-1201) - THE COMPASS
   *  MARK: asking for directions stamps ReceivedDirectionalHints,
   *  but never downgrades a resource already marked on the map. */
  getKeySubjectLocationCompassDirection() {
    const info = this._resourceInfo(this.currentQuestionListItem ?? { questID: 0, key: '' });
    if (info && info.questPlaceResourceHintTypeReceived !== BUILDING_HINT_TYPE.LocationWasMarkedOnMap) {
      info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.ReceivedDirectionalHints;
    }
    return this.deps.buildingCompassDirection?.(this.currentKeySubjectBuildingKey) ?? this._text('resolvingError');
  }

  /** MarkKeySubjectLocationOnMap (:1283-1296): a buildingKey of 0
   *  marks nothing at all (the C# default-struct guard). */
  markKeySubjectLocationOnMap() {
    const tree = this.deps.tree;
    const buildingInfo = (tree?.listBuildings ?? []).find((x) => x.buildingKey === this.currentKeySubjectBuildingKey);
    if (buildingInfo && buildingInfo.buildingKey !== 0) {
      const info = this._resourceInfo(this.currentQuestionListItem ?? { questID: 0, key: '' });
      if (info) info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.LocationWasMarkedOnMap;
      this.deps.discoverBuilding?.(buildingInfo.buildingKey);
    }
  }
}

/** string.Format's {0}/{1} over the localized literals. */
function format(template, ...args) {
  return String(template ?? '').replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] ?? m));
}

/** A stand-in for C#'s string.GetHashCode() in the knowledge seed
 *  (Ledger A - the .NET hash is runtime-specific and explicitly NOT
 *  stable across processes, so any deterministic hash is as faithful;
 *  this is the classic FNV-ish walk the port uses elsewhere). */
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
