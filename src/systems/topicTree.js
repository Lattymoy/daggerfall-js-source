// THE TOPIC TREE (TK-ii) - TalkManager.cs's topic-list core (MIT,
// Daggerfall Workshop): the ListItem model (:127-173), the
// QuestResources/QuestResourceInfo bookkeeping (:285-339), the quest
// topic pipeline (:2064-2285 - AddQuestTopicWithInfoAndRumors both
// overloads, DialogLinkForQuestInfoResource,
// AddDialogForQuestInfoResource, RemoveQuestInfoTopicsForSpecificQuest,
// ForceTopicListsUpdate), the person/building lookups (:2287-2362),
// IsBuildingQuestResource (:2376-2421), the conversation-save halves
// this slice owns (:2426-2549's dictQuestInfo side), the assembly
// engine (:3086-3500 - the four assemblers with the regional-building
// adds), and the assembly's gate helpers (:2940-3083). This is the
// CONSUMER of the quest machine's addQuestTopics / dialogLink /
// addDialog / removeQuestInfoTopics / forceTopicListsUpdate hooks.
//
// KEPT QUIRKS, each by C# line:
//   - THE DISCARDED FIRST ADD (:2104-2115): AddQuestTopicWithInfoAndRumors
//     fetches-or-creates the QuestResources bag BEFORE the empty-name
//     bail, and writes dictQuestInfo only at the tail - an empty
//     resourceName on a NEW questID leaves NO entry behind.
//   - THE STICKY TELL-ME-ABOUT FLAG (:2135): hasEntryInTellMeAbout is
//     only ever SET - a re-add with null answers keeps a previous
//     true; hasEntryInWhereIs by contrast is written BOTH ways.
//   - THE MISNAMED THROWS (:2291-2333): the person lookups all throw
//     "GetBuildingKeyForPersonResource()..." literals, including the
//     null-symbol arm's copy-pasted "Resource is not of type Person
//     but was expected to be" - the wrong words ARE the words.
//   - THE SHARED GROUP VARIABLE (:3206-3352): AssembleTopicListLocation
//     threads ONE itemBuildingTypeGroup local through the type groups,
//     the quest General section and the palace arm - the palace arm
//     appends to whatever the variable last held when the General
//     section already exists, and its own creation branch never sets
//     alreadyCreatedGeneralSubSection (dead, it is the last use).
//   - dialogLink's unknown linked type LOGS AND RETURNS before the
//     hide (:2201-2203); a NotSet linked type falls THROUGH to hide.
//   - AddDialogForQuestInfoResource with a null resourceName SKIPS
//     the body but still runs the rebuild tail (:2235, :2270-2273).
//   - The caption null test (:3146) is a NULL test: an EMPTY-string
//     buildingName is taken as the caption, never the locationName.
//
// deps (host wires; absent members idle LOUDLY per the charter):
//   getQuest(questID)          - the machine's live lookup
//   getAllActiveQuestIds()     - QuestMachine.GetAllActiveQuests
//   currentRegionIndex() / currentRegionName() / currentLocationName()
//   currentMapId() / currentLocationIndex()
//   isPlayerInside() / isPlayerInsideCastle()
//   currentBuildingKey()       - PlayerEnterExit.Interior.EntryDoor
//   getBuildingList()          - BuildingInfo[] {name, buildingType,
//                                buildingKey, position} for the
//                                CURRENT location (the T3c directory's
//                                shape; the C# questor-populate half
//                                of GetBuildingList is TK-iv's,
//                                recorded)
//   exteriorBuildings()        - [{factionId, buildingType}] | null
//                                (DoesBuildingExistLocally's rows;
//                                null = location not loaded)
//   factionName(id)            - the org captions
//   addOrReplaceQuestProgressRumor(questID, message) - the mill
//   undiscoverBuilding(buildingKey, buildingName) - PlayerGPS
//   talkPartner()              - { isStatic, nameNPC, buildingKey } |
//                                null (the TK-iv NPC session; absent =
//                                the same-person checks read false)
//   onTopicListsUpdated()      - DaggerfallUI.TalkWindow
//                                .UpdateListboxTopic (the instant tail)

import { BUILDING_TYPES, isResidence } from '../world/buildingNames.js';

/** ListItemType (:128-133). */
export const LIST_ITEM_TYPE = Object.freeze({ Item: 0, ItemGroup: 1, NavigationBack: 2 });

/** QuestionType (:135-149). */
export const QUESTION_TYPE = Object.freeze({
  NoQuestion: 0, News: 1, WhereAmI: 2, OrganizationInfo: 3, Work: 4,
  LocalBuilding: 5, Regional: 6, Person: 7, Thing: 8,
  QuestLocation: 9, QuestPerson: 10, QuestItem: 11,
});

/** NPCKnowledgeAboutItem (:151-156). */
export const NPC_KNOWLEDGE = Object.freeze({ NotSet: 0, DoesNotKnowAboutItem: 1, KnowsAboutItem: 2 });

/** QuestInfoResourceType (:285-291). */
export const QUEST_INFO_RESOURCE_TYPE = Object.freeze({ NotSet: 0, Location: 1, Person: 2, Thing: 3 });

/** QuestResourceInfo.BuildingLocationHintTypeGiven (:297-302). */
export const BUILDING_HINT_TYPE = Object.freeze({ None: 0, ReceivedDirectionalHints: 1, LocationWasMarkedOnMap: 2 });

