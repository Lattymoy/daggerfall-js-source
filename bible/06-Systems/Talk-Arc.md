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

## TK-ii - THE TOPIC TREE (SHIPPED 2026-08-21)

`systems/topicTree.js` is TalkManager.cs's topic-list core, 1:1: the
ListItem model (:127-173) with its C# field defaults, the
QuestResources/QuestResourceInfo bookkeeping (:285-339), the quest
topic pipeline (:2064-2285), the person/building lookups
(:2287-2374), IsBuildingQuestResource (:2376-2421), the assembly
engine (:3086-3500) and its gate helpers (:2940-3083), and the
dictQuestInfo half of SaveDataConversation (:2426-2549). Five more
of the bridge's silent seams land: addQuestTopics, dialogLink,
addDialog, removeQuestInfoTopics, forceTopicListsUpdate.

The law, pinned (topictree.test.js, 27):

- **The tables, verbatim**: the 34-entry infoFactionIDs, the 30-row
  FactionsAndBuildings with its matching localized caption list and
  the ten KnightlyOrderRegions, BuildingTypeToGroupString's thirteen
  captions with the empty-string default, and the FULL 17-entry skip
  predicate - which includes AllValid and Special1-4, the five the
  T3c where-is list omitted. A CROSS-MODULE pin holds actions.js's
  QUEST_INFO_RESOURCE_TYPE copy against the tree's: a drift there
  would silently mis-route every dialog link the machine emits.
- **The assembly**: enum-ordered type groups each headed by a
  Previous List item pointing at the parent list; the quest General
  section behind its same-map / keyed / RMBLayout.IsResidence gates;
  the regional group's three arms (rows 8-17 the knightly orders
  gated on region, rows 20+ stores searched by TYPE, everything else
  by FACTION) with local buildings removing their rows and an
  unloaded location keeping all of them; the person list's
  questor-mapID and assigned-place gates; the always-empty Thing
  list, as classic never implemented it either; and the instant pass
  rebuilding only flagged lists before refreshing the window.
- **The gates**: the recursive knowledge reset walking into item
  groups, the tell-me-about region gates with the -1 home-index
  bypass (a homeless individual is knowable anywhere), and the
  same-building compare with its palace arm - a castle resolves by
  building TYPE and then compares by NAME, because a palace place
  carries buildingKey 0.

KEPT QUIRKS, each by C# line:

- **THE DISCARDED FIRST ADD** (:2104-2115): the QuestResources bag is
  fetched-or-created BEFORE the empty-name bail and written to
  dictQuestInfo only at the tail - so an empty resourceName on a NEW
  questID leaves no entry behind at all.
- **THE STICKY TELL-ME-ABOUT FLAG** (:2135): hasEntryInTellMeAbout is
  only ever SET; a re-add with null answers keeps a previous true,
  while hasEntryInWhereIs beside it is written both ways.
- **THE SHARED GROUP VARIABLE** (:3206-3352): one local threads
  through the type groups, the quest General section and the palace
  arm - so a palace joins an existing General group rather than
  minting a second, and the palace arm's own creation branch never
  sets alreadyCreatedGeneralSubSection (dead - it is the last use).
- **THE MISNAMED THROWS** (:2291-2333): every person-lookup throw
  carries the copy-pasted "GetBuildingKeyForPersonResource()"
  literal, including the null-symbol arm's wrong "Resource is not of
  type Person but was expected to be" - the wrong words ARE the
  words.
- dialogLink's unknown linked type logs and RETURNS before the hide
  (:2201-2203), while a NotSet type falls through TO it; addDialog
  with a null resourceName skips the body but still runs the rebuild
  tail (:2235, :2270); and the caption test at :3146 is a NULL test,
  so an EMPTY buildingName is taken as the caption rather than
  falling to the location name.

Supporting ports this slice needed: `QuestResource.getMessage`
(:283-296, the variant token list), Person's three home-place
properties (:112-125 -> :523-569), `RMBLayout.IsResidence`,
`PlayerGPS.UndiscoverBuilding`'s store half, and the mill's
`RestoreConversationData` orphan sweep (:2522-2533). world.js mounts
the tree beside the mill and composes both halves into the talk
envelope.

RECORDED DELTA (Ledger A, collection semantics - found in the TK-ii
parity re-read): the assemblers walk `dictQuestInfo` in iteration
order, and the two languages disagree about what that is after a
REMOVAL. .NET's `Dictionary<K,V>` stores entries in an array and
enumerates it by index; a Remove frees its slot onto a freelist, and
the NEXT Add reuses that slot - so a quest started after another
ended can enumerate BEFORE quests added earlier. A JS `Map` always
appends. The port therefore lists quest topics in strict start
order where DFU's order is slot-dependent. Microsoft documents
Dictionary ordering as unspecified, so there is no "correct" order
to copy here and emulating the freelist would be fidelity to an
implementation detail rather than to Daggerfall; the divergence is
cosmetic (the ORDER of entries in the Tell-me-about and Where-is
lists after a quest churn, never their contents or gating).
Recorded, not emulated.

RECORDED pending: the tree's WINDOW consumers (the Tell-me-about
page, the quest Where-is entries, the knowledge marks the gates
compute) mount with TK-v; the talkPartner seam reads null until
TK-iv brings the NPC session, so the same-person checks are pinned
but idle live; GetBuildingList's questor-populate half (npcsWithWork,
the 25% work roll) and the BuildingInfo `position` the compass wants
ride TK-iii/TK-iv; isPlayerInsideCastle is Q4-v's standing false.

## TK-iii - THE ANSWER PIPELINE (SHIPPED 2026-08-21)

`systems/answerPipeline.js` is TalkManager's question/answer half,
1:1 - the LADDER on top of the tables T3c-T3f already shipped
(answersToDirections/answersToNonDirections, knowledgeModifiers, the
reaction tier, the compass bands, the 0.35 fork). What it adds is
which record a question draws, which arm an answer takes, and what
each arm marks on the way through: GetQuestionText (:1298-1353),
GetAnswerText's dispatch (:1992-2043), GetAnswerTellMeAboutTopic
(:2045-2062), GetAnswerWhereIs (:1839-1866), the regional building
family (:1868-1990), GetNPCKnowledgeAboutItem (:567-627),
GetClassicQuestionIndex (:691-724), the hints (:1692-1793), the
compass and map marks (:1189-1296), and the PC opening / work /
organization / honorific records.

