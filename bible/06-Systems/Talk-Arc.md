# The Talk Arc - TalkManager whole

STARTED 2026-08-21, straight off the quest arc's merge (PR #75). The
quest machine now PRODUCES rumors, dialog links, quest topics and
questor-post messages into seams nothing reads - a running quest is
invisible in conversation. This arc ports TalkManager.cs (3,736
lines) 1:1 on the quest arc's rhythm: scout -> port -> law pins with
DFU literals -> adversarial main-loop parity re-read -> single-
instance mutation campaign with baseline-aware confirmation -> bible
-> ship.

## What the port already carries (the T3 series, World lane)

- `systems/talk.js` - findFactions / getPeopleOfCurrentRegion /
  GetReactionToPlayer / pickpocket (T3a).
- `systems/talkTopics.js` - the Where-is BUILDING half: the named-
  building pool merge, MakeBuildingKey, the knowledge roll
  (KNOWLEDGE_MODIFIERS whole), the skip list, the compass hint, the
  30-record answersToDirections table, GetReactionToPlayer_0_1_2
  (T3c/T3e/T3f + T4's %hnt map-reveal fork).
- `systems/talkSession.js` - the mobile greeting ladder (7206-7209,
  the 7205 refusal at reaction < -20), oaths, %-macro helpers.
- `scenes/townTalk.js` - the session host: F1-F4 modes, the tone
  cycle with the session reaction cache, the Where-is chain, the
  native TALK01I0 window (U8b), the per-pixel directory swap (T3d).

Everything else in TalkManager.cs is UNPORTED - and the biggest
unported families are exactly the quest machine's consumers.

## The carve (five slices, engine-then-host like Q4)

- **TK-i - THE RUMOR MILL**: RumorMillEntry + the mill's whole
  lifecycle - SetupRumorMill, ImportClassicRumor over a NEW
  formats/rumorFile.js (RUMOR.DAT - API/RumorFile.cs; the file is
  game data, so the reader is corpus-pinned by fixture and the mill
  idles headless without it), AddNonQuestRumor with
  GetFlagsForNewRumor, RefreshRumorMill's TTL sweep,
  GetValidRumors' region/faction filters (+ the readingSign arm),
  GetNewsOrRumors + GetNewsOrRumorsForBulletinBoard with the
  faction/region macro context, and the QUEST seams LIVE:
  AddQuestRumorToRumorMill (both overloads),
  AddOrReplaceQuestProgressRumor, AddQuestorPostQuestMessage, the
  three Remove sweeps. The bridge's addQuestRumor/addProgressRumor/
  addQuestorPostMessage/removeProgressRumors/removeQuestorPostMessage/
  removeQuestRumors stop being silent.
- **TK-ii - THE TOPIC TREE**: the ListItem model (ListItemType/
  QuestionType/KeySubjectType), AssembleTopicLists + the four
  assemblers (TellMeAbout, Location with the regional-building adds,
  Person, Thing), the QuestResources/QuestResourceInfo bookkeeping,
  AddQuestTopicWithInfoAndRumors (both overloads),
  DialogLinkForQuestInfoResource, AddDialogForQuestInfoResource,
  RemoveQuestInfoTopicsForSpecificQuest, ForceTopicListsUpdate,
  CheckNPCcanKnowAboutTellMeAboutTopic /
  CheckNPCisInSameBuildingAsTopic, UndiscoverQuestResidence, the
  NPC-knowledge reset walk. The bridge's addQuestTopics/dialogLink/
  addDialog/removeQuestInfoTopics/forceTopicListsUpdate go live.
- **TK-iii - THE ANSWER PIPELINE**: GetQuestionText over the full
  QuestionType ladder with GetClassicQuestionIndex, GetAnswerText
  whole (the tell-me-about arm through GetAnswerTellMeAboutTopic and
  GetAnswerFromTokensArray, GetOrganizationInfo, GetDialogHint/2,
  GetKeySubjectPersonHint, the work string, where-am-I),
  GetAnswerWhereIsRegionalBuilding +
  CheckLocationKeyForRegionalBuilding's classic key math +
  GetLocationWithRegionalBuilding, the greeting ladder's UNPORTED
  arms (GetNPCQuestGreeting, GetNPCGreetingRecord, GetGreetingIndex
  whole - static NPCs included), GetHonoric/GetFactionNPC family /
  GetOldLeaderFateString, ExpandRandomTextRecord.
- **TK-iv - THE QUESTOR DOOR + STATIC TALK**: TalkToStaticNPC /
  TalkToMobileNPC / SetTargetNPC / StartNewConversation /
  GetStaticNPCFactionData / TalkToNpc's questor-offer door, the
  questor tracking family (IsNpcOfferingQuest,
  IsCastleNpcOfferingQuest, SetRandomQuestor, GetQuestorName /
  Gender / Location, RemoveNpcQuestor - closing the offer flow's
  removeNpcQuestor seam and the castle pool for real),
  GetPortraitIndexFromStaticNPCBillboard, the conversation SAVE
  envelope (SaveDataConversation - the mill, the quest topics,
  castleNPCsSpokenTo) threaded through the host quicksave, and the
  event rebuilds (map pixel change, the three transitions).
- **TK-v - THE HOST MOUNT**: the engine live in townTalk + the
  native talk window's Tell-me-about page, Any-news, Where-is-person
  and quest-topic surfaces; worldModes' static-NPC talk arm stops
  saying 'You get no response.'; the bridge ctx's talk seams filled;
  the save slot beside the quest envelope; probe surfaces. The
  browser half is probe-verified where a machine with game data
  exists (this environment has none - the quest arc's standing
  caveat applies).

## Standing law

The Quest-Arc doctrines carry over whole: DFU literals in every pin;
kept quirks recorded by C# line; absent seams idle LOUDLY (the
headless charter); one mutation campaign per sandbox with the
baseline re-measured after every sync (THE BASELINE TRAP: the
confirm verdict string is meaningless, only the fails count against
the current baseline decides); equivalents need PROOFS.