/** infoFactionIDs (:378) - the 34 "tell me about" organizations. */
export const INFO_FACTION_IDS = Object.freeze([
  42, 40, 108, 129, 306, 353, 41, 67, 82, 84, 88, 92, 94, 106, 36, 83,
  85, 89, 93, 95, 99, 107, 37, 368, 408, 409, 410, 411, 413, 414, 415, 416, 417, 98,
]);

/** FactionsAndBuildings (:277-278): 8 temples, 10 knightly orders,
 *  MG + FG, 10 store building TYPES. */
export const FACTIONS_AND_BUILDINGS = Object.freeze([
  0x1a, 0x15, 0x1d, 0x1b, 0x23, 0x18, 0x21, 0x16,
  0x19e, 0x170, 0x19d, 0x198, 0x19a, 0x19b, 0x199, 0x19f, 0x1a0, 0x1a1,
  0x28, 0x29,
  0x0f, 0x0a, 0x0d, 0x2, 0x0, 0x3, 0x5, 0x6, 0x8, 0xc,
]);

/** AddRegionalItems' KnightlyOrderRegions (:3358). */
export const KNIGHTLY_ORDER_REGIONS = Object.freeze([0x05, 0x11, 0x12, 0x14, 0x15, 0x16, 0x17, 0x2b, 0x33, 0x37]);

/** The 'buildingNames' localized list (Internal_Strings en id 63) -
 *  one caption per FactionsAndBuildings row. */
export const REGIONAL_BUILDING_NAMES = Object.freeze([
  'Temple of Akatosh', 'Temple of Arkay', 'Temple of Dibella', 'Temple of Julianos',
  'Temple of Kynareth', 'Temple of Mara', 'Temple of Stendarr', 'Temple of Zen',
  'Order of the Raven', 'Knights of the Dragon', 'Knights of the Owl', 'Order of the Candle',
  'Knights of the Flame', 'Host of the Horn', 'Knights of the Rose', 'Knights of the Wheel',
  'Order of the Scarab', 'Knights of the Hawk',
  'Mages Guild', 'Fighters Guild',
  'Tavern', 'Library', 'Weapon Smith', 'Armorer', 'Alchemist', 'Bank',
  'Bookstore', 'Clothing store', 'Gem store', 'Pawn shop',
]);

/** The topic captions (Internal_Strings en). */
export const EN = Object.freeze({
  anyNews: 'Any news?',
  whereAmI: 'Where am I?',
  previousList: 'Previous List',
  general: 'General',
  regional: 'Regional',
  any: 'Any %s',
});

/** BuildingTypeToGroupString (:2884-2917) over the en table. */
const GROUP_STRING_BY_TYPE = Object.freeze({
  [BUILDING_TYPES.Alchemist]: 'Alchemists',
  [BUILDING_TYPES.Armorer]: 'Armorers',
  [BUILDING_TYPES.Bank]: 'Banks',
  [BUILDING_TYPES.Bookseller]: 'Bookstores',
  [BUILDING_TYPES.ClothingStore]: 'Clothing stores',
  [BUILDING_TYPES.GemStore]: 'Gem stores',
  [BUILDING_TYPES.GeneralStore]: 'General stores',
  [BUILDING_TYPES.GuildHall]: 'Guilds',
  [BUILDING_TYPES.Library]: 'Libraries',
  [BUILDING_TYPES.PawnShop]: 'Pawn shops',
  [BUILDING_TYPES.Tavern]: 'Taverns',
  [BUILDING_TYPES.WeaponSmith]: 'Weapon smiths',
  [BUILDING_TYPES.Temple]: 'Local temples',
});
export const buildingTypeToGroupString = (buildingType) => GROUP_STRING_BY_TYPE[buildingType] ?? '';

/** CheckBuildingTypeInSkipList (:2919-2938) - the FULL 17-entry set
 *  (the T3c list omitted AllValid + Special1-4, which never appear in
 *  real building lists; this one is the verbatim predicate). */
const SKIP_LIST = new Set([
  BUILDING_TYPES.AllValid, BUILDING_TYPES.FurnitureStore,
  BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3,
  BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.House6,
  BUILDING_TYPES.HouseForSale, BUILDING_TYPES.Palace, BUILDING_TYPES.Ship,
  BUILDING_TYPES.Special1, BUILDING_TYPES.Special2, BUILDING_TYPES.Special3,
  BUILDING_TYPES.Special4, BUILDING_TYPES.Town23, BUILDING_TYPES.Town4,
]);
export const checkBuildingTypeInSkipList = (buildingType) => SKIP_LIST.has(buildingType);

/** A ListItem with the C# field defaults (:159-173). */
export const newListItem = (over = {}) => ({
  type: LIST_ITEM_TYPE.Item,
  caption: 'undefined',
  key: '',
  factionID: -1,
  questionType: QUESTION_TYPE.NoQuestion,
  npcKnowledgeAboutItem: NPC_KNOWLEDGE.NotSet,
  buildingKey: -1,
  npcInSameBuildingAsTopic: false,
  questID: 0,
  index: -1,
  listChildItems: null,
  listParentItems: null,
  ...over,
});

/** A QuestResourceInfo with the constructor defaults (:304-316). */
export const newQuestResourceInfo = () => ({
  resourceType: QUEST_INFO_RESOURCE_TYPE.NotSet,
  anyInfoAnswers: null,
  rumorsAnswers: null,
  availableForDialog: true,
  hasEntryInTellMeAbout: false,
  hasEntryInWhereIs: false,
  questPlaceResourceHintTypeReceived: BUILDING_HINT_TYPE.None,
  dialogLinkedLocations: [],
  dialogLinkedPersons: [],
  dialogLinkedThings: [],
  questResource: null,
});