**THE REGIONAL LOCATION-KEY DECODER** is the dense piece and the one
worth reading twice. A classic location's key packs three flag bytes
- temples in byte 0, stores in byte 1, guilds in byte 2 - and each
building asks for a single bit through C#'s
`(byte)(flags << n) >> 7`. That idiom truncates to 8 bits BEFORE the
unsigned shift, so it reads bit **(7 - n)**: the shift amount is not
the bit number. Every store, guild and divine is pinned to its own
bit with the complement proving it reads no other; all ten knightly
orders share one bit; 0x1c is pinned as the HOLE in that run; and
the byte lanes are proven not to bleed into each other.

KEPT QUIRKS, each by C# line:

- **THE KNOWS-BUT-SILENT ARM** (:2050): a topic the NPC KNOWS still
  answers the doesn't-know record once the one-answer gate has
  closed. The gate is ORed against the knowledge, so knowledge alone
  never beats it - only being in the same building, a spymaster, or
  the debug flag reopens it.
- **THE ASYMMETRIC WHERE-IS GATE** (:1844): the directions arm
  honours NPCsKnowEverything but NOT isSpyMaster, where the
  tell-me-about arm honours both. A spymaster who fails the
  knowledge roll still refuses to give directions.
- **Directions are free**: the where-is answers never touch
  numAnswersGivenTellMeAboutOrRumors. An NPC gives directions all
  day and discusses exactly one topic.
- **THE DEAD KEY OVERRIDE** (:1729-1731): GetKeySubjectPersonHint
  assigns `key = item.key`, then tests that same field for
  non-emptiness and assigns it again. The branch cannot change
  anything.
- **GetDialogHint2's inversion** (:1783): the spymaster reads
  anyInfo where everyone else reads rumors, and NPCsKnowEverything
  deliberately does NOT apply - C#'s own parenthetical says so.
- **The token CLONE** (:3552): answers are cloned before expansion
  so altering macros (%di and its kin) re-evaluate on every ask -
  DFU names the Missing Prince quest in its comment.
- **THE COMPASS MARK** (:1192-1198) stamps ReceivedDirectionalHints
  but never downgrades a resource already marked on the map; and
  MarkKeySubjectLocationOnMap's buildingKey-0 guard (:1286) marks
  nothing at all.
- GetKeySubjectBuildingHint takes the DIRECTION arm when the roll is
  ABOVE 0.35 **or** the player is indoors (:1713), so the 0.35
  boundary itself belongs to the map arm.

**THE LIVE MACRO SLOTS** are the shape this slice got wrong twice, so
they are law now. Two TalkManager fields exist only for the duration
of a single ExpandRandomTextRecord call, because the macro layer reads
them while the record expands and nothing else ever does:

- `markLocationOnMap` (:1694, :1700-1702): set immediately before the
  expansion and cleared immediately after, so that a later
  message-preprocessing pass resolving `%loc` cannot reveal a location
  by accident. C#'s own comments say exactly that.
- `greetingNameNPC` (:1136-1140): filled before the greeting record
  (7215-7217) expands and emptied the instant it returns, because
  TalkManagerMCP's `Name()` resolves `%n` through it and falls back to
  a random full name when it reads empty (TalkManagerMCP.cs:54).

The port had the first right and the second inside out - it stored the
name AFTER the expansion, under a name (`lastGreetingNameNPC`) that
described a record of what happened rather than a slot that is live for
one call, and never cleared it. Both halves were wrong: the greeting
expanded with the slot still empty, so `%n` drew a stranger's name
every time, and the value left standing would have named the last NPC
greeted in every message the session preprocessed afterwards. A grep of
TalkManager.cs for a clear-after-expansion assignment finds exactly
these two fields, and both are now faithful.

**THE HEADLESS SESSION IS A FIELD, NOT A LITERAL.** C#'s `npcData`
(:189) is a field of TalkManager; the counter it carries
(`numAnswersGivenTellMeAboutOrRumors`) survives from one answer to the
next and is zeroed only when a new NPC is set (:742, :798). The port
routes the session through a seam, which is right - but its absent-seam
default was an object literal rebuilt on every call, so headless the
increment was thrown away and the one-answer gate could never close: an
NPC with no session seam answered every tell-me-about correctly,
forever. The default is now a single object created with the pipeline,
which is what the C# field is. The rumor mill carried the same bug in
`getNewsOrRumors`'s default parameter and is fixed with it.

TWO OF THE FIRST PINS WERE MINE BEING WRONG, not the port's, and
both are worth recording as a method note: I tabulated the temple
arm's SHIFT AMOUNTS as if they were bit numbers, and I guessed a
knowledge modifier's sign rather than reading the table. The port
was right both times; the pins now derive from the real values. A
pin asserting a number you reasoned out is a pin asserting your
reasoning - read the table.

THE TONE GATE WAS THE THIRD OF THE SAME MISTAKE, found by the same
re-read: C# recomputes the reaction tier inside `GetAnswerText` itself
(:1994-1995) and stamps `lastToneIndex` inside
`GetReactionToPlayer_0_1_2` (:682). The port had moved it to the
caller, under a comment claiming C# did the same - so a host that
forgot the call would answer at a stale tier forever. It lives in
`_refreshReactionTier`, called at the head of `getAnswerText`, where a
host cannot forget it.

RECORDED pending: the pipeline is engine-complete but not yet
MOUNTED - the talk window's question/answer routing, the npcSession
itself (TK-iv), the automap coordinates the building compass wants,
and GetAnswerWhereAmI's live building / dungeon seams all ride TK-iv
and TK-v. The greeting arms
(GetNPCGreeting/GetNPCQuestGreeting/GetGreetingIndex) belong with
the NPC session and moved to TK-iv with it.

## TK-iv - THE NPC SESSION (SHIPPED 2026-08-21)

