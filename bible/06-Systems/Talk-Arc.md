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

## TK-i - THE RUMOR MILL (SHIPPED 2026-08-21)

The quest machine's rumor seams stop being silent. Two new modules:

- **`formats/rumorFile.js`** - the RUMOR.DAT reader 1:1
  (API/RumorFile.cs): u16 faction pair, u32 type, the three bytes,
  the 9-byte CString questName whose cursor advances the FULL 9
  whatever the NUL position (pinned by a second record aligning past
  NUL-trailing garbage), u16/u32 tail, then textLength bytes of
  classic-token text. Fixture-pinned - the file is game data, absent
  headless.
- **`systems/rumorMill.js`** - TalkManager.cs's rumor family whole.
  RumorMillEntry (:349-361) with the mill list and the questor-post
  dictionary; ImportClassicRumor (:2665-2693) with its three skip
  gates (quest flag 4, sign flag 1, NPC-specific npcID) and the
  token parse BEFORE the gates, order kept; AddNonQuestRumor
  (:2695-2715) freezing ONE random TEXT.RSC variant at add with the
  43140-minute TTL LITERAL (a hair under 30 days - not 43200);
  GetFlagsForNewRumor's exactly-seven sign types; GetValidRumors
  (:1468-1519) whole - the region gate, the sign/spoken flags&1
  split, the 75% faction-flag suppression that rolls ONLY when a
  flagged faction rides the entry, quest entries bypassing every
  common filter, the bulletin textID gate over the exact allowed-id
  list {1475,1476,1477,1478,1479,1482,1483}; the region ladder
  (entry -> faction1 -> faction2 -> current, DFU's own drop of
  classic's random); WeightedRandomRumor's running choice with the
  QuestRumorWeight default 50; GetNewsOrRumors (:1388-1440) - the
  one-answer gate (max 1, spymaster and NPCsKnowEverything bypass),
  the common arm stringing through TokensToString(tokens, false),
  the quest arm expanding through QuestMacroHelper with reveal TRUE
  at a Range-rolled variant, the 1457 out-of-news face, and the
  resolvingError quirk ('...never mind...' - Internal_Strings en 425
  - answered AND the answer spent when a CommonRumor carries null
  variants); the bulletin face answering the FIRST valid CommonRumor
  as tokens; the six QUEST seams (:1558-1690) with their
  NullReferenceException literals, unexpanded-variant capture
  (GetTextTokensByVariant(i, false)), the empty-token-list overload
  adding nothing, AddOrReplaceQuestProgressRumor swapping ONLY the
  first match's variants (the entry keeps its other fields), the
  type+id remove sweeps, and the questor-post slot (variant 0
  unexpanded, one per quest, last write wins); TokensToString
  (:3561-3578) with the empty-token-appends-separator law; and the
  SaveDataConversation halves this slice owns (the mill + the
  questor-post dictionary), round-tripping as a detached fixed
  point.

KEPT QUIRKS, the loud ones: **THE REFRESH CULL** - RefreshRumorMill
(:2742) removes every entry with timeLimit < now and has NO type
filter, so the quest entries' unset 0 dies on the first sweep; the
sweep fires from PlayerEntity.RegionPowerAndConditionsUpdate
(:1630), meaning DFU's quest rumors survive only days, verbatim.
**THE BULLETIN HOLE** - classic imports never set textID, so a
bulletin board can never show one.

The host mount: `textRsc.js` gains variantTokensById
(TextProvider.GetRandomTokens' token face, the FTD-1 empty-variant
step-back included) and townTalk exposes it; world.js mounts the
mill beside the quest bridge, lands the bridge's six rumor seams in
it (addQuestRumor / addProgressRumor / addQuestorPostMessage /
removeProgressRumors / removeQuestorPostMessage / removeQuestRumors
- all 1:1 method routes), and threads the talk envelope through
F9/F11 as save.js's third opaque slot beside `world` and `quest`.

RECORDED pending: the mill's CONSUMERS (Any news? in the talk
window, bulletin boards on building signs, the questor-post
greeting) mount with TK-iii/TK-v; ExpandRandomTextRecord's full
macro pass is TK-iii's (the interim joins the record's rows
plainly); AddNonQuestRumor's PRODUCER is the regional faction sim
(PlayerEntity.RegionPowerAndConditionsUpdate - the Systems lane),
and the live REFRESH CULL rides with it; the classic-rumor import
waits on a RUMOR.DAT fetch in the host (game data, loaded when
present).