/** GetQuestInfoResourceType (:2087-2099) over the port's is-flags. */
export function getQuestInfoResourceType(questResource) {
  if (questResource?.isPerson) return QUEST_INFO_RESOURCE_TYPE.Person;
  if (questResource?.isPlace) return QUEST_INFO_RESOURCE_TYPE.Location;
  if (questResource?.isItem) return QUEST_INFO_RESOURCE_TYPE.Thing;
  return QUEST_INFO_RESOURCE_TYPE.NotSet;
}

export class TopicTree {
  constructor(deps = {}) {
    this.deps = deps;
    // dictQuestInfo (:339): questID -> { resourceInfo: Map<name, info> }
    this.dictQuestInfo = new Map();
    this.listTopicTellMeAbout = [];
    this.listTopicLocation = [];
    this.listTopicPerson = [];
    this.listTopicThing = [];
    this.listBuildings = null;   // BuildingInfo[] | null (lazy, GetBuildingList)
    this.rebuildTopicLists = true;
    this.instantRebuildTopicListTellMeAbout = false;
    this.instantRebuildTopicListLocation = false;
    this.instantRebuildTopicListPerson = false;
    this.instantRebuildTopicListThing = false;
  }

  /** ForceTopicListsUpdate (:2064-2067). */
  forceTopicListsUpdate() { this.assembleTopicLists(); }

  /** AddQuestTopicWithInfoAndRumors(Quest) (:2069-2085): the
   *  RumorsDuringQuest progress rumor into the MILL, then a topic per
   *  resource off its info/rumors message ids. QuestMessages
   *  .RumorsDuringQuest = 1007. */
  addQuestTopicsForQuest(quest) {
    const message = quest.getMessage(1007);
    if (message != null) this.deps.addOrReplaceQuestProgressRumor?.(quest.uid, message);
    for (const resource of quest.resources.values()) {
      const type = getQuestInfoResourceType(resource);
      const anyInfoAnswers = resource.getMessage(resource.infoMessageID);
      const rumorsAnswers = resource.getMessage(resource.rumorsMessageID);
      this.addQuestTopicWithInfoAndRumors(quest.uid, resource, resource.symbol?.name, type, anyInfoAnswers, rumorsAnswers);
    }
  }

  /** AddQuestTopicWithInfoAndRumors (:2101-2158). */
  addQuestTopicWithInfoAndRumors(questID, questResource, resourceName, resourceType, anyInfoAnswers, rumorsAnswers) {
    // fetch-or-create BEFORE the name bail - THE DISCARDED FIRST ADD
    const questResources = this.dictQuestInfo.get(questID) ?? { resourceInfo: new Map() };
    if (resourceName == null || resourceName === '') return;
    const info = questResources.resourceInfo.get(resourceName) ?? newQuestResourceInfo();
    info.anyInfoAnswers = anyInfoAnswers;
    info.rumorsAnswers = rumorsAnswers;
    info.resourceType = resourceType;
    // THE STICKY FLAG: only ever set, never cleared here
    if (info.anyInfoAnswers != null || info.rumorsAnswers != null) info.hasEntryInTellMeAbout = true;
    info.hasEntryInWhereIs = resourceType === QUEST_INFO_RESOURCE_TYPE.Person || resourceType === QUEST_INFO_RESOURCE_TYPE.Location;
    info.questResource = questResource;
    questResources.resourceInfo.set(resourceName, info);
    this.dictQuestInfo.set(questID, questResources);
    if (info.resourceType === QUEST_INFO_RESOURCE_TYPE.Location) {
      this.undiscoverQuestResidence(questID, resourceName, info);
    }
    this.rebuildTopicLists = true;
  }

  /** DialogLinkForQuestInfoResource (:2160-2220). */
  dialogLinkForQuestInfoResource(questID, resourceName, resourceType, linkedResourceName = null, linkedResourceType = QUEST_INFO_RESOURCE_TYPE.NotSet) {
    void resourceType;   // C# takes it and never reads it
    const questResources = this.dictQuestInfo.get(questID);
    if (!questResources) {
      console.log(`AddDialogLinkForQuestInfoResource() could not find quest with questID ${questID}`);
      return;
    }
    const questResource = questResources.resourceInfo.get(resourceName);
    if (!questResource) {
      console.log(`AddDialogLinkForQuestInfoResource() could not find a quest info resource with name ${resourceName}`);
      return;
    }
    switch (linkedResourceType) {
      case QUEST_INFO_RESOURCE_TYPE.NotSet:
        break;   // no linked entry, but the hide below still lands
      case QUEST_INFO_RESOURCE_TYPE.Location:
        if (!questResource.dialogLinkedLocations.includes(linkedResourceName)) questResource.dialogLinkedLocations.push(linkedResourceName);
        break;
      case QUEST_INFO_RESOURCE_TYPE.Person:
        if (!questResource.dialogLinkedPersons.includes(linkedResourceName)) questResource.dialogLinkedPersons.push(linkedResourceName);
        break;
      case QUEST_INFO_RESOURCE_TYPE.Thing:
        if (!questResource.dialogLinkedThings.includes(linkedResourceName)) questResource.dialogLinkedThings.push(linkedResourceName);
        break;
      default:
        console.log('AddDialogLinkForQuestInfoResource(): unknown linked quest resource type');
        return;   // the unknown type returns BEFORE the hide
    }
    questResource.availableForDialog = false;
    if (linkedResourceName != null) {
      const linked = questResources.resourceInfo.get(linkedResourceName);
      if (linked) linked.availableForDialog = false;
      else console.log('AddDialogLinkForQuestInfoResource(): linked quest resource not found');
    }
    // ONLY the tell-me-about list rebuilds here (:2219)
    this.assembleTopiclistTellMeAbout();
  }