`systems/npcSession.js` is TalkManager's NPC-session half, 1:1. The
three slices before it answer questions for an NPC that nothing has
yet chosen; this is the module that chooses one, and decides whether
the conversation happens at all.

Ported: the click arms (TalkToMobileNPC :726-744, TalkToStaticNPC
:746-803), the target chain (SetTargetNPC's two overloads :805-865),
GetStaticNPCFactionData (:884-907), the two parent walks
(PersistentFactionData's GetParentGroupFaction and TalkToStaticNPC's
own six-type one), GetGreetingIndex whole (:1002-1063),
GetNPCGreetingRecord (:943-993), TalkToNpc's three doors (:2615-2663),
GetNPCQuestGreeting (:909-941), the questor pool with its build policy
(:2762-2876) and the tracking family (:2551-2610),
StartNewConversation (:867-878), and the SaveDataConversation halves
this slice owns (npcsWithWork, castleNPCsSpokenTo).

KEPT QUIRKS, each by C# line:

- **THE UNGUARDED FIRST ARM** (:1035, :1046). The ally and enemy tests
  read `IsAlly(a, b) || IsAlly(b, a) && greetingIndex > 2`. `&&` binds
  tighter than `||`, so the greetingIndex guard applies only to the
  second, REVERSED test - a forward match overwrites an index that is
  already better, while the reversed one cannot. The same-parent test
  directly above parenthesises correctly, and the four loops below
  guard properly, which is exactly what makes these two stand out as
  a slip rather than a style. Pinned in both directions on both tests.
- **THE STRANGER FLOOR** (:967-976). DFU's improvement over classic:
  at greeting index 8, classic always answered 8570 ("Well met,
  stranger.") however well liked you were. Here `rep >= 30` takes the
  warm face only when the index is NOT 8, and the ordinary face needs
  `rep <= 5` OR a non-8 index. An NPC at index 8 liked a little - rep
  6 to 29 - therefore satisfies neither test and falls all the way
  through to the plain reaction ladder.
- **THE REJECTION FOUND MID-GREETING** (:2630 vs :2641).
  `alreadyRejectedOnce` is tested at the top of TalkToNpc AND again
  after GetNPCGreetingRecord - which SETS it (:978) when the
  reputation roll goes against the player. So a rejection the greeting
  lookup itself just decided answers with the RAW tokens of that
  greeting record in a message box, and the window never opens.
- **THE NAMES NOBODY READS** (:185-188). npcFactionName,
  pcFactionName, allyFactionName and enemyFactionName are commented
  "kept for guild related greetings" and are written by every arm of
  GetGreetingIndex - and a grep of the whole DFU tree finds no reader,
  inside TalkManager or out of it. The guild-flavoured greeting macros
  that would spend them are unimplemented. Ported as written, because
  the day those macros land the values have to already be right.
- the social group is **CLAMPED to Merchants at 5 and above** for
  statics (:848, matched to classic), while every mobile is a
  Commoner of no guild whatever its faction says (:826-827) - C#'s own
  literals, not the faction's sgroup.
- a **REPEAT click is a no-op** (:809-813, :837-841): the NPCData
  survives, and with it the one-answer counter, the faction and any
  standing rejection. Which is precisely why both click arms reset
  `numAnswersGivenTellMeAboutOrRumors` AFTER the target chain rather
  than inside it (:742, :798).
- **the questor pool's roll is spent early** (:2823-2827): the 25%
  `Range(0, 4)` with `< 3` continuing is rolled BEFORE the child test
  and before the already-in-pool test, so those NPCs consume a roll
  they can never use. An unnamed building's candidate is built in full
  and then dropped (:2861-2865), and `selectedNpcWorkKey` is left
  pointing at the LAST NPC added (:2869), so a pool build silently
  reselects the questor.
- the parent walk in TalkToStaticNPC stops on **six** types, three of
  them DFU's own additions (:781-789) "since they have their own
  reputation" - People, Courts and Individual on top of classic's
  Group, Province and Temple.
- `allowGuildResponse = !(!menu && isSpyMaster)` (:800): only a
  spymaster clicked from OUTSIDE the guild menu loses the guild
  response. The double negative is C#'s.
- DFU's **fixed -20** on the enemy arm (:1050-1052), where its own
  comment records that classic SET the reputation to 20 instead of
  decreasing it.

RECORDED, not emulated: **THE ZERO-FACTION MATCH.** C#'s
GetFactionData leaves its out param as a default struct on a miss, so
an unresolvable guild reads as faction id 0. Two tests then answer
true for reasons that are really "both sides are empty": the sibling
arm's `npcGroupFaction.parent == guildFactionData.id` matches any
parentless faction, and IsAlly/IsEnemy compare an unset allyN or
enemyN slot (0) against that same id. A real guild always resolves, so
this is unreachable in a running game - but it IS the headless
ladder's behaviour, so it is pinned rather than papered over.

Also RECORDED (Ledger A): SetRandomQuestor uses `new System.Random()`
(:2580), a different generator from every other roll in TalkManager -
unseeded and wall-clock dependent. Unspecified, so the port's own roll
is as faithful.

**THE UNCLONED QUESTOR POST** (:927 vs :3552). ExpandQuestMessage
writes each expanded string back into the token it came from
(QuestMacroHelper.cs:157), and GetNPCQuestGreeting hands it the array
straight out of `dictQuestorPostQuestMessage` - no clone. So the
STORED message is permanently expanded by the first greeting, and
greeting the same questor again re-expands what is already expanded.
GetAnswerFromTokensArray DOES clone before expanding, with DFU's own
comment naming the altering macros that must re-evaluate on every ask
and citing the Missing Prince quest; this arm does not, so an altering
macro in a post-quest message freezes at its first value. Kept, along
with the conversion's DEFAULT separator (:936) where the mill's common
arm passes `false`.

**The re-read caught three bugs in my own port before the pins did**,
and the first two are the same shape as TK-iii's - a law left with the
host that C# keeps in the method:

1. **Half of TalkToNpc's tone reset was the host's.** C# clears
   `lastToneIndex` AND `toneReactionForTalkSession[0..2]` in the same
   four lines (:2659-2662). The first lives on TK-iii's pipeline and
   rightly rides a seam; the second is TalkManager's own field, and I
   had left it with the host. A host that cleared only the seam would
   answer for the next NPC with the last one's cached reaction. The
   array is now this object's field, cleared here.
2. **The questor pool took each candidate's social group as given.**
   C# resolves it through GetStaticNPCFactionData with the BUILDING's
   own type (:2814-2816), so the id-0 court/people redirect and the
   three generic Random_* redirects apply in the pool exactly as they
   do at a click - and the sgroup is read UNCLAMPED, the Merchants
   fold belonging to SetTargetNPC alone. The port now resolves it.
3. **StartNewConversation reset three fields that live elsewhere.**
   `numQuestionsAsked`, `questionOpeningText` and
   `currentQuestionListItem` were reset on this object, where nothing
   reads them: those three are TalkManager fields in C# but live on TK-iii's
AnswerPipeline in the port. A second copy here would have been a reset
that never reaches the thing doing the answering. It now goes through
a `resetQuestionSession` seam, and the pipeline gained the matching
`startNewConversation()` half - which deliberately does NOT touch
`lastToneIndex`, because that half belongs to TalkToNpc and fires at a
different moment.

RECORDED pending: the pool build's block walk is the host's (it
already feeds TK-ii's getBuildingList), so `buildQuestorPool` takes
the candidates rather than the blocks - but it resolves their factions
itself; GetPortraitIndexFromStaticNPCBillboard
rides the `portraitForBillboard` seam; and the window routing, the
event rebuilds and the save threading land with TK-v.

## TK-v - THE HOST MOUNT (SHIPPING 2026-08-21)

The arc's last slice: the four engine modules live in the running
hosts, and the one module that was still missing between them.

**`systems/talkMacros.js` is TalkManagerMCP.cs whole** (207 lines, 13
handlers) plus MacroHelper.ExpandMacros and
TalkManager.ExpandRandomTextRecord (:3580-3587). This is the module
the arc had been waiting for without knowing it: TK-iii found two
TalkManager fields that exist only for the duration of a single
expansion - `markLocationOnMap` for %loc and `greetingNameNPC` for %n -
and fixed the port to fill and clear them at C#'s moments. Nothing
read them, because nothing had ported the reader. Both are now pinned
from inside an actual expansion.

Ported with them: %di's two-arm compass; %hnt and %hnt2, which share
every arm but the quest one, where they part into anyInfo and rumors;
**THE MALE-NAME SEED NUDGE** (+3547 before the draw and -3547 after, so
a male and a female name drawn in one breath differ and the stream is
left exactly where it was found - and the female name does not nudge at
all); %oth reading the NPC's FACTION race with the region as fallback,
which is DFU's own fix for classic having every High Rock NPC swear
Nord oaths; the four pronouns as the POTENTIAL QUESTOR's gender, with
C#'s `default:` sharing the Male case; and %pqn/%pql over the questor
pool.

**The re-read caught the expansion algorithm itself.** I had written a
plausible one - substring replacement, longest token first - rather
than C#'s. MacroHelper scans from each `%` to the next
MACRO_TERMINATOR, which is what tells %hnt2 from %hnt and %g4 from %g
with no ordering at all. Two behaviours fell out of that mistake:

- **THE MACRO CACHE** (:428): one dictionary per ExpandMacros CALL,
  with C#'s own comment on why - "some macros evaluate differently each
  time (e.g. macros with random generated names)". A record naming %fn
  in two tokens names the SAME woman twice; the port would have named
  two.
- **THE PIPE IS EATEN** (:472-475): `|` terminates a macro and is
  swallowed, which is how `%di|ern` becomes "southern". The port left
  it in the text.

THE HOST WIRING, in world.js and worldModes.js:

- the NPC session and the answer pipeline built beside the mill and the
  tree, wired to each other the way TalkManager's fields are wired -
  the tree's `rebuildTopicLists` read and spent by the session's
  StartNewConversation, the session's `npcData` what the pipeline reads
  for the social group and the one-answer counter, the mill answering
  the News arm through the session it is handed;
- **THE QUESTOR DOOR OPEN**: a static-NPC click runs TalkToStaticNPC,
  so an NPC the work pool is carrying opens the quest offer through
  Q4-ii's `offerSocialQuest` - the arm that had been waiting since the
  offer flow shipped - instead of the conversation;
- the pipeline's `expandRandomTextRecord` running the real MCP;
- **the tone gate moved off the host.** townTalk kept its own
  `lastToneIndex`, its own `toneReactionForTalkSession` and its own
  `numQuestionsAsked` - three TalkManager fields, reset by hand. They
  are the engine's now, and what stays with the host is what belongs
  to it: which tone button is selected, and the tier COMPUTATION;
- SaveDataConversation whole in the quicksave (:368-375), one envelope
  written by three owners and read back by three;
- the six event subscriptions (:3593-3629) wired into the world's
  teleport and both exterior transitions.

Two supporting corrections the mount needed: `talkSession`'s
OATH_RACE_INDEX widened from the four races the mobile ladder needed to
the eight GetFactionRaceFromRace can answer (the MCP reads it for a
static NPC of any race), and `dfRandom` gained the Seed accessor pair
C#'s settable property is - without which the male-name nudge is not
portable at all.

**test/talkengine.test.js** builds all four modules exactly as world.js
builds them and drives a conversation through the assembly - the click,
the greeting, the tone gate, the mill's news, the tree's knowledge
reset, the questor door and the envelope. All six passed on the first
run, which is the answer to whether the mount is sound.

RECORDED pending: the talk WINDOW still draws its Where-is list from
T3c's building directory rather than from the tree's assembled
`listTopicLocation`, and %loc and %key are MacroHelper globals rather
than MCP overrides, so they remain the host's. The browser half is
probe-verified only where a machine with game data exists - this one
has none, and the quest arc's standing caveat applies.

## TALK AUDIT V (2026-08-21, the TK-v verify pass)

The MCP's adversarial pass, in the MAIN LOOP against the raw C#.

**The re-read caught the expansion ALGORITHM.** I had written a
plausible one - substring replacement, longest token first - rather
than MacroHelper's. It scans from each `%` to the next
MACRO_TERMINATOR (:412), which is what tells %hnt2 from %hnt and %g4
from %g with no ordering at all; mine got those right by accident.
Two behaviours fell out of the mistake, both now the algorithm rather
than an approximation of it:

- **THE MACRO CACHE** (:428): one dictionary per ExpandMacros CALL,
  with C#'s own comment on why - "some macros evaluate differently
  each time (e.g. macros with random generated names)". A record
  naming %fn in two tokens names the SAME woman twice; the port would
  have named two.
- **THE PIPE IS EATEN** (:472-475): `|` terminates a macro AND is
  swallowed, which is how `%di|ern` becomes "southern". The port left
  it in the text.

**The campaign** swept 43 mutants over the module: 36 caught, 7
survived, 0 uncovered. Four were real gaps - the quest-type test being
an OR of three (each type reaching the dialog hint alone), the absent
factionRaceId seam reading race 0, a null-text token skipped rather
than scanned, and the scan starting one past the `%`. Two are proven
equivalents:

- `:184` (`endPos < text.length` -> `<=`) and `:188`
  (`currentPos < text.length` -> `<=`): at the end of the string the
  read is `undefined`, which is neither a terminator nor `'|'`, and
  `slice` clamps its end - so the extra iteration changes neither the
  name scanned nor the text emitted.

The seventh is not a survivor but a HANG: `:184`'s `&&` -> `||` makes
the terminator scan run past the end of the string forever, because
`undefined` is never a terminator. The existing pins reach it - a
trailing macro like `%n` walks the scan to the string's end on every
one of them - and the runner records a timeout rather than a failure.
Recorded as caught-by-hanging rather than claimed as a kill.

## TALK AUDIT IV (2026-08-21, the TK-iv verify pass)

The NPC session's adversarial pass, again in the MAIN LOOP against the
raw C# (the multi-agent retry trigger stands).

**The re-read found three port bugs, and two were the same mistake
TK-iii's re-read had already caught once** - a law left with the host
that C# keeps inside the method. That it recurred immediately, in the
next slice, is why both are now standing law rather than findings:

1. **Half of TalkToNpc's tone reset was the host's.** C# clears
   `lastToneIndex` AND `toneReactionForTalkSession[0..2]` in the same
   four lines (:2659-2662). The first lives on TK-iii's pipeline and
   rightly rides a seam; the second is TalkManager's own field, and it
   had been left outside. A host clearing only the seam would answer
   for the next NPC with the last one's cached reaction.
2. **`rebuildTopicLists` was shadowed.** It is ONE TalkManager field:
   the topic machinery raises it, StartNewConversation spends it. The
   session carried its own copy, which nothing would ever have raised,
   so the deferred rebuild could never happen. It reads and clears the
   tree's through seams now.
3. **The questor pool took each candidate's social group as given.**
   C# resolves it through GetStaticNPCFactionData with the BUILDING's
   own type (:2814-2816), so the id-0 court/people redirect and the
   three generic Random_* redirects apply in the pool exactly as they
   do at a click - and the sgroup is read UNCLAMPED, the Merchants
   fold belonging to SetTargetNPC alone.

And one of DFU's own, kept: **THE UNCLONED QUESTOR POST** (:927 vs
:3552). ExpandQuestMessage writes each expanded string back into the
token it came from (QuestMacroHelper.cs:157), and GetNPCQuestGreeting
hands it the array straight out of `dictQuestorPostQuestMessage`. The
stored message is therefore permanently expanded by the first
greeting. GetAnswerFromTokensArray clones before expanding for exactly
this reason, with DFU's own comment naming the altering macros that
must re-evaluate; this arm does not, so an altering macro in a
post-quest message freezes at its first value.

The mount exposed one more gap, in TK-ii: TopicTree had
ResetNPCKnowledgeInTopicListRecursively but not **ResetNPCKnowledge**
(:546-553), which walks all four lists AND asks for a rebuild. It is
what TalkToNpc calls whenever the target is not the same NPC as
before, which is precisely why a repeat click keeps what the last NPC
knew.

**The campaign** ran three rounds against a re-measured baseline.
Round 1 swept 180 mutants over the whole file on a fresh coverage map:
123 caught, 57 survived, 0 `noTestExecutesLine`. Round 2, at a
different seed after those 57 were pinned, ran 190: 166 caught, 24
survived - a kill rate of 68% then 87%.

**The lesson recorded: a guard is invisible on the index that does not
reach it.** Every `> N` test in GetGreetingIndex differs from `>= N` -
or from `> N+1` - only when the index is EXACTLY N at that moment, and
no single membership can arrange that, because the arm that sets N is
the one being guarded. Nine of round 2's survivors were guards that
had looked thoroughly pinned. Six two-membership fixtures now walk the
index onto each bar in turn (the ally arm at 2, the enemy arm at 3 and
again from 4, enemies in common at 4 from 5, allies in common at 5
from 6, the guild-allied-to-their-enemy arm at 6 from 7), each
asserting the exact index AND the exact accumulated reputation - so a
guard that fires twice is as visible as one that never fires. This is
the sibling of TK-ii's spot-checked-table lesson and TK-iii's
self-referential pin: a fixture that cannot reach the state a line
guards is not a test of that line.

Round 2's 24 survivors resolve as 16 real gaps - all pinned, all
re-confirmed dead against the FULL suite (`fails` of 6 and 7 against a
baseline of 5; THE BASELINE TRAP sprung again here, and caught, since
two rows came back at exactly 5) - and EIGHT proven equivalents, in
two families.

The first family is DFU's own redundancy, and it is why those two rows
read as caught when they were not:

- `:444`, `:491` (`sameTalkTargetAsBefore = false` at the head of
  TalkToMobileNPC and TalkToStaticNPC): C# writes
  `sameTalkTargetAsBefore = false;` and then immediately passes the
  same field to SetTargetNPC **by ref** (:740, :796), whose own first
  line assigns it false again (:807, :835). The caller's write is
  therefore dead in C# as much as in the port - the callee always
  overwrites it before anything can read it. Only SetTargetNPC's own
  assignment is live, and that one (`:388`) dies to a pin.

The second family is the loop bounds:

- `:262`, `:263`, `:276`, `:277`, `:288`, `:299` (the in-common loops'
  `i < 3` -> `<= 3`, and the identical `3` -> `4`): the four arrays are
  three-element literals built from `enemy1..3` / `ally1..3`, and
  every FACTION.TXT record carries all six as NUMBERS (factionFile.js
  initialises them to 0 before parsing). A fourth read is therefore
  `undefined`, and `undefined === <number>` is false for every slot on
  the other side - so the extra iteration can never match. The last
  two loops go further: they feed the out-of-range read to the faction
  seam, which answers null for `undefined`, and the `enemy &&` /
  `ally &&` guard drops it. Killing these would need BOTH loop bounds
  mutated at once, and a faction record with a missing slot.

**Kept quirks** are recorded with the slice in TK-iv above - THE
UNGUARDED FIRST ARM, THE STRANGER FLOOR, THE REJECTION FOUND
MID-GREETING, THE NAMES NOBODY READS, and THE ZERO-FACTION MATCH,
which is recorded rather than emulated.

## TALK AUDIT III (2026-08-21, the TK-iii verify pass)

The pipeline's adversarial pass, again in the MAIN LOOP against the
raw C# (the multi-agent retry trigger stands).

**The re-read found THREE port bugs, all the same mistake.** Each was
state whose only observer runs somewhere the port had stopped
thinking about, and in each case a comment asserted the port was
faithful when it was not:

1. **The tone gate.** C# recomputes the reaction tier inside
   `GetAnswerText` (:1994-1995) and stamps `lastToneIndex` inside
   `GetReactionToPlayer_0_1_2` (:682). The port had moved the gate to
   the caller under a comment claiming C# did the same. A host that
   forgot the call would answer at a stale tier forever. Moved into
   `_refreshReactionTier` at the head of `getAnswerText`.
2. **The %n slot.** `greetingNameNPC` is filled before the greeting
   record expands and emptied the instant it returns (:1136-1140),
   because TalkManagerMCP's `Name()` resolves `%n` through it
   (TalkManagerMCP.cs:54). The port set it AFTER the expansion and
   never cleared it - so `%n` drew a random full name every time, and
   the value left standing would have named the last NPC greeted in
   every message the session preprocessed afterwards.
3. **The headless session.** C#'s `npcData` is a FIELD (:189) whose
   one-answer counter survives from answer to answer. The port's
   absent-seam default was an object literal rebuilt per call, so the
   increment was discarded and the gate could never close: a
   seam-less NPC answered every tell-me-about correctly, forever. The
   rumor mill carried the same bug in `getNewsOrRumors`'s default
   parameter, and **TALK AUDIT I had recorded its symptom as a proven
   equivalence** - "the discarded object is never read again" was true,
   and it was the bug talking. That equivalence is withdrawn, and its
   line is live: all three mutants on the mill's new field re-confirm
   dead against the full suite (fails=6, 5, 5 on a baseline of 4),
   including the one that reverts the fix by putting the object literal
   back in the parameter default.

A grep of TalkManager.cs for a clear-after-expansion assignment finds
exactly the two live macro slots, and both are now faithful. The rest
of the slice re-read clean: MarkKeySubjectLocationOnMap's
default-struct key-0 guard, GetKeySubjectLocationCompassDirection's
never-downgrade stamp, GetLocationWithRegionalBuilding's
count-then-walk, GetDialogHint2's spymaster inversion. One seam was
missing rather than wrong: GetRegionalLocationCityName stores
`GetLocalizedLocationName(MapTableData.MapId, Name)` (:1885), which
answers the raw name when no override exists - so the port's behaviour
was right by accident with nothing to override. Added.

One comment was re-sited for the host that has to read it:
`lastToneIndex` is cleared in **TalkToNpc** (:2657-2662), which runs on
the CLICK and clears `toneReactionForTalkSession[0..2]` with it - NOT
in StartNewConversation, which resets the question counter and the
opening text instead (:867-878). The host must call both, at their two
different moments.

**The campaign** ran four rounds against a re-measured baseline of 4
(the git-less doctrine tests). Round 3 swept 170 mutants over the whole
file against a freshly regenerated coverage map: 147 caught, 23
survived, and **0 `noTestExecutesLine`** - where round 2, on a stale
map, had reported 26 lines with no test on them at all. Eleven of the
23 were real gaps and are now pinned; all eleven re-confirmed dead
against the FULL suite at `fails=5` on a baseline of 4. Twelve are
proven equivalents:

- `:144`, `:159` (`>> 7` -> `>>> 7`): both operands are already masked
  to 0..255 (`& 0xff` on the left, `(key >> 8) & 0xff` for storeFlags),
  so the sign bit can never be set and the two shifts agree.
- `:148` (`(key >> 8) & 0xff` -> `>>>`): the mask takes bits 8..15 of
  the key, which sign extension cannot reach.
- `:150` (`index > 0x27` -> `> 0x28`): no switch case exists above
  0x27, so index 0x28 reaches the same `default: return 0` either way.
- `:350`, `:351`, `:352` (`>>> 0` -> `>> 0`, five mutants): `srand`
  does `BigInt(seed >>> 0)` internally, so the normalisation is
  applied again downstream regardless.
- `:502` (`count <= 0` -> `< 0`): the count is a sum of 0-or-positive
  bit reads, and at count 0 the walk subtracts 0 from a
  `locationToChoose` of 1 at every step, so it can never reach 0 -
  both return null.
- `:547` (`if (item.key !== '') key = item.key` -> `===`): THE DEAD KEY
  OVERRIDE, C#'s own dead branch - both sides assign the same value.
- `:563` (`markLocationOnMap = true` before the hint fork -> false):
  a dead store in C# too. `GetKeySubjectBuildingHint` routes
  unconditionally into one of two functions, and BOTH assign the flag
  as their first statement, before any expansion can observe it.

**The lesson recorded**: an equivalence proof is only as good as the
code it is proved against. AUDIT I's `rumorMill:244` equivalence was
correctly argued and still wrong, because the thing that made the
mutant invisible - a default object nobody ever read again - was
itself the divergence. When a proof's reasoning is "this value is
discarded", ask why it is discarded before recording it as fine.

## TALK AUDIT II (2026-08-21, the TK-ii verify pass)

The tree's adversarial pass, again in the MAIN LOOP against the raw
C# (the multi-agent retry trigger stands).

**The parity re-read.** TalkManager.cs :127-173 (ListItem), :285-339
(the quest bookkeeping), :401-476 (the properties - plain accessors,
the port's public fields cover them), :2064-2285 (the pipeline),
:2287-2421 (the lookups + IsBuildingQuestResource), :2426-2549 (the
save/restore), :2752-2882 (GetBuildingList - the building half
ported, the questor-populate half deferred to TK-iv and recorded),
:2884-3083 (the gates), :3086-3500 (the assemblers), plus
RMBLayout.IsResidence, Person.cs :112-125/:523-569 and
QuestResource.cs :283-296 for the supporting ports. No behavioural
deltas found; the five kept quirks are recorded in the SHIPPED
section by line, and ONE structural delta surfaced and is recorded
there too (the Dictionary-vs-Map iteration order after a removal -
unspecified in .NET, so recorded rather than emulated).

**The campaign.** 143 single-instance mutants over the TK-ii surface
(topicTree 140, buildingNames' isResidence 3; the questResource,
person and rumorMill additions reported noTestExecutesLine and were
covered by the tree's own pins), three rounds:

- Round 1: 95/143 caught, 47 survivors, and NO equivalents in the
  batch - unusual, and the tell was accurate: every one was a real
  gap. Two mattered beyond their line. THE TABLES were spot-checked
  rather than pinned, so a mutant flipping faction 84->85 or
  building 0x1d->0x1e sailed through; those tables ARE the law, and
  a wrong id silently mis-captions an organization row or mis-gates
  a regional building forever with nothing else failing. And
  isResidence was pinned at House4/House5 - the UPPER edge - leaving
  its lower `>=` free to become `>`. All three tables now deepEqual
  element for element; both residence edges are pinned.
- Round 2 (same seed, 22 new pins): 136/140 caught. The rest of
  round 1's gaps were masked arms - addDialog's Person and Thing
  flags (only Location had been exercised), the EXACT
  ReceivedDirectionalHints level where `>=` and `>` diverge, the
  castle-questor arm, the availableForDialog/hasEntryInWhereIs AND,
  a non-matching faction leaving regional rows standing, and the
  keyless-place skip, which needed a residence seated AT key 0
  before the mutant became distinguishable at all (without it both
  arms reached the same continue through a thrown lookup).
- Round 3: the last four pinned - the CONSTRUCTOR's field
  initializers (C# :234-240; line 208 was the initial
  rebuildTopicLists, never the add path I had assumed), the
  recursion's load-bearing TYPE guard, and two headless defaults.

**THE BASELINE TRAP, sprung and caught.** The first confirm of the
`isPlayerInside ?? false -> ?? true` mutant reported
CAUGHT_BY_FULL_SUITE at fails=4 - which IS the sandbox baseline, so
it was a survivor wearing a kill's label. The pin gave the partner a
buildingKey that failed the arm's own compare, so the arm answered
false whichever way the default read. Re-pinned with the partner's
key set to the absent-seam default (-1) ON PURPOSE, leaving
isPlayerInside's false as the only thing holding the arm shut:
re-confirmed at fails=5. The verdict string means nothing; only the
count against the CURRENT baseline decides.

Final: **143 kills of 143, 0 survivors, 0 equivalents** - the first
campaign in either arc to close with nothing left to argue.

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

## TK-vi (2026-08-22): THE WINDOW ON THE TREE - SHIPPED

The two pieces TK-v left standing, both of them the same fault in
different clothes: a law that belonged to the engine was being done by
hand in the host.

### The Where-is page is listTopicLocation

DaggerfallTalkWindow's location page is not a directory of buildings -
it is `TalkManager.listTopicLocation`, the list
AssembleTopicListLocation (:3200-3353) builds, and its rows are
ListItems that the question and the answer both take. The port's window
drew the T3c category list instead, which is a different list in four
ways:

- the building types walk in **enum order**, behind
  CheckBuildingTypeInSkipList - so residences, palaces, ships and the
  Specials never appear as groups at all;
- the **quest-residence General section** and the **palace arm** ride a
  shared group variable, appending to whichever group that variable
  last pointed at;
- a **Regional group is appended ALWAYS**, whether or not the town has
  one of anything - it is where "any tavern", "any bank" and the
  knightly orders live;
- every group opens with a **NavigationBack row**, which is the window's
  own back button rather than a topic.

The rows being ListItems is the point: `getQuestionText(listItem, tone)`
latches currentKeySubject/Type/BuildingKey, and
`getAnswerText(listItem)` dispatches on questionType - so the tone gate,
%hnt's direction-or-map fork and %loc's map mark all run where C# runs
them, instead of being re-implemented over a directory entry in the
host. The flat T3c list survives as the no-engine fallback, for a host
with no game data.

### %key, %loc and %fcn were expanding to nothing

The port's talk expansion carried the talk MCP's thirteen overrides and
stopped there. But ExpandRandomTextRecord runs `macroHelper.ExpandMacros
(ref tokens, this)` - the WHOLE MacroHelper table, with TalkManager as
the context - and three of its static handlers read TalkManager's own
fields:

- `%key` -> DialogKeySubject (MacroHelper.cs:1059-1083), a switch on
  CurrentKeySubjectType. Four arms answer CurrentKeySubject, Work goes
  through GetWorkString, QuestTopic prefers CurrentQuestionListItem's
  caption and falls back to the field, and Unset shares C#'s `default:`
  at the empty string.
- `%loc` -> MarkLocationOnMap (:1085-1090). **The side effect lives in
  the macro**: `if (MarkLocationOnMap) MarkKeySubjectLocationOnMap();`
  and then the key subject is returned either way. The flag is raised by
  GetKeySubjectBuildingOnMap for exactly the length of the map-reveal
  record's expansion, which is Nystul's own note on the table row - "it
  seems to return the name of the building and reveal the map only if a
  7332 dialog was chosen".
- `%fcn` -> LocationOfRegionalBuilding (:1097-1100), the town the
  regional answer named.

The port's `expandTalkMacros` answers `''` for a macro it has no handler
for, so all three were being deleted silently: every direction and
map-reveal answer lost its building name, and the map was never marked
from inside the expansion at all. The pipeline already carried every
field the three read - they were three table rows away the whole time.

**The arc's first standing law again, a fifth time.** The host was doing
%loc's job (a hand-rolled `%hnt` fork with its own `discoverBuilding`
call) and the window was doing AssembleTopicListLocation's. Both worked;
neither was the port. A law left with the host is a law broken.

## Standing law

Two of this arc's own, both learned the hard way:

- **A LAW LEFT WITH THE HOST IS A LAW BROKEN.** If C# keeps something
  inside a method, the port keeps it inside that method - the tone
  gate, the %n slot, the tone-reaction cache, the topic-rebuild flag.
  Every one of these was caught by a re-read AFTER the pins were
  written and green, because a seam a host forgets to wire is a seam
  no pin exercises. When a field is C#'s, own it; when it lives in
  another module of the port, reach it through a seam and call it
  from the same place C# does - never keep a second copy.
- **A FIXTURE THAT CANNOT REACH THE STATE A LINE GUARDS IS NOT A TEST
  OF THAT LINE.** TK-ii spot-checked a table and missed its rows;
  TK-iii wrote a pin that read the same constant the code read;
  TK-iv pinned nine guards with fixtures whose index could never sit
  on the bar. The mutation campaign is what finds these, every time,
  which is why the campaign is not optional.

The Quest-Arc doctrines carry over whole: DFU literals in every pin;
kept quirks recorded by C# line; absent seams idle LOUDLY (the
headless charter); one mutation campaign per sandbox with the
baseline re-measured after every sync (THE BASELINE TRAP: the
confirm verdict string is meaningless, only the fails count against
the current baseline decides); equivalents need PROOFS.

## TN1 - THE TALK-NEWS GETTERS (2026-08-28)

Seven seams the macro table and the machine declared and nothing
production-side answered, so %fa/%fae/%fe/%fea/%fnpc/%fpc/%fpa,
%fl1/%fl2/%ol1 and %olf all expanded to the charter's null in every
rumor and news record:

- **The four npcData faction names**. TK-iv computed npcFactionName /
  pcFactionName / allyFactionName / enemyFactionName in every arm of
  getGreetingIndex and recorded them as "the names nobody reads" - a
  claim that was STALE on arrival: TalkManager.cs:1795-1824's getters
  read all four and MacroHelper.cs:965-995 routes seven macros through
  them (with C#'s own asymmetries, %fea reading the ALLY and %fae the
  ENEMY, kept and pinned). world.js mounts them off the live
  npcSession.
- **GetFactionName's HolyOrder arm** (:1815-1822): a Holy Order
  conversation answers the TEMPLE'S deity - Temple.FactionOrderName is
  `parent.deity.ToString()` - resolved through guildVariants.getDivine
  off the building the player is inside; outside a temple the port
  falls to pcFactionName (recorded - C# would be off in GetGuild's
  catch-land).
- **GetLordNameForFaction** (MacroHelper.cs:310-331), the one home in
  systems/talk.js: a first child who is an Individual IS the ruler and
  answers by name; otherwise the ruler is GENERATED - gender from the
  ruler title's parity ("even entries are female"), the name bank from
  the faction's RACE byte (FACTION_RACE_KEYS is FactionFile.cs:609-622;
  Skakmat and Orc default like None), and the classic stream SEEDED
  from rulerNameSeed - high half for the OLD ruler (%ol1), low half
  for the current (%fl1/%fl2), "matched to classic: used to retain the
  same old and new ruler name for each region". The ENGINE-PRNG rule's
  DFRandom arm: srand into the one shared stream.
- **GetOldLeaderFateString** (%olf): the pipeline's own localized
  fates (answerPipeline, TK-iii) - the strings sat shipped and
  unreachable.

Pins: 6 in `test/talknews.test.js` - the lord-name law driven with
expectations computed by seeding the same stream by hand (which kills
a swapped seed half, a flipped parity and a wrong bank each exactly;
and taught its own lesson: the expectation must be computed BEFORE the
call, because the call re-seeds the one shared stream and argument
order evaluates left to right), the FactionRaces table against the C#
enum, the seven macro handlers against a stub world, and the world
mounts source-pinned. audit24_questseams' seven PENDING rows dropped -
removing a row means mounting it. Campaign: 9 mutants, 9 killed.

## IH1 - THE LAST FOUR PENDING SEAMS (2026-08-28)

audit24_questseams' PENDING map is EMPTY of M-X rows. The four that
remained after TN1, mounted:

- **%cbd** (MacroHelper.CurrentBuilding, :849-867): inside a building
  the name is REGENERATED from the building's own nameSeed through
  generateBuildingName with the current location and region; outside
  one the hook answers null and the HANDLER supplies C#'s "[invalid]"
  literal - the world does not spell it.
- **%nt** (MacroHelper.NearbyTavern, :630-642): "just gets a random
  tavern from current location and ignores how near it is" - a uniform
  roll (the ENGINE-PRNG rule's injectable slot) over the talk
  directory's taverns, the localized "tavern" when the location has
  none.
- **Place.isHouseOwned** (Place.cs:1196 -> DaggerfallBankManager
  .IsHouseOwned :140-148): banking.js's own law over the CURRENT
  region's owned-house slot - the quest residence filter stops
  offering the player's own house as a quest site.
- **Place.buildingNameOpts**: townTalk's name bag - and the bag is ONE
  now: nameOpts() extracted out of rebuildDirectory (which consumes
  it), exposed on the api beside the directory, so the quest's
  generated building names and the talk directory's cannot drift.
  The bag literal (regent, bank, palace, temple-child laws) exists
  exactly once and a pin counts it.

Pins: 6 in `test/interiorseams.test.js` (the two macro flows with
C#'s "[invalid]" arm on the handler, the four world mounts and the
one-bag law source-pinned). Campaign: 7 mutants, 7 killed.