## TALK AUDIT I (2026-08-21, the TK-i verify pass)

The mill's adversarial pass, run in the MAIN LOOP against the raw C#
(the multi-agent retry trigger stands for the quest slices; this arc
starts under the same constraint).

**The parity re-read.** Every ported region walked at implementation
time: RumorFile.cs whole, TalkManager.cs :89-125 (the constant
tables), :341-399 (the entry + save shapes), :1355-1519 (the news
faces + filters), :1552-1691 (the quest seams), :2665-2749 (the
import/add/refresh family), :3561-3578 (TokensToString), and the
PlayerEntity caller of RefreshRumorMill/AddNonQuestRumor (:1626-1901
- the regional sim, the Systems lane's pending producer). The
Message accessor mapping verified against Message.cs :161/:196 (the
port's extra `roll` slot threaded correctly). No parity deltas
found; the two kept quirks (THE REFRESH CULL, THE BULLETIN HOLE)
recorded in the SHIPPED section with their C# lines.

**The campaign.** 154 single-instance mutants over the TK-i surface
(rumorMill 90, rumorFile 36, textRsc's variantTokensById 28), four
rounds to a complete triage:

- Round 1: 84/126 caught over the mill+reader; the textRsc sweep ran
  ZERO - the coverage map predated the pins, and the method proved
  wholly untested (the mill pins had mocked getRandomTokens). The
  direct pins written for it caught a REAL CRASH: readTokens answers
  NULL on an empty stream, so the FTD-1 step-back path (the 0xFF
  0xFE tail variant) threw instead of stepping back. Fixed, pinned.
- Round 2 (same-seed re-sweep under the new pins): 118/126 caught.
- Round 3: the eight survivors triaged - five real gaps pinned (the
  outer suppression gate at faction2 id 1, the three-way OR's
  lone-faction2 arm, the ladder's both-factions-at--1 fall-through,
  a PROGRESS rumor drawn through the news face - previously never
  exercised - and the reader's npcID endianness); the 12-row
  full-suite confirm landed 9 kills (one at fails=12) and exposed
  that the faction2-id-1 pin was MASKED by its own type-26 arm -
  moved to type 100 and re-confirmed killed.
- Round 4: the textRsc sweep (coverage regenerated) left 10
  survivors; five more pins (odd-length variants exposing a
  double-stepping walk, the leading FontPrefix operand, the plain
  two-variant pick, the leading-empty pick-0 edge, the
  empty-second step-back) plus one TOKEN-EXACT deepEqual - the
  `ranges[want-1][2]` mutant sliced to end-of-record on the
  step-back, adding a stray separator token invisible to text-only
  asserts; the token shape is the law, so the pin compares shapes.
  14-row + 1-row confirms: 13 kills.

Final: **150 kills of 154, 4 PROVEN equivalents, 0 unexplained**:

- rumorMill:188 (the headless `?? -1` region fallback -> -2):
  observable only if an entry's regionID equalled -2, and regionIDs
  are -1 or RUMOR.DAT bytes.
- rumorMill:212 (`selected = validRumors[0]` -> `[1]`): a dead
  initializer - the first iteration's `r = Range(0, w) >= 0 =
  totalWeight` ALWAYS selects, so the seed value never survives
  (C#'s own initializer is equally dead).
- rumorMill:244 (the default session's `isSpyMaster: false` ->
  true): the fresh default's counter arm (0 < 1) passes first, and
  the discarded object is never read again.
- textRsc:178 (`i < raw.length` -> `<=`): the extra iteration reads
  undefined (classifies as nothing) and the final range's
  one-past-end bound is CLAMPED by Uint8Array.slice - byte-identical
  output on every record.

**The lesson recorded**: a mocked seam is an untested seam - the
mill's getRandomTokens mock left the real token face invisible to
the sweep until coverage caught up, and the very first direct pin
found a crash. Fixture the real module under any seam a slice
introduces, in the same round that introduces it.

## Standing law

The Quest-Arc doctrines carry over whole: DFU literals in every pin;
kept quirks recorded by C# line; absent seams idle LOUDLY (the
headless charter); one mutation campaign per sandbox with the
baseline re-measured after every sync (THE BASELINE TRAP: the
confirm verdict string is meaningless, only the fails count against
the current baseline decides); equivalents need PROOFS.