  /** AddDialogForQuestInfoResource (:2222-2274). */
  addDialogForQuestInfoResource(questID, resourceName, resourceType, instantRebuildTopicLists = true) {
    void resourceType;   // C# takes it and never reads it
    const questResources = this.dictQuestInfo.get(questID);
    if (!questResources) {
      console.log(`AddDialogLinkForQuestInfoResource() could not find quest with questID ${questID}`);
      return;
    }
    if (resourceName != null) {
      const info = questResources.resourceInfo.get(resourceName);
      if (!info) {
        console.log(`AddDialogLinkForQuestInfoResource() could not find a quest info resource with name ${resourceName}`);
        return;
      }
      info.availableForDialog = true;
      if (info.hasEntryInTellMeAbout) this.instantRebuildTopicListTellMeAbout = true;
      if (info.resourceType === QUEST_INFO_RESOURCE_TYPE.Location) this.instantRebuildTopicListLocation = true;
      else if (info.resourceType === QUEST_INFO_RESOURCE_TYPE.Person) this.instantRebuildTopicListPerson = true;
      else if (info.resourceType === QUEST_INFO_RESOURCE_TYPE.Thing) this.instantRebuildTopicListThing = true;
    }
    // a null resourceName SKIPS the body but still rebuilds (:2270)
    if (instantRebuildTopicLists) this.assembleTopicLists(true);
    else this.rebuildTopicLists = true;
  }

  /** RemoveQuestInfoTopicsForSpecificQuest (:2276-2285). */
  removeQuestInfoTopicsForSpecificQuest(questID) {
    this.dictQuestInfo.delete(questID);
    this.rebuildTopicLists = true;
  }

  // ---- the person/building lookups (:2287-2362) ----

  /** GetPersonResource (:2287-2313) - THE MISNAMED THROWS verbatim. */
  getPersonResource(questID, resourceName) {
    const questResources = this.dictQuestInfo.get(questID);
    if (!questResources) throw new Error(`GetBuildingKeyForPersonResource(): Could not find quest with questID ${questID}`);
    if (resourceName == null || resourceName === '') throw new Error('GetBuildingKeyForPersonResource(): No valid resourceName was provided.');
    const info = questResources.resourceInfo.get(resourceName);
    if (!info) throw new Error(`GetBuildingKeyForPersonResource(): Could not find resource with resourceName ${resourceName} for quest with questID ${questID}`);
    if (info.resourceType !== QUEST_INFO_RESOURCE_TYPE.Person) throw new Error('GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be');
    return info.questResource;
  }

  /** GetPersonBuildingKey (:2315-2338): a questor's stored key, else
   *  the home building looked up by NAME (a miss reads the C# default
   *  struct's 0); a non-questor through the assigned Place. */
  getPersonBuildingKey(person) {
    if (person.isQuestor) {
      if (person.questorData.buildingKey !== 0) return person.questorData.buildingKey;
      const found = (this.listBuildings ?? []).find((x) => x.name === person.homeBuildingName);
      return found?.buildingKey ?? 0;
    }
    const assignedPlaceSymbol = person.getAssignedPlaceSymbol();
    if (assignedPlaceSymbol == null) throw new Error('GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be');
    return person.parentQuest.getPlace(assignedPlaceSymbol).siteDetails.buildingKey;
  }

  /** GetPersonSiteDetails (:2340-2349). */
  getPersonSiteDetails(person) {
    const assignedPlaceSymbol = person.getAssignedPlaceSymbol();
    if (assignedPlaceSymbol == null) throw new Error('GetBuildingKeyForPersonResource(): Resource is not of type Person but was expected to be');
    return person.parentQuest.getPlace(assignedPlaceSymbol).siteDetails;
  }

  /** GetBuildingTypeForBuildingKey (:2352-2362). */
  getBuildingTypeForBuildingKey(buildingKey) {
    if (this.listBuildings == null) this.getBuildingList();
    const matching = this.listBuildings.filter((x) => x.buildingKey === buildingKey);
    if (matching.length === 0) throw new Error('GetBuildingTypeForBuildingKey(): No building with the queried key found');
    if (matching.length > 1) throw new Error('GetBuildingTypeForBuildingKey(): More than one building with the queried key found');
    return matching[0].buildingType;
  }

  /** GetBuildingNameForBuildingKey (:2364-2374's shape - the same
   *  walk answering the name; a miss answers the empty string). */
  getBuildingNameForBuildingKey(buildingKey) {
    if (this.listBuildings == null) this.getBuildingList();
    const matching = this.listBuildings.filter((x) => x.buildingKey === buildingKey);
    return matching.length === 1 ? matching[0].name : '';
  }

  /** IsBuildingQuestResource (:2376-2421): the automap's override
   *  name + the pc-knowledge flags for a quest-residence building.
   *  Answers { isQuestResource, overrideBuildingName,
   *  pcLearnedAboutExistence, receivedDirectionalHints,
   *  locationWasMarkedOnMapByNPC }. */
  isBuildingQuestResource(mapID, buildingKey) {
    const out = {
      isQuestResource: false, overrideBuildingName: '',
      pcLearnedAboutExistence: false, receivedDirectionalHints: false, locationWasMarkedOnMapByNPC: false,
    };
    for (const questID of this.deps.getAllActiveQuestIds?.() ?? []) {
      const quest = this.deps.getQuest?.(questID);
      const questInfo = this.dictQuestInfo.get(questID);
      if (!quest || !questInfo) continue;
      for (const resource of quest.resources.values()) {
        if (!resource.isPlace) continue;
        const key = resource.symbol?.name;
        if (resource.siteDetails.mapId !== mapID || resource.siteDetails.buildingKey !== buildingKey) continue;
        const info = questInfo.resourceInfo.get(key);
        if (info) {
          if (info.availableForDialog) out.pcLearnedAboutExistence = true;
          if (info.questPlaceResourceHintTypeReceived >= BUILDING_HINT_TYPE.ReceivedDirectionalHints) out.receivedDirectionalHints = true;
          if (info.questPlaceResourceHintTypeReceived === BUILDING_HINT_TYPE.LocationWasMarkedOnMap) out.locationWasMarkedOnMapByNPC = true;
          out.overrideBuildingName = resource.siteDetails.buildingName;
          out.isQuestResource = true;
          return out;
        }
      }
    }
    return out;
  }

  // ---- the assembly gates (:2940-3083) ----

  /** UndiscoverQuestResidence (:2940-2961): every Place of the quest
   *  whose symbol matches undiscovers its building. */
  undiscoverQuestResidence(questID, resourceName, questResourceInfo) {
    const quest = this.deps.getQuest?.(questID);
    if (!quest) return;
    if (questResourceInfo.resourceType !== QUEST_INFO_RESOURCE_TYPE.Location) return;
    for (const resource of quest.resources.values()) {
      if (!resource.isPlace) continue;
      if (resource.symbol?.name !== resourceName) continue;
      this.deps.undiscoverBuilding?.(resource.siteDetails.buildingKey, resource.siteDetails.buildingName);
    }
  }

  /** ResetNPCKnowledgeInTopicListRecursively (:2963-2975). */
  resetNPCKnowledgeInTopicListRecursively(list) {
    if (list == null) return;
    for (const item of list) {
      item.npcKnowledgeAboutItem = NPC_KNOWLEDGE.NotSet;
      item.npcInSameBuildingAsTopic = false;
      if (item.type === LIST_ITEM_TYPE.ItemGroup && item.listChildItems != null) {
        this.resetNPCKnowledgeInTopicListRecursively(item.listChildItems);
      }
    }
  }

  /** GetBuildingInfoCurrentBuildingOrPalace (:2977-2993). */
  getBuildingInfoCurrentBuildingOrPalace() {
    if (this.deps.isPlayerInsideBuilding?.() ?? false) {
      return (this.listBuildings ?? []).find((x) => x.buildingKey === (this.deps.currentBuildingKey?.() ?? -1));
    }
    // a castle resolves via its building TYPE - one palace per location
    return (this.listBuildings ?? []).find((x) => x.buildingType === BUILDING_TYPES.Palace);
  }

  /** CheckNPCcanKnowAboutTellMeAboutTopic (:2995-3016). */
  checkNPCcanKnowAboutTellMeAboutTopic(item) {
    const quest = this.deps.getQuest?.(item.questID);
    if (item.questionType === QUESTION_TYPE.QuestLocation) {
      const place = quest.getResource({ name: item.key });
      if (place.siteDetails.regionName !== (this.deps.currentRegionName?.() ?? '')) return false;
    } else if (item.questionType === QUESTION_TYPE.QuestPerson) {
      const person = quest.getResource({ name: item.key });
      if (person.homeRegionIndex !== -1 && person.homeRegionName !== (this.deps.currentRegionName?.() ?? '')) return false;
    }
    return true;
  }

  /** CheckNPCisInSameBuildingAsTopic (:3018-3083) - the first gate's
   *  C# precedence kept (`!inside || a && b && c && d`). */
  checkNPCisInSameBuildingAsTopic(item) {
    if (!(this.deps.isPlayerInside?.() ?? false)
      || (item.questionType !== QUESTION_TYPE.LocalBuilding && item.questionType !== QUESTION_TYPE.Person
        && item.questionType !== QUESTION_TYPE.QuestPerson && item.questionType !== QUESTION_TYPE.QuestLocation)) {
      return false;
    }
    const buildingInfoCurrentBuilding = this.getBuildingInfoCurrentBuildingOrPalace();
    if (item.questionType === QUESTION_TYPE.LocalBuilding) {
      if (buildingInfoCurrentBuilding && item.buildingKey === buildingInfoCurrentBuilding.buildingKey) {
        item.npcInSameBuildingAsTopic = true;
        return true;
      }
      return false;
    }
    const quest = this.deps.getQuest?.(item.questID);
    const questResource = quest.getResource({ name: item.key });
    let person = null;
    let assignedPlaceSymbol = null;
    let place = null;
    if (questResource?.isPerson) {
      person = questResource;
      assignedPlaceSymbol = person.getAssignedPlaceSymbol();
    }
    if (assignedPlaceSymbol != null) place = quest.getPlace(assignedPlaceSymbol);
    else if (person != null) place = person.getHomePlace();
    // some individuals (The Underking) have no assigned place
    if (place == null) return false;
    if (place.siteDetails.regionName !== (this.deps.currentRegionName?.() ?? '')) return false;
    if (place.siteDetails.locationName !== (this.deps.currentLocationName?.() ?? '')) return false;
    if (place.siteDetails.buildingKey !== 0) {
      // building key can be 0 for palaces - only compare it when set
      if (!buildingInfoCurrentBuilding || place.siteDetails.buildingKey !== buildingInfoCurrentBuilding.buildingKey) return false;
    } else if (!buildingInfoCurrentBuilding || place.siteDetails.buildingName !== buildingInfoCurrentBuilding.name) {
      return false;
    }
    item.npcInSameBuildingAsTopic = true;
    return true;
  }

  // ---- the assembly engine (:3086-3500) ----

  /** GetBuildingList (:2752-2882)'s building half through the host
   *  seam (the questor-populate half is TK-iv's, recorded). */
  getBuildingList() {
    this.listBuildings = this.deps.getBuildingList?.() ?? [];
  }

  /** AssembleTopicLists (:3086-3111). */
  assembleTopicLists(isInstantRebuild = false) {
    if (!isInstantRebuild) {
      this.assembleTopiclistTellMeAbout();
      this.assembleTopicListLocation();
      this.assembleTopicListPerson();
      this.assembleTopicListThing();
    } else {
      if (this.instantRebuildTopicListTellMeAbout) this.assembleTopiclistTellMeAbout();
      if (this.instantRebuildTopicListLocation) this.assembleTopicListLocation();
      if (this.instantRebuildTopicListPerson) this.assembleTopicListPerson();
      if (this.instantRebuildTopicListThing) this.assembleTopicListThing();
      this.instantRebuildTopicListTellMeAbout = false;
      this.instantRebuildTopicListLocation = false;
      this.instantRebuildTopicListPerson = false;
      this.instantRebuildTopicListThing = false;
      this.deps.onTopicListsUpdated?.();
    }
  }

  /** The same-person test both TellMeAbout and Person share
   *  (:3158-3167, :3449-3458): the dialog partner IS the person
   *  resource - inside the same building, or a castle questor whose
   *  QuestorData context is the dungeon. */
  _dialogPartnerIsSamePerson(person, captionString) {
    const partner = this.deps.talkPartner?.() ?? null;
    if (!partner || !partner.isStatic || partner.nameNPC !== captionString) return false;
    const inside = this.deps.isPlayerInside?.() ?? false;
    const insideCastle = this.deps.isPlayerInsideCastle?.() ?? false;
    return (inside && !insideCastle && partner.buildingKey === (this.deps.currentBuildingKey?.() ?? -1))
      || (insideCastle && person.isQuestor && (person.questorData?.context ?? null) === 'dungeon');
  }

  /** AssembleTopiclistTellMeAbout (:3113-3198). */
  assembleTopiclistTellMeAbout() {
    this.listTopicTellMeAbout = [];
    this.listTopicTellMeAbout.push(newListItem({ questionType: QUESTION_TYPE.News, caption: EN.anyNews }));
    this.listTopicTellMeAbout.push(newListItem({ questionType: QUESTION_TYPE.WhereAmI, caption: EN.whereAmI }));
    for (const [questID, questInfo] of this.dictQuestInfo) {
      for (const [resourceName, info] of questInfo.resourceInfo) {
        const itemQuestTopic = newListItem({});
        let captionString = '';
        let dialogPartnerIsSamePersonAsPersonResource = false;
        switch (info.resourceType) {
          default:
          case QUEST_INFO_RESOURCE_TYPE.NotSet:
            itemQuestTopic.questionType = QUESTION_TYPE.NoQuestion;
            break;
          case QUEST_INFO_RESOURCE_TYPE.Location: {
            itemQuestTopic.questionType = QUESTION_TYPE.QuestLocation;
            const place = info.questResource;
            // a NULL test: an empty buildingName is still the caption
            captionString = place.siteDetails.buildingName != null ? place.siteDetails.buildingName : place.siteDetails.locationName;
            break;
          }
          case QUEST_INFO_RESOURCE_TYPE.Person: {
            itemQuestTopic.questionType = QUESTION_TYPE.QuestPerson;
            const person = info.questResource;
            captionString = person.displayName;
            dialogPartnerIsSamePersonAsPersonResource = this._dialogPartnerIsSamePerson(person, captionString);
            break;
          }
          case QUEST_INFO_RESOURCE_TYPE.Thing: {
            itemQuestTopic.questionType = QUESTION_TYPE.QuestItem;
            const item = info.questResource;
            if (item != null && item.daggerfallUnityItem != null) captionString = item.daggerfallUnityItem.name;
            break;
          }
        }
        itemQuestTopic.questID = questID;
        itemQuestTopic.caption = captionString;
        itemQuestTopic.key = resourceName;
        if (info.availableForDialog && info.hasEntryInTellMeAbout && !dialogPartnerIsSamePersonAsPersonResource) {
          this.listTopicTellMeAbout.push(itemQuestTopic);
        }
      }
    }
    for (let i = 0; i < INFO_FACTION_IDS.length; i++) {
      this.listTopicTellMeAbout.push(newListItem({
        questionType: QUESTION_TYPE.OrganizationInfo,
        factionID: INFO_FACTION_IDS[i],
        caption: this.deps.factionName?.(INFO_FACTION_IDS[i]) ?? '',
        index: i,
      }));
    }
  }

  _newBackItem() {
    return newListItem({ type: LIST_ITEM_TYPE.NavigationBack, caption: EN.previousList, listParentItems: this.listTopicLocation });
  }

  /** AssembleTopicListLocation (:3200-3353) - THE SHARED GROUP
   *  VARIABLE's flow kept whole. */
  assembleTopicListLocation() {
    this.listTopicLocation = [];
    this.getBuildingList();
    let itemBuildingTypeGroup = null;
    // the type groups, in enum order, behind the skip list
    for (const buildingType of Object.values(BUILDING_TYPES)) {
      const matchingBuildings = this.listBuildings.filter((x) => x.buildingType === buildingType);
      if (checkBuildingTypeInSkipList(buildingType)) continue;
      if (matchingBuildings.length > 0) {
        itemBuildingTypeGroup = newListItem({
          type: LIST_ITEM_TYPE.ItemGroup,
          caption: buildingTypeToGroupString(buildingType),
          listChildItems: [],
        });
        itemBuildingTypeGroup.listChildItems.push(this._newBackItem());
        for (const buildingInfo of matchingBuildings) {
          itemBuildingTypeGroup.listChildItems.push(newListItem({
            questionType: QUESTION_TYPE.LocalBuilding,
            caption: buildingInfo.name,
            buildingKey: buildingInfo.buildingKey,
          }));
        }
        this.listTopicLocation.push(itemBuildingTypeGroup);
      }
    }
    // the quest-residence General section
    let alreadyCreatedGeneralSubSection = false;
    for (const [questID, questInfo] of this.dictQuestInfo) {
      for (const [resourceName, info] of questInfo.resourceInfo) {
        if (info.resourceType !== QUEST_INFO_RESOURCE_TYPE.Location) continue;
        const place = info.questResource;
        // only build entries for places in the PC's own location
        if ((this.deps.currentMapId?.() ?? 0) !== place.siteDetails.mapId) continue;
        if (place.siteDetails.buildingKey === 0) continue;
        let buildingType;
        try {
          buildingType = this.getBuildingTypeForBuildingKey(place.siteDetails.buildingKey);
        } catch (ex) {
          console.error(`Error in TalkManager.GetBuildingTypeForBuildingKey: ${ex.message}`);
          continue;
        }
        if (!isResidence(buildingType)) continue;
        const item = newListItem({
          questionType: QUESTION_TYPE.LocalBuilding,
          questID,
          caption: place.siteDetails.buildingName,
          buildingKey: place.siteDetails.buildingKey,
          key: resourceName,
        });
        if (info.availableForDialog && info.hasEntryInWhereIs) {
          if (!alreadyCreatedGeneralSubSection) {
            itemBuildingTypeGroup = newListItem({ type: LIST_ITEM_TYPE.ItemGroup, caption: EN.general });
            this.listTopicLocation.push(itemBuildingTypeGroup);
            alreadyCreatedGeneralSubSection = true;
          }
          if (itemBuildingTypeGroup.listChildItems == null) {
            itemBuildingTypeGroup.listChildItems = [this._newBackItem()];
          }
          itemBuildingTypeGroup.listChildItems.push(item);
        }
      }
    }
    // the palace arm rides the SAME group variable
    const palaces = this.listBuildings.filter((x) => x.buildingType === BUILDING_TYPES.Palace);
    if (palaces.length > 0) {
      if (!alreadyCreatedGeneralSubSection) {
        // C# never sets the flag here - dead, it is the last use
        itemBuildingTypeGroup = newListItem({ type: LIST_ITEM_TYPE.ItemGroup, caption: EN.general });
        this.listTopicLocation.push(itemBuildingTypeGroup);
      }
      if (itemBuildingTypeGroup.listChildItems == null) {
        itemBuildingTypeGroup.listChildItems = [this._newBackItem()];
      }
      for (const buildingInfo of palaces) {
        itemBuildingTypeGroup.listChildItems.push(newListItem({
          questionType: QUESTION_TYPE.LocalBuilding,
          caption: buildingInfo.name,
          buildingKey: buildingInfo.buildingKey,
        }));
      }
    }
    // the Regional group, always
    itemBuildingTypeGroup = newListItem({ type: LIST_ITEM_TYPE.ItemGroup, caption: EN.regional, listChildItems: [] });
    itemBuildingTypeGroup.listChildItems.push(this._newBackItem());
    this.addRegionalItems(itemBuildingTypeGroup);
    this.listTopicLocation.push(itemBuildingTypeGroup);
  }

  /** AddRegionalItems (:3355-3377): rows 8-17 are the knightly orders
   *  gated on their region, rows 20+ are stores searched by TYPE,
   *  everything else (the temples AND rows 18/19 - the code is the
   *  law) searches by FACTION. */
  addRegionalItems(itemBuildingTypeGroup) {
    const playerRegion = this.deps.currentRegionIndex?.() ?? -1;
    for (let i = 0; i < FACTIONS_AND_BUILDINGS.length; i++) {
      if (i >= 8 && i <= 17) {
        if (playerRegion === KNIGHTLY_ORDER_REGIONS[i - 8] && !this.doesBuildingExistLocally(FACTIONS_AND_BUILDINGS[i], false)) {
          this.addRegionalBuildingTalkItem(i, itemBuildingTypeGroup);
        }
      } else if (i >= 20) {
        if (!this.doesBuildingExistLocally(FACTIONS_AND_BUILDINGS[i], true)) {
          this.addRegionalBuildingTalkItem(i, itemBuildingTypeGroup);
        }
      } else if (!this.doesBuildingExistLocally(FACTIONS_AND_BUILDINGS[i], false)) {
        this.addRegionalBuildingTalkItem(i, itemBuildingTypeGroup);
      }
    }
  }

  /** DoesBuildingExistLocally (:3379-3398). */
  doesBuildingExistLocally(searchedFor, searchByBuildingType) {
    const buildings = this.deps.exteriorBuildings?.() ?? null;
    if (buildings == null) return false;   // location not loaded
    for (const building of buildings) {
      if (searchByBuildingType) {
        if (building.buildingType === searchedFor) return true;
      } else if (building.factionId === searchedFor) return true;
    }
    return false;
  }

  /** AddRegionalBuildingTalkItem (:3400-3414). */
  addRegionalBuildingTalkItem(index, itemBuildingTypeGroup) {
    if (index < 0 || index > REGIONAL_BUILDING_NAMES.length - 1) {
      throw new Error('buildingNames array text not found or idex out of range.');
    }
    itemBuildingTypeGroup.listChildItems.push(newListItem({
      questionType: QUESTION_TYPE.Regional,
      caption: EN.any.replace('%s', REGIONAL_BUILDING_NAMES[index]),
      index,
    }));
  }

  /** AssembleTopicListPerson (:3416-3494). */
  assembleTopicListPerson() {
    this.listTopicPerson = [];
    for (const [questID, questInfo] of this.dictQuestInfo) {
      for (const [resourceName, info] of questInfo.resourceInfo) {
        if (info.resourceType !== QUEST_INFO_RESOURCE_TYPE.Person) continue;
        const person = info.questResource;
        const item = newListItem({
          questionType: QUESTION_TYPE.Person,
          questID,
          caption: person.displayName,
          key: resourceName,
        });
        let isPlayerInSameLocationWorldCell = false;
        let dialogPartnerIsSamePersonAsPersonResource = false;
        if (person.isQuestor) {
          if (person.questorData.mapID === (this.deps.currentMapId?.() ?? 0)) isPlayerInSameLocationWorldCell = true;
          dialogPartnerIsSamePersonAsPersonResource = this._dialogPartnerIsSamePerson(person, person.displayName);
        } else {
          const assignedPlaceSymbol = person.getAssignedPlaceSymbol();
          if (assignedPlaceSymbol != null) {
            const quest = this.deps.getQuest?.(questID);
            const assignedPlace = quest.getPlace(assignedPlaceSymbol);
            if (assignedPlace.siteDetails.mapId === (this.deps.currentMapId?.() ?? 0)) isPlayerInSameLocationWorldCell = true;
          }
        }
        if (!dialogPartnerIsSamePersonAsPersonResource
          && info.availableForDialog
          && info.hasEntryInWhereIs
          && isPlayerInSameLocationWorldCell) {
          this.listTopicPerson.push(item);
        }
      }
    }
  }

  /** AssembleTopicListThing (:3496-3500): empty, as classic never
   *  implemented it either. */
  assembleTopicListThing() {
    this.listTopicThing = [];
  }

  // ---- the SaveDataConversation halves this slice owns ----

  /** dictQuestInfo as plain data. DEPARTURE (Ledger A shape): C#
   *  serializes the live questResource references and then OVERWRITES
   *  them all in the relink on load - dead weight the port drops;
   *  everything else travels verbatim (the answer token lists
   *  included). */
  getSaveData() {
    return {
      dictQuestInfo: [...this.dictQuestInfo.entries()].map(([questID, questResources]) => ({
        questID,
        resourceInfo: [...questResources.resourceInfo.entries()].map(([name, info]) => ({
          name,
          resourceType: info.resourceType,
          anyInfoAnswers: structuredClone(info.anyInfoAnswers),
          rumorsAnswers: structuredClone(info.rumorsAnswers),
          availableForDialog: info.availableForDialog,
          hasEntryInTellMeAbout: info.hasEntryInTellMeAbout,
          hasEntryInWhereIs: info.hasEntryInWhereIs,
          questPlaceResourceHintTypeReceived: info.questPlaceResourceHintTypeReceived,
          dialogLinkedLocations: [...info.dialogLinkedLocations],
          dialogLinkedPersons: [...info.dialogLinkedPersons],
          dialogLinkedThings: [...info.dialogLinkedThings],
        })),
      })),
    };
  }

  /** RestoreConversationData's dictQuestInfo half (:2445-2513): the
   *  orphan sweep against the live machine, then the three-type
   *  questResource RELINK, then the TellMeAbout rebuild tail
   *  (:2548). */
  restoreSaveData(data) {
    this.dictQuestInfo = new Map();
    for (const row of data?.dictQuestInfo ?? []) {
      const resourceInfo = new Map();
      for (const r of row.resourceInfo ?? []) {
        resourceInfo.set(r.name, {
          ...newQuestResourceInfo(),
          resourceType: r.resourceType,
          anyInfoAnswers: structuredClone(r.anyInfoAnswers),
          rumorsAnswers: structuredClone(r.rumorsAnswers),
          availableForDialog: r.availableForDialog,
          hasEntryInTellMeAbout: r.hasEntryInTellMeAbout,
          hasEntryInWhereIs: r.hasEntryInWhereIs,
          questPlaceResourceHintTypeReceived: r.questPlaceResourceHintTypeReceived,
          dialogLinkedLocations: [...(r.dialogLinkedLocations ?? [])],
          dialogLinkedPersons: [...(r.dialogLinkedPersons ?? [])],
          dialogLinkedThings: [...(r.dialogLinkedThings ?? [])],
        });
      }
      this.dictQuestInfo.set(row.questID, { resourceInfo });
    }
    // the orphan sweep (:2452-2464)
    for (const questID of [...this.dictQuestInfo.keys()]) {
      if (!this.deps.getQuest?.(questID)) {
        console.log(`Save data contains orphaned quest info for quest with id ${questID}. Removing these entries...`);
        this.dictQuestInfo.delete(questID);
      }
    }
    // the relink (:2467-2513): every Person/Place/Item resource whose
    // symbol matches re-couples to the live object
    for (const [questID, questInfo] of this.dictQuestInfo) {
      const quest = this.deps.getQuest?.(questID);
      if (!quest) continue;
      for (const resource of quest.resources.values()) {
        if (!resource.isPerson && !resource.isPlace && !resource.isItem) continue;
        const info = questInfo.resourceInfo.get(resource.symbol?.name);
        if (info) info.questResource = resource;
      }
    }
    this.assembleTopiclistTellMeAbout();
  }
}
