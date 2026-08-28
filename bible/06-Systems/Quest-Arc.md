# Quest-Arc (ACTIVE)

The quest machine - DFU's Questing subsystem ported 1:1 against the
vendored quest pack. Sourcing DECIDED at Q1 (route (a), Mac 2026-08-20,
"lock in and start the quest system"): DFU ships quests as decompiled
`.txt` sources its parser reads - classic's QBN/QRC binaries are a form
DFU itself never parses - so the pack (265 quests + the quest tables)
is vendored at `vendor/dfu-quests` (MIT, provenance-pinned README).
That makes the quest corpus gate the first that runs with NO ARENA2 and
no network anywhere.

## Q1 - THE PARSE LAYER (SHIPPED 2026-08-20)

`src/systems/quest/`, all DFU sources named per file:

- `table.js` - Utility/Table.cs whole: schema/comment/inline-comment/
  string-literal parsing, GetInt's TryParse -1, duplicate keys warn and
  keep the FIRST row.
- `symbol.js` - Symbol.cs + GetInnerSymbolName (wrappers trimmed
  outside in; inner `_` survives: `_one_day_` -> `one_day`).
- `tables.js` - the QuestMachine.Instance table properties as a module
  singleton until Q2 ships the machine; unset tables THROW BY NAME.
- `message.js` - Message.cs: `<ce>` centring (whole-line trim vs
  end-trim), `<--->` variants, Text+formatting token pairs. Macro
  expansion pends the macro slice; the random variant draw is an
  injectable uniform roll (Ledger A engine-PRNG rule).
- `parser.js` - Parser.cs whole: header/QRC/QBN split, fixed message
  types taking ids FROM Quests-StaticMessages, PeekMessageEnd's
  forgotten-blank-line forgiveness, QBN dispatch on the RAW line's
  leading word, global-var link tasks via Quests-GlobalVars, the FIRST
  unrecognized block as the headless startup task and a second one
  throwing, ReadBlock's tab-only trim. Statics (SplitLine/SplitField/
  ParseInt) live here as in the C#.
- `task.js` - Task.cs parse half: Standard/PersistUntil/Variable/
  GlobalVarLink/Headless (NextUID symbol, starts triggered). Body
  lines land in `pendingActionLines` until Q2's action registry
  exists (`setActionFactory` is the seam) - the honest stand-in for
  DFU's per-line "Action not found" log noise, and the Q2 work queue.
- `quest.js` - Quest.cs structure half: uid allocator, the three
  collections with DFU's add semantics (duplicate message/resource
  THROW, duplicate task symbol MERGES actions).
- `clock.js` / `foe.js` / `place.js` / `person.js` / `item.js` - the
  five resource declarations. Clock carries the verbatim time math
  (`.` in the time regex is ANY CHARACTER, bug-for-bug) and the
  flag&16 / flag&1-hack travel arm as `travelTimePending` until Q3
  binds Places; Foe resolves Quests-Foes to a MobileTypes id and
  clamps count 1..8; Place resolves Quests-Places p1/p2/p3
  (CustomParseInt hex) and keeps DFU's invalid-placeType throw, site
  binding pending; Person parses the identification ladder and throws
  where DFU throws; Item parses the five declaration shapes + range.

REGEX NOTE: C# alternations reuse group names across alternatives;
this Node cannot. Multi-alternative patterns are ordered lists through
`matchFirst`, which keeps .NET semantics (leftmost position wins, ties
to pattern order).

Gate: `test/quest.test.js` - all 265 vendored quests parse; M0B00Y16
pinned deep (20 messages, fixed ids from the table, 2 rumour variants,
the 11-resource roster with table-resolved values, 27 tasks - 1
headless triggered, 5 variables); Clock range draws seeded; the DFU
failure modes throw verbatim.

## Q2 - THE MACHINE CORE (SHIPPED 2026-08-20)

- `machine.js` - QuestMachine.cs: the live quest table, the
  brute-force GetActionTemplate registry, scheduled-invoke queue, and
  the tick (invoke -> update -> tombstone -> one-week expiry at 604800
  classic seconds). DFU ticks at 10Hz REAL time while clocks ride
  WORLD time: the host paces tick() by TICKS_PER_SECOND and injects
  nowSeconds. The 64 globals (SAVEVARS.DAT state) live on the machine
  and reach GlobalVarLink tasks through quest.hooks.
- `quest.js` grew the lifecycle half: the Update loop verbatim
  (ticksToEnd countdown, resource Tick, task loop with questBreak
  bail and pending popups between tasks, PostTick), EndQuest's
  two-tick grace + faction rep hook (5/-2), log steps 0-9,
  ShowMessagePopup's oncePerQuest/immediate law, the tombstone.
  Popup DELIVERY is the machine's showPopup hook - the parchment box
  and its 22-line chunking are Q4's UI wiring.
- `task.js` grew Update: the trigger law whole - the FIRST always-on
  trigger is PRIMARY (starts AND stops, S0000977), later ones
  SECONDARY (start only, W0C00Y00); PersistUntil checks its target
  after at least one tick and REARMS while unset (S0000011).
- `clock.js` grew the tick half: whole-second world-time deltas,
  TriggerTask starting the same-named task, StartTimer's "_2place_"
  one-way-trip arm riding the Q3 travel seam (pending loudly).
- `actions.js` - ActionTemplate + the ten world-free actions 1:1
  (StartTask/setvar, ClearTask, UnsetTask, EndQuest, WhenTask with
  DFU's exact eval short-circuits, StartStopTimer, Say, LogMessage,
  RemoveLogMessage, PickOneOf on the quest's injectable roll).

Gate: `test/questmachine.test.js` - a crafted quest end to end
(clock -> questBreak -> two-tick end -> tombstone -> expiry), the
WhenTask law, seeded PickOneOf, permanent drops, the globals store,
and THE COVERAGE PIN: the tranche resolves exactly 3347 of 7235
corpus action lines (46.3%) - each action slice must move it UP.

## QUEST AUDIT I (2026-08-20, pre-merge)

Three lanes: DFU parity line-by-line, JS correctness + vendor
integrity, and a 27-mutation campaign. Everything found is FIXED or
recorded; the corpus gate and all pins stayed green after.

- MUTATIONS: 17/27 killed at first run; every survivor was an
  unpinned law and now has a pin (11 added - header brackets, symbol
  law, <ce> trim, PersistUntil start, secondary always-on, questBreak
  mid-task, oncePerQuest, clock truncation, week expiry, duplicate-
  task merge, popup LIFO). No mutation was killed only by the
  coverage numbers.
- PARITY HIGH 1: Task.SetTriggerValue's REARM-ON-CLEAR was missing -
  a cleared-then-restarted task ran zero actions the second time
  ("clear" exists exactly so tasks re-trigger). Fixed + pinned.
- PARITY HIGH 2: the registry is first-match-wins over UNANCHORED
  patterns, and DFU registers the un-ported When*/Clicked* triggers
  BEFORE the tranche - so Say hijacked "clicked npc _x_ say 1011" (27
  corpus lines) into an unconditional popup and WhenTask built bogus
  evals from "when repute with ..." (S0000999!). GUARDS now stand at
  the C# registry positions and send those lines to
  pendingActionLines; the registry adopted C#'s relative order; the
  coverage pin moved 3347->3297 (the 50 protected lines) and is
  documented as the honest number.
- CORRECTNESS HIGH: the parser<->resource import cycle closed through
  an eval-time `extends` - 7 of 15 modules crashed if imported first;
  Parser statics moved to leaf parseUtils.js, every module now
  imports standalone.
- Also fixed: the action factory rides the parse (was a module global
  owned by the last-constructed machine); machine error-termination
  with the protected-quest spine (S0000999/S0000977/_BRISIEN);
  tombstone completes the quest; C# disposal order; Person atHome
  last-option-wins; symbol Trim nets to '_' alone (the C# DEAD
  Trim('=')/Trim('#') assignments replicated bug-for-bug + repinned);
  popup empty-token early-out; Table dup-column throw, int.TryParse
  sign/int32 surface, index-overload loud throw; parseInt '+'/int32;
  customParseInt malformed-hex throw; TrimEnd('\r') strips all;
  token struct-copies; PersistUntil missing target throws (C# NRE ->
  error termination); a pending-travel clock is HELD, never an
  instant 0s fire. Vendor pack verified byte-identical to upstream
  (265+11 files), no .meta, no ARENA2-shaped content.
- KEPT (recorded, not fixed): getTextTokens' explicit-variant-
  answers-0 quirk (Message.cs:161); WhenTask's Contains-ladder
  operator misclassification; Person's whole-line options scan.

## Q2b-i - THE STATE TRANCHE (SHIPPED 2026-08-20)

The 25 actions that ride RESOURCE STATE, task state, world time and
the machine's hook seams - chosen by walking the coverage backlog (the
pending lines bucketed by owning DFU action over the FULL
RegisterActionTemplates order) and taking everything portable without
the item mint or world binding. Coverage moved 3297 -> 4818 of 7235
corpus action lines (66.6%).

- Trigger conditions: ClickedNpc (268 corpus lines, with the gold
  gate deducting through the player hooks and the otherwise-task),
  ClickedItem (66, DFU's rearm call ships commented out - kept),
  KilledFoe (222, count clamps up to 1), InjuredFoe (172),
  LevelCompleted (12, player level >= N), DailyFrom (25, ALWAYS-ON
  inclusive window - as primary it stops the task outside hours;
  hour/minute via gameDate over nowSeconds).
- Actions: Prompt (102, yes/no through showPrompt - Q2's "Prompt at
  Q4" note superseded by the hook seam; the parchment window itself
  is still Q4), DialogLink (120, with the C# empty-namePlace quirk
  kept verbatim and PINNED), AddDialog (77, its own alternation
  order), ItemUsedDo (80, actionWatching re-raised every tick),
  HideNpc (89) / RestoreNpc (14) / MuteNpc (9, UNMUTES on rearm) /
  DestroyNpc (4), StartQuest (40, S%07d through the machine's data
  seam), DropFace (37) / AddFace (35, saying pops IMMEDIATE),
  DropAsQuestor (36) / AddAsQuestor (21), RestrainFoe (33), RemoveFoe
  (22, missing foe THROWS -> error termination), LegalRepute (14),
  RumorMill (10, a null message passes through), PlayVideo (10,
  ANIM%04d.VID, five digits pends), PlaySound (3, the interval/count
  law with timesPlayed burning on every elapsed check, no
  SetComplete ever; SND resolution host-side - Ledger A row).
- The RESOURCE LIFECYCLE the actions read: QuestResource grew the
  click law (SetPlayerClicked with the muted/destroyed Person
  refusal, RearmPlayerClick, PostTick's UNCONDITIONAL rearm - a
  click lives one tick), the IsHidden setter, and Tick's show/hide
  law gated whole on the scene behaviour (incl. destroyed-Person->
  hidden, which DFU applies only in-scene); Person grew
  isMuted/isDestroyed/isQuestor/displayName (display name pends the
  Q3 Setup chain); Foe grew injured/restrained/killCount tracking;
  Item grew useClicked/actionWatching and the null
  daggerfallUnityItem pending the Q2b-ii mint.
- Quest grew ScheduleClickRearm + the per-task clear (N0B00Y16's
  first-come-first-serve click ownership), the questor registry
  (AddQuestor/DropQuestor with C#'s IsQuestor-left-raised quirk,
  DropAllQuestors from the tombstone), EndQuest's talk scrub and the
  tombstone's talk half (post-quest rumor/questor messages by
  outcome + the rumor/topic scrubs) through the machine hooks;
  QUEST_MESSAGES (QuestMachine.cs:260) lives in quest.js,
  re-exported by machine.js. The machine's nowSeconds contract is
  now DFU year-zero seconds (DaggerfallDateTime.ToSeconds) so
  DailyFrom/PlaySound read DFU's own calendar; nowSeconds rides the
  PARSE opts because PlaySound's create stamps the live clock.
- THE FULL REGISTRY MIRROR: defaultActionTemplates now holds all 82
  RegisterActionTemplates slots in the C# order - a ported action's
  template or a guard carrying the un-ported action's VERBATIM
  pattern (group-stripped). Every corpus line therefore lands
  exactly where DFU's first-match scan sends it, and THE OWNERSHIP
  PIN (questmachine.test.js) deepEquals the per-action resolved
  tally (35 actions) against counts derived independently by running
  the C# patterns in C# order - any future hijack shifts a bucket
  and fails.

Gate: `test/questactions.test.js` (38 pins - the click laws, the gold
gate, the foe tracking, the questor quirks, the DailyFrom window, the
Prompt fork, the PlaySound cadence incl. the busy-source no-restamp,
the DialogLink empty-namePlace quirk, the tombstone talk halves, and
the VERIFY block below) + the moved coverage/ownership pins.

## QUEST AUDIT III (2026-08-20, the Q2b-i verify pass)

Two lanes over the frozen tree: a six-lane adversarial parity re-read
against the DFU C# (every finding tried by TWO independent refuters),
and a 575-mutant automated campaign over src/systems/quest with
survivors re-confirmed against the FULL suite (the coverage-subset
confirm caught three of sixteen suspects being subset artifacts - and
the sandbox's git-less baseline failures nearly inverted the reading:
uniform fails=N is the baseline, only fails>N is a kill).

- FIXED (parity, all now pinned): EndQuest's reputation call dropped
  C#'s propagate=TRUE (Quest.cs:385 - allies +amount/2, enemies
  -amount/2, the faction-tree spread; the hook contract now carries
  the flag and factionRep.js's own default-false signature is the
  documented wiring target); quest-start TALK TOPICS were never
  registered while their tombstone-side scrub WAS wired (the
  addQuestTopics dep now fires between start() and the live table,
  QuestMachine.cs:723); a FAULTING quest tombstoned mid-update-loop
  where C# only collects and removes AFTER every other quest's update
  (the catch now collects; removeQuest tombstones-if-needed then
  deletes, QuestMachine.cs:486,509-512 - hook-call order pinned);
  addResource silently omitted the incoming-questor auto-track
  (Quest.cs:879-881 - dead until Q3's SetupQuestorNPC, live and
  pinned now).
- MUTATIONS: 575 run - 302 caught, 202 survived the subset, 71 on
  lines no test executes. Sixteen suspects confirmed against the full
  suite: three were subset artifacts (really caught), THIRTEEN were
  real unpinned laws and each now has a pin that its one-character
  mutant fails: the two hook ENUMS pinned as literals (the first
  drafts compared against the imported constants - vacuous), the
  allowRearm-false clear law, WhenTask's one-eval guard, the
  secondary-cannot-STOP half of the trigger law, DailyFrom's
  inclusive minutes-bearing lower bound, Prompt's name form, the
  DialogLink/AddDialog triple forms, KilledFoe's saying popping once
  (a triggered task never re-runs plain trigger conditions), the
  GlobalVarLink unset-global default, the week-expiry boundary in
  LITERAL seconds at the strict >, the destroyed-AND-behaviour hide
  gate, fresh-resource cold state, parseInt's int32 rails, and the
  Clock travel-arm operand set.
- KEPT (recorded, not pinned): ClickedNpc's caller-triggered
  short-circuit is DFU's own dead defense (trigger conditions never
  run on a triggered task); Task.hasTriggerConditions has NO consumer
  until Q4's offer flow (test-the-shape says don't pin it);
  the remaining subset survivors are dominated by default-initializer
  and defensive-guard equivalents in Q1 code (parser/table/place) -
  logged in the campaign JSONL for the next audit, not silently
  blessed.

## Q2b-ii - THE ITEM TRANCHE (SHIPPED 2026-08-20)

The mint and its seven consumers, plus the QuestListsManager.
Coverage moved 4818 -> 5831 of 7235 corpus action lines (80.6%);
GiveItem's ownership count was re-derived from the RAW corpus (64 -
the coverage backlog's 63 was that script's own artifact).

- THE MINT (item.js, Item.cs's create ladder verbatim): named
  declarations resolve Quests-Items p1/p2 into the port's item system
  (ITEM_GROUP_NAME_BY_CLASS bakes ItemEnums.cs:27-59; QuestItems was
  hand-added to the generated enum tables, cited); MagicItems and
  Books and the potion shape short-circuit BEFORE the random-subclass
  arm; clothing rolls subclass THEN dye; gold carries the CLASSIC
  REWARD FORMULA with C#'s integer division at every step (level/2+1
  or guild rank+1 with the faction's power, the clamp at 10, the
  region price mod, FightersGuild's fixed-point AlterReward -
  guilds.js grew Guild.AlterReward); every minted item is
  quest-linked and the mint runs AT PARSE (the machine now builds
  hooks BEFORE parsing - DFU parses with the live world). MAGIC.DEF
  arms (magic_item x42 + artifacts x31 in the corpus) mint REAL
  items when a host has registered the file (loot.js grew
  createArtifact - SetArtifact whole, with the ArtifactsSubTypes
  identity flags that retired AUDIT 22 F11's producerless-flags pin -
  and createRegularMagicItem's chosenItem arm) and PEND with
  pendingMagicDef headless, so the no-ARENA2 corpus gate stands
  (ledger row). Book message/value pend the book catalog (the E1
  row); the potion shape is corpus-dead minimal, cited. MakePermanent
  syncs virtual + instance + held copies; Dispose sweeps the
  still-linked item from the player at tombstone.
- THE SEVEN ACTIONS: GivePc (the town/daylight gate + 40..500-tick
  delay on the notify/silently forms, the QuestComplete offer making
  the reward PERMANENT - ReleaseQuestItemForReoffer's TRUE arg - and
  the offerReward loot-window hook), GetItem (release-then-give, the
  gold arm through addGold + the GROUNDED "You receive %s gold
  pieces." Internal_Strings line), TakeItem, HaveItem (NO SetComplete
  - re-checks and re-starts every tick, verbatim), TotingItemAnd-
  ClickedNpc (click + carriesQuestItem, the click consumed, the item
  released), GiveItem (Foe itemQueue - foe.js grew QueueItem - the
  non-Foe arm keeps trying until a scene object exists, verbatim; the
  player copy leaves), MakePermanent. New machine seams: playerGender,
  getGuild, regionPriceAdjustment, isPlayerInTown, addGold,
  addHUDText, giveItemToPlayer, removeItemFromPlayer, playerHasItem,
  carriesQuestItem, releaseQuestItem, makeHeldQuestItemsPermanent,
  offerReward.
- THE QUEST LISTS (questLists.js, QuestListsManager.cs whole minus
  the mod/quest-pack discovery, recorded): the two vendored lists
  parse to 188 filed quests (the dash-commented Oblivion block never
  parses - DFU's own Table law; counts derived independently from
  the raw rows), the guild pool law (membership chars, minReq
  rank-vs-rep at the 10 boundary, the HolyOrder membership fold,
  oneTime spent through the machine's new onQuestStarted event,
  adult behind PlayerNudity), the social law (level-or-rep, N/M/F),
  SelectQuest's injectable draw, GetQuest's precedence, LoadQuest's
  missing-source throw + OneTime stamp; machine grew
  scheduleParsedQuest (C#'s own ScheduleQuest(quest) signature) and
  parseQuestForLists.

Gate: `test/questitems.test.js` (33 pins - the mint arms against DFU
template literals, the gold formula hand-computed through the C#
integer math, the seven action laws, the list laws over both the
vendored and crafted tables) + the moved coverage/ownership pins +
the retired-F11 producer pins in iteminfo.test.js.

## QUEST AUDIT IV (2026-08-20, the Q2b-ii verify pass)

The same two lanes as III over the frozen tree: a five-lane
adversarial parity re-read (21 raw findings, two refuters each, 13
confirmed = 9 distinct) and a 448-mutant campaign (261 caught, 148
subset survivors) with full-suite confirmation - the git-less
sandbox's uniform-baseline trap struck AGAIN and is now a named
hazard: fails == baseline IS survival, only fails > baseline kills.

- FIXED (parity, all pinned): "coins" (class 28) THREW where C# mints
  gold pieces - the Currency enum row joins the hand-added tables
  (the QuestItems gap's twin); quest-minted template items carried NO
  CONDITION (SetItem's hitPoints law; the mint now rides the AUDIT 23
  mintCondition door) and Paintings lost their message identity roll
  (Range(0, 65536), DaggerfallUnityItem.cs:571); createArtifact
  dropped the artifact's own MAGIC.DEF VALUE (it priced at the
  mundane base); the modded "class N template M" form was quest-
  LINKED where C# leaves it unlinked (it must survive quest end);
  foe.queueItem lacked ItemCollection.AddItem's duplicate refusal;
  alterReward applied the FightersGuild bonus to NON-MEMBER records
  (C#'s virtual dispatch = base identity - now gated on the flag);
  InitAtGameStart quests were SCHEDULED where C# STARTS them
  (machine grew startQuestImmediate - QuestMachine.cs:719's own arm -
  and the lists call it); a malformed quest list destroyed the whole
  manager where C# contains failures per list; GUILD_GROUPS gained
  the sixteen GGroupN placeholder names Enum.IsDefined matches.
- QUIRK KEPT + pinned: the Tick invoke loop raises OnQuestStarted
  AGAIN after StartQuest already raised it (QuestMachine.cs:450-451)
  - every SCHEDULED quest fires the event twice and a scheduled
  one-time quest records twice in the accepted list (save state);
  direct starts raise once.
- MUTATIONS: the new-code survivors are pinned (audit commits part
  1/1b - the enum-literal vacuous-pin trap again, the boundary laws,
  the social one-time gate, WhenTask's mid-chain and-or short-
  circuit, Say's name form, DestroyNpc's npc form, Toting's missing-
  person refusal); equivalent mutants recorded (WhenTask's
  isTriggerCondition flip inert while update() is a no-op, the gold
  range gate's || twin); the pre-existing loot/guilds table
  survivors are logged in the campaign JSONL for the next audit.
- REFUTED (recorded): parse-failure folding, minReq int-range,
  selectQuest's null guard, the artifact out-of-range throw shape,
  and the non-member AlterReward HIGH framing (the LOW glue version
  was the accurate one and is fixed above).

## Q3-i - THE PLACE TRANCHE (SHIPPED 2026-08-21)

Site binding whole. Coverage moved 5831 -> 6616 of 7235 corpus action
lines (91.4%); the eight buckets match the DFU-order derivation
exactly (PlaceFoe 224, RevealLocation 193, PlaceNpc 125, PlaceItem
106, PcAt 95, CreateNpcAt 26, DroppedItemAtPlace 8, TeleportPc 8).

- THE SITE LAWS (place.js, Place.cs whole): local collection (the
  block walk over mergeNamedBuildings/makeBuildingKey - the port's
  own RMBLayout laws - with the three wildcard sets, the owned-house
  / guild-faction / Thieves-Guild-42 + Dark-Brotherhood-108 /
  already-assigned exclusions, marker validation, and building names
  - residences draw "The %s Residence" through the name banks with
  C#'s Range(0,1) always-Male fallback quirk kept), remote towns (the
  250/500 dart-throw law), remote dungeons (types 0-16, the
  machine-wide assigned exclusion), remote exteriors, fixed sites
  (p1/p1-1, the 50000 MantellanCrux hardcode, the building block
  walk, the 0xfa magic number), QUEST-MARKER ENUMERATION - the two
  editor-flat records (199.11 spawn / 199.18 item) the world layer
  read but never named, positions (x,-y,z) * GlobalScale, the classic
  markerID = blockPosition + objectPosition - the marker
  selection/assignment law (selected-marker reuse, direct-index
  assignment, the anymarker pool, preference/fallback), and the
  player-at-place checks including PcAt's type forms.
- THE WORLD SEAM (deps.world, contract in machine.js): MapsFile/
  BlocksFile instances + player state; a running host wires it; a
  HEADLESS parse (the corpus gate's charter) leaves sitePending true
  LOUDLY - the travelTimePending precedent, now the place precedent
  too. findQuestLocation lazily indexes locationIds over
  readLocationIdFast (ContentReader.GetQuestLocation's semantics).
- SITELINKS (machine.js): addSiteLink/getSiteLinks (the buildingKey/
  magicNumberIndex zero-wildcard law), hasSiteLink/createSiteLink,
  getAllActiveQuestSites (INCOMPLETE quests only), cullResourceTarget
  with C#'s QUIRKS KEPT: the newPlace parameter is dead (the arriving
  place is pruned then re-added), and a stale link ABORTS the whole
  cull.
- THE EIGHT ACTIONS: PlaceNpc (sitelink + assign + unhide +
  ForceTopicListsUpdate; the individual-atHome ERROR-LOG arm),
  PlaceItem (marker/questmarker/anymarker -> MarkerPreference),
  PlaceFoe, PcAt (the continuous set/clear toggle that NEVER
  completes, the saying once, the "pc at any TYPE" placesTable arm
  with the p1 0/1 gate), RevealLocation (discover + the grounded
  "Discovered the location of %map after studying a map." note),
  TeleportPc (the marker through the seam; the save-resume half is a
  recorded deferral), DroppedItemAtPlace (actionWatching/allowDrop/
  playerDropped), CreateNpcAt (DFU's own documented no-op).
- THE TRAVEL ARM (clock.js travelTimeSeconds over the port's real
  TravelTimeCalculator): cautious-with-cart, the per-place 1440-
  minute floor, the 2.5x return multiplier, the all-places sum; wired
  as quest.travelSeconds/travelSecondsTo, so flag&16 clocks arm at
  parse under a world and stay HELD headless. DFU's parse-order
  sensitivity (a clock sees only EARLIER places) is kept and pinned.

Gate: `test/questplaces.test.js` (32 pins over a CRAFTED world
speaking the port's own MapsFile/BlocksFile shapes) + the moved
coverage/ownership pins.

## QUEST AUDIT V (2026-08-21, the Q3-i verify pass)

The two lanes over the frozen tree: a four-lane adversarial parity
re-read (20 raw findings, two refuters each, 13 confirmed = 6
distinct) and a 451-mutant campaign (198 caught, 135 subset
survivors) with baseline-aware full-suite confirmation.

- FIXED (parity, all pinned): the MARKER STRUCT-COPY law - C#'s
  QuestMarker is a struct, so selecting COPIES it and the normal
  path builds targetResources on the COPY while the pool slots stay
  null; the port aliased the array element and every placement bled
  into the pool (selection now shallow-copies, sharing an
  already-created list reference exactly as a struct copy does);
  SITELINKS NEVER DIED - TombstoneQuest's RemoveAllQuestSiteLinks
  was missing, so a dead quest's link made hasSiteLink lie to the
  next quest at the same site (the sequential-guild-hall case);
  DroppedItemAtPlace lost IsAlwaysOnTriggerCondition (it is the
  PRIMARY always-on when first - a co-resident when/daily demotes to
  start-only); TeleportPc dropped the first-spawn-marker fallback
  (EVERY plain "teleport pc to" lands on spawn[0], and a markerless
  site error-terminates as C#'s NRE does); the AnyMarker pool
  swallowed C#'s AddRange ArgumentNullException at one-type sites
  (a quest DFU kills now dies here too); customParseInt's decimal
  arm truncated trailing garbage and the hex arm missed C#'s
  case-SENSITIVE Replace quirk ('0X1A' throws) - the both-arms
  int.Parse law now holds; the seam contract documented a dead
  travelTimeMinutes dep and omitted the live playerPixel.
- MUTATIONS: 451 run, the survivors triaged in parts 1/1b - the
  enum/wildcard-set literals, the shop/store/house6/fixed-gate/
  DB-ban/dungeon-retry/collector-unit laws, direct marker-index
  assignment, the unhide and transfer tails, the SiteLink
  zero-wildcard law, the two-resource cull, the bare-clock draw, the
  _2place_ arm, the FAR travel literals, PlaceFoe's marker form and
  the zero-clock instant-arm. One drafted pin FAILED against the
  faithful port and caught the AUDITOR's own misreading (WhenTask's
  and-arm peek is provably redundant - left carries true into any
  or-arm); recorded as the equivalent mutant it is.
- REFUTED (recorded): the block-skip silence, TeleportPc's sitelink
  gating, the residence-undiscover note, the float32 multiplier, the
  clock options-slice quirk claim.

## Q3-ii - PERSON WORLD BINDING (SHIPPED 2026-08-21)

The Setup*NPC chain whole. Coverage moved 6616 -> 6912 of 7235
corpus action lines (95.5%); the three buckets match the DFU-order
derivation exactly (ChangeReputeWith 207, CreateNpc 48,
ReputeExceedsDo 41). Pending 323: CreateFoe 241, CastSpellOnFoe 41,
~41 misc.

- THE IDENTIFICATION LADDER (person.js, Person.cs whole): named
  individuals (Quests-Factions p3 -> the persistent faction record;
  a non-Individual/non-Daedra named target THROWS as C# does; a
  FAILED lookup binds the ZERO-FACTION record after Debug.LogError),
  group Questor off the machine's lastNPCClicked seam (factionID +
  nameSeed + gender carried from the click; no click leaves a
  VIRTUAL questor that falls through the career table), careers
  through _getCareerFactionID (p2, p3 when p2<0, the 10000->0
  player-faction fold, the career switch: 0-15 minus 11/14 ->
  Merchants 510, 11 -> Mages 40, 14 -> GenericTemple 450, 16 ->
  Nobles 242, default -> the regional People), factionType through
  _getFactionTypeFactionID with EVERY arm - and C#'s -1 QUIRK KEPT:
  an unstated type assigns Range(0,4), a raw INDEX, as the type.
  _getRandomFactionOfType excludes 450 from Temple draws and THROWS
  on an empty pool.
- THE ASSIGN CHAIN in C#'s order: race from the faction record
  (nameBank = the REGION's bank), gender (questors keep the clicked
  gender - AssignGender skips them; else a 50/50 roll on the
  quest's injectable rolls), the HUD-FACE QUIRK KEPT (the parsed
  face N is IGNORED - AssignHUDFace always rolls Range(0,10)),
  DisplayName (witches/coven 512 force Female; Individual|Daedra
  read the faction record's NAME; else nameSeed -1 draws the
  engine roll per Ledger A, then srand(nameSeed) ->
  fullName(nameBank, gender) - the classic determinism law), and
  AssignHomeTown: questors and at-home individuals configure from
  the PLAYER's location (configureFromPlayerLocation - a Place with
  NO markers), plain individuals get NO home, everyone else builds
  a `Place _N_home_ <scope> <type>` declaration - scope a 50/50
  roll when unstated, the type from the faction row (p1===0 &&
  p2 0..20 && p3===0 -> placesTable getKeyForValue('p2', p2) - the
  Table.cs FIRST-ROW law, so p2=11 answers guildhall not magery),
  the try/catch falling back to 'house'. BOTH arms can throw when
  the town runs dry - real DFU behavior, kept.
- THE SEAM ADDITIONS (deps.world, contract in machine.js):
  getFactionData(id)/findFactionsOfType(type) (the persistent
  faction store), currentRegionFaction/Court/People (the regional
  triple), playerVampireClan/currentRegionRace, plus machine deps
  lastNPCClicked/changeReputation/getReputation. HEADLESS, the
  chain pends LOUDLY (npcPending) - the corpus gate's charter.
- THE THREE ACTIONS: ChangeReputeWith (the PROPAGATING
  changeReputation overload - true as C# passes it; a missing
  person completes silently), ReputeExceedsDo (getReputation <
  min returns without completing; at/above starts the task AND
  completes), CreateNpc (person.placeAtHome() - Person.cs:414:
  sitelink + assignQuestResource + assignedToHome; questors and
  individuals REFUSE; a missing person completes THEN throws).
- The AUDIT-III auto-track went LIVE: an incoming Questor person
  now lands in quest.questors at addResource (Quest.cs:879-881),
  observable at last through the clicked-questor path.

Gate: `test/questpersons.test.js` (12 pins over the crafted world
seam + a persistent-faction-store mock) + the moved coverage/
ownership pins.

## QUEST AUDIT VI (2026-08-21, the Q3-ii verify pass)

The two lanes over the frozen tree: a four-lane adversarial parity
re-read (14 raw findings, two refuters each, 10 confirmed = 4
distinct) and a targeted two-round mutation campaign (round 1: 188
mutants over person.js whole + the exact changed line ranges, 89
subset survivors -> 15 pins; round 2 same-seed: 208 mutants, 27
survivors -> 4 boundary pins + 23 recorded equivalents, the four
kills and two equivalents full-suite-confirmed).

- FIXED (parity, all pinned): C#'s DEAD AssignHomeTown ARM - the
  condition reads the isIndividualAtHome FIELD, which SetResource
  assigns only AFTER AssignHomeTown returns (Person.cs:275 vs :278),
  so an atHome individual NEVER gets a player-location home in DFU;
  the port read the live atHome local and resurrected the arm,
  handing King_of_Worms-class NPCs a home Place DFU never builds
  (now reads the field - the dead arm kept bug-for-bug, questors
  only); the ZERO-FACTION record was wrong - C#'s default struct is
  EVERY int 0, not -1s, so a failed lookup's race 0 reads as
  FactionRaces.Nord and does NOT fall to the region (record
  rebuilt field-for-field, minf/maxf/vam/rank et al included); the
  RACE FOLD was too narrow - GetRaceFromFactionRace maps ONLY -1..7
  and the oddballs (Skakmat 11, Orc 17, Vampire 18, Fey 19) fall
  through to None -> regional (the port folded only -1);
  Person.Tick's AUTO-HOME HOT-PLACE was missing whole - a generated
  home stands dormant until the PLAYER ENTERS it, then the NPC
  places as if "place npc at home" ran, permanently (ported with
  its lastAssignedPlaceSymbol/assignedToHome gates); ChangeReputeWith
  lost allowRearm=false (ChangeReputeWith.cs:33) - a task rearm
  re-fired the reputation move.
- SELF-CATCHES, both directions: the career-table pin draft expected
  Group_4 -> Merchants and FAILED against the port - DFU's own
  switch SKIPS careerID 4 (case 3 jumps to case 5), Group_4 falls to
  the regional People, and the PORT was right; the refuter pairs
  split across lanes on the race fold (one lane confirmed, another
  refuted the same claim) - settled by hand against
  RaceTemplate.cs:109-133, the CONFIRMING lane was right.
- THE BASELINE TRAP, in reverse: the round-2 confirms read fails=5
  as caught until the sandbox baseline was re-measured - the stale
  sandbox Testing.md made the manifest pin a FIFTH baseline failure,
  so fails=5 WAS survival and fails=6 the kill. Re-measure the
  baseline after every sandbox sync, before reading any confirm.
- MUTATIONS: the pins from the campaign - the exact zero record
  (deep-equal), the WHOLE 22-row career table, every factionType arm
  incl. the p3=-1 Range(0,4) quirk exercised LIVE and the P0
  player-vampire-clan arm, the Local_4.10k fold, missing-row
  fallthroughs, faction-512 Female, the gender/scope rolls' strict
  <0.5 boundaries, face Range(0,10), nameSeed Range(0,1000), the
  home-scope forcing law, residence rows vs the house wildcard,
  Table.getKeyForValue's first-row law, the signed repute amount,
  the getReputation 0 default, the three CreateNpc refusals.
  Recorded equivalents: dead stores (ctor atHome), unconsumed
  returns (placeAtHome's bool), the cosmetic case-17..20 fall-through
  labels, corpus-unreachable arms (p2=0 rows all carry p3=0; both
  10000-fold targets land Merchants; the factionType default with
  all 16 types armed), seam-contract ?? fallbacks, and the
  _range(n>1) call-site bound.
- REFUTED (recorded): the vampire-arm NRE claim, the loud-fail
  demand on partial worlds (the seam contract owns it), and the two
  race-fold refutations that lost to the source.

## Q3-iii - FOE SPAWNING (SHIPPED 2026-08-21)

The spawn law whole. Coverage moved 6912 -> 7194 of 7235 corpus
action lines (99.4%); the two buckets match the DFU-order derivation
exactly (CreateFoe 241, CastSpellOnFoe 41). Pending 41 - the Q3-iv
remainder: WhenPcEntersExits 8, WhenReputeWith 8,
WhenNpcIsAvailable 7, CurePcDisease 6, MakePcDiseased 5,
CastSpellDo 3, and DFU's OWN 4-line 'Action not found. Ignoring'
floor (vestigial corpus lines no DFU template matches either).

- THE FOE COMPLETED (foe.js, Foe.cs whole): deathTrigger/kill (the
  behaviour mount zeroes entity health per instance - Q4), the spell
  queue (a plain Add, NO duplicate refusal unlike the item queue;
  never cleared, so future instances of the 1-to-many Foe receive
  every spell queued so far - the per-instance cursor is Q4's),
  getClonedItemQueue (originals stay on the Foe), and SETFOENAME -
  the world half: typeName from the GROUNDED 62-entry enemyNames
  list (Internal_Strings en id 183; index = id for monsters,
  43+id-128 for classes; IsClassEnemyId = the 128 bit), monsters
  drawing a random monster name through classic srand (the
  wall-clock ms seed rides the quest's injectable roll per Ledger A,
  PLUS DFRandom.random_range(1,1000000) from DFRandom's own state,
  verbatim), humanoids rolling gender at 55% MALE then drawing from
  the REGION's name bank. HEADLESS the name half pends LOUDLY
  (namePending) - the npcPending precedent; the table half still
  resolves.
- CREATEFOE (the tick-driven spawn law, CreateFoe.cs whole): four
  parse forms (create-indefinitely / create-N-times / send-N-times /
  send, minutes*60, "send" without a count implies infinite +
  isSendAction, the msg option riding C#'s Substring(match.Length)
  slice - by the match LENGTH regardless of where it began,
  verbatim), the first-update random BACKDATE (Range(0, interval)
  on the injectable rolls - the first spawn lands anywhere within
  one cycle), the interval consumed BEFORE the Dice100 chance roll
  (a failed roll waits out a full cycle), the hidden-foe block
  spending the interval too, missing-Foe and creation-failure
  error-termination, the wave lifecycle (one placement attempt per
  quest tick, a failed placement retried without losing the handle,
  spawnCounter incrementing only after the WHOLE wave deploys, only
  one wave in flight), the send-variant placement gate on
  isPlayerInLocationRect, the msg popup oncePerQuest on the FIRST
  placed foe only, InitialiseOnSet restarting the cycle whole on
  the task-rearm edge, and RaiseOnEncounterEvent riding the pending
  ticks.
- THE SEAM (deps.world, contract in machine.js):
  createFoeGameObjects(foe, count) - GameObjectHelper's mint, one
  opaque handle per pending instance - and tryPlaceFoe(handle) -
  TryPlacement's dispatch + PlaceFoeFreely's raycast ring, true when
  THIS handle stood - plus the optional raiseOnEncounterEvent.
  ABSENT, the law idles (the corpus charter). DEFERRED, one row: the
  exterior-transition/init-world pending-wave invalidation
  (CreateFoe.cs:366-378) and the save envelope's in-flight-wave loss
  ride Q4's host mount.
- CASTSPELLONFOE: the classic id from Quests-Spells at CREATE, the
  custom-key form, and TWO C# QUIRKS KEPT: a table miss LOGS and
  completes the TEMPLATE (a no-op - the minted action still queues
  its all-default spell, classic id 0), and the missing-foe throw
  reads the action's own never-assigned Symbol (C# NREs before the
  format; either way the quest error-terminates).

Gate: `test/questfoes.test.js` (15 pins over the crafted foe seam)
+ the moved coverage/ownership pins (55 actions, 7194/41).

## QUEST AUDIT VII (2026-08-21, the Q3-iii verify pass)

Two lanes, one of them re-routed: the adversarial parity WORKFLOW
was blocked whole by the subagent session limit (all three finder
lanes failed before reading a line), so the parity re-read ran in
the MAIN LOOP against the raw C# - Foe.cs SetResource/SetFoeName,
CreateFoe.cs Update/CreatePendingFoeSpawn/TryPlacement, and
CastSpellOnFoe.cs, each verified arm for arm against the port - with
the multi-agent adversarial pass re-armed for after the limit reset
(a scheduled retry; its findings, if any, will amend this section).

- PARITY (the main-loop re-read): one alignment - CreateFoe's
  missing-foe throw formats the action's own never-assigned Symbol
  in C# (an NRE before the message renders), the same quirk
  CastSpellOnFoe carries; the port's foeSymbol message was tidier
  than the bug and now mirrors it. Everything else held: the Update
  control flow arm for arm, the backdate bounds, the
  interval-before-chance order, Dice100's comparison, the
  SetFoeName branch order and seed composition, the clamp, the
  regex alternation with C#'s duplicate group names split into the
  port's suffixed pairs.
- MUTATIONS: round 1 ran 102 mutants over foe.js whole + the exact
  new action lines - 32 unique subset survivors, and the full-suite
  confirm proved ALL 32 real (the fails=4 output read correctly as
  baseline this time - the trap's third appearance). Eight boundary
  pins followed: the Dice100 equality law (a roll EXACTLY on the
  chance fails; Range(0,100) tops at 99 so 100% never fails),
  indefinitely running forever past the counter, the short-mint
  error-termination, msg-once holding ACROSS actions, the clamp at
  8, the 128-BIT class routing (Imp id 1 stays a monster), the 0.55
  gender boundary, and exact-name determinism through both srand
  chains (Chird-e / Baaliblex). Round 2 same-seed: 104 mutants, the
  14 targeted kills confirmed, 18 survivors RECORDED with proofs:
  the six ctor inits are DEAD STORES (traced live: InitialiseOnSet
  fires on the untriggered->triggered edge BEFORE the first update
  and overwrites lastSpawnTime/spawnCounter - C#'s field
  initializers are equally dead), the msg -1 sentinels are masked
  by ShowMessagePopup's missing-message early return (itself C#
  law), the _range call-site bounds, the setResource overwrites,
  the 1..8 clamp folding count 0 and 1 alike, the pattern digit
  class no corpus spell name exercises, and the monster-seed
  modulus 1000000 UNOBSERVABLE by construction - classic rand() is
  15-bit (max 32767), so rand() % 999999 and % 1000000 are both
  identity.

## Q3-iv - THE REMAINDER SWEEP (SHIPPED 2026-08-21)

THE CORPUS CLOSES: 7194 -> 7231 of 7235 action lines (99.94%); the
six buckets match the DFU-order derivation exactly
(WhenPcEntersExits 8, WhenReputeWith 8, WhenNpcIsAvailable 7,
CurePcDisease 6, MakePcDiseased 5, CastSpellDo 3). The 4 lines left
are DFU's OWN floor - vestigial corpus lines no template in
RegisterActionTemplates matches either ('Action not found.
Ignoring') - permanent by parity, recorded in the coverage pin.

- WHENPCENTERSEXITS: the exterior-type trigger. Only p1=2 rows of
  Quests-Places are legal (else THROW, headless too); 'anywhere'
  carries p2=-1, the wildcard. C# rides PlayerGPS's location-rect
  EVENTS; the port POLLS the same state per checkTrigger - previous
  shifts on each observed change, so enter (None->type) and exit
  (type->None) read identically at tick granularity. The current
  type seeds from the player location at CREATE, so "enters city"
  fires on the STANDING state - DFU behavior, pinned. Headless the
  poll observes None forever.
- WHENNPCISAVAILABLE: the click PULSE - available when the player
  clicks the individual while NO active quest binds a Person of
  that faction; the clickMemory holds the SAME click (identity) from
  re-firing, and every check claims the machine's NEW
  faction-listener slot (addFactionListener first-claim-wins /
  removeFactionListener at dispose; PlayerActivate.StaticNPCClick
  reads the map - :1534, the only consumer in the DFU tree, and
  wired at src/scenes/worldModes.js:451). activeFactionPersons walks NON-COMPLETE quests only -
  completed quests must not lock an NPC out (QuestMachine.cs:1085).
  The non-individual parse throw carries the TEMPLATE-SetComplete
  quirk; its sibling's does not.
- WHENREPUTEWITH: the always-on rep bar over the persistent store's
  LIVE rep field, INCLUSIVE >=; an unknown faction (no record)
  answers false even at a bar of 0 - never 0>=0 (the S0000999
  at-least-0 lines wait for the record, verbatim).
- MAKEPCDISEASED / CUREPCDISEASE over the S18 seams
  (makePcDiseased/cureDisease/endVampirism/endLycanthropy; Q4 wires
  the real system): the Quests-Diseases ids (a miss THROWS,
  headless too), the corpus's one 'saying 1027' tail DROPPED
  verbatim (C#'s pattern has no such group - no popup), and C#'s
  case-insensitive re-test landing 'cure Vampirism' on the
  vampirism arm through the third alternate.
- CASTSPELLDO: starts a task when the player READIES a spell
  matching EVERY classic effect of the named spell (type -1
  skipped; zero real effects completes without firing). C# latches
  the bundle on OnNewReadySpell, and the port LATCHES IT TOO -
  see QUEST AUDIT XIV below, which killed this row's original
  "the port polls world.readiedSpell(), the readied state IS the
  window" equivalence. BOTH miss arms carry the TEMPLATE-SetComplete
  quirk (CastSpellOnFoe's sibling): the minted action idles forever
  with spellID -1 or null effects - which is also exactly the
  HEADLESS stance, since the classic records
  (world.getClassicSpellEffects) need ARENA2.

Gate: `test/questremainder.test.js` (10 pins) + the coverage/
ownership pin at 7231/4 and the P2 guard pin CLOSED (the when-shapes
now resolve to their real owners at the same registry positions -
the ownership transfer the guard charter promised).

## QUEST AUDIT VIII (2026-08-21, the Q3-iv verify pass)

The parity lane ran in the MAIN LOOP by construction this time - the
subagent limit still held, so all five C# action files were read raw
DURING implementation (WhenReputeWith.cs, WhenNpcIsAvailable.cs,
CurePcDisease.cs, MakePcDiseased.cs, CastSpellDo.cs whole, plus
QuestMachine.cs ActiveFactionPersons/AddFactionListener), every arm
ported from source, not summary. The multi-agent adversarial pass
for Q3-iii AND Q3-iv is armed for after the limit reset; findings,
if any, will amend these sections.

- MUTATIONS: 98 mutants over the six new classes + the machine
  surfaces, 24 subset survivors. SIX were real holes, two of them
  genuine DFU laws the first pins missed: the always-on rep bar
  UN-TRIGGERS when reputation drops back below the bar (the primary
  always-on reads the live field BOTH ways), and an ENTERS trigger
  must never fire on an exit transition (the ||-guard in
  HasExitedTarget); plus the create-seed rect-AND-loaded gate, the
  exits-anywhere wildcard arm, the wrong-faction click, and
  activeFactionPersons' faction-AND-person filter. Six pins landed;
  the same-seed round 2 confirmed all six kills and the machine lane
  clean. The 15 remaining survivors are recorded equivalents: FOUR
  are comment-text mutants (the masker mis-scanned a doc block - a
  campaign artifact, behavior-free by definition, noted for the
  tooling), the ctor inits are dead stores (createNew always
  assigns or throws first), the -1 gates are masked by their inner
  null-guards (getFactionData(-1) is null; CastSpellDo's effects
  null-guard), isTriggerCondition-false is dominated by the
  always-on flag (the triggered-update path is the base no-op), and
  the pattern digit class has no corpus witness.

## Q4-i - THE MACRO ENGINE (SHIPPED 2026-08-21)

QuestMacroHelper.cs + QuestMCP.cs + the four resource ExpandMacro
overrides + the MacroHelper subset the quest path routes through
(questMacros.js). Message.getTextTokens now EXPANDS BY DEFAULT, as
DFU's does - message.js's "macro expansion pends the macro slice"
charter CLOSES.

- THE MACRO GRAMMAR: the ordered alternation (____/___/__/_ name
  macros, == faction, =# binding, = details, % context), one macro
  per word, the token being the exact prefix..suffix substring so
  adjacent punctuation survives. KEPT QUIRK: the inner class
  [a-zA-Z0-9.]+ has no underscore - `_one_day_` truncates to
  `_one_` and misses its resource, the raw text stands.
- THE ERROR SHAPES are C#'s own GetValue ladder: table miss ->
  %x[undefined] (the corpus's 14 %G3 + 1 %G1 REALLY render that way
  in DFU - only %G has a capitalized handler), null entry ->
  [unhandled], null answer -> [nullMCP], a NotImplemented source
  falling past the second provider -> [srcDataUnknown]. Headless the
  world-backed handlers answer null and the shapes surface LOUDLY.
- THE QUEST DATA SOURCE (QuestMCP): UID-seeded %n/%fn/%mn (the
  +3457 male offset), %kno's The-trim, the pronoun family off
  lastResourceReferenced (Male default; %G capitalizes; %G2/%G3
  uppercase DO NOT EXIST in DFU's table), %vcn by the person's home
  region, %qdt off the journal's currentLogMessageId (falling to
  quest start), %oth by the questor's FACTION race over TEXT.RSC
  201+id, %god's temple arm and the Range(0,9) divine switch on the
  quest rolls, and %di with C#'s NRE KEPT - LastPlaceReferenced
  .Scope is read BEFORE the null check, and EXACTLY THREE corpus
  messages crash on it (P0B00L01:1014, R0C10Y12:1012,
  R0C11Y03:1011), pinned by id.
- THE STATIC HANDLERS over new seams: %pcn/%pcf (deps.playerName),
  %ra (deps.playerRaceName), %pct falling through the null-MCP arm
  to the PLAYER's name (the C# chain, kept whole), %reg/%crn/%cn
  off the map, the %rn/%rt/%t Province walk
  (findFactionByTypeAndRegion + the ruler-title table 1..12), %nrn
  seeded by rulerNameSeed & 0xffff, %vam's error literal, %jok
  (TEXT.RSC 200), %dat, %pg3.
- THE RESOURCE OVERRIDES: Person (display name; building/town/
  region off the DIALOG place - assigned else home - with the
  literal "BLANK"; the FLATS.CFG caption through world.flatCaption
  with C#'s dead individual-flat arm kept as written; the questor
  FactionMacro answers the QUEST's guild), Place (building/location/
  region names + the older-save regionIndex-0 workaround arm), Item
  (artifact short name, gold stack count, else the long name -
  ResolveItemLongName's material-prefix half rides the inventory
  arc, one convention with the port's shop labels), Foe (the
  INVERSION: _sym_ = TYPE name, =sym_ = display name), Clock
  (ceiling days of starting time; the countdown setting seam).
  Every expansion latches lastResourceReferenced/lastPlaceReferenced
  for the pronoun/%di context, verbatim.
- revealDialogLinks (talk answers + quest popups ONLY) feeds
  hooks.addDialog per resource type on NameMacro1; the grammar pass
  is DefaultGrammarRules' identity, skipped whole. ExpandLetterSignoff
  rides Q4-ii with its consumer (the offer letter).

Gate: `test/questmacros.test.js` - 16 pins: the 3,817-message corpus
expansion with the exact NRE trio and error-shape counts, and the
crafted-world law pins above.

## QUEST AUDIT IX (2026-08-21, the Q4-i verify pass)

The parity lane ran raw-C# in the main loop DURING implementation
(the subagent limit still held): QuestMacroHelper.cs whole,
QuestMCP.cs whole, every handler body extracted verbatim before
porting, GetFlatData/GetRulerTitle/GetLordNameForFaction/
GetRandomFullName read at source. The multi-agent adversarial retry
covers this slice with Q3-iii/Q3-iv when the limit lifts.

- THE CAMPAIGN, with an operational lesson first: a stop that never
  landed left the first run alive while its "recovery" relaunch
  raced the same sandbox - both were wiped and a clean
  single-instance run re-measured from baseline (its numbers then
  matched the first run exactly, proving the first had finished
  before the race; the caution stands anyway - one campaign per
  sandbox, verified stopped before relaunching).
- 180 mutants over the engine + the override ranges: 88 subset
  survivors. The REAL holes: the ENTIRE Item override unpinned
  (18/18 survived - no test had ever expanded an item macro), the
  message DEFAULT arms untested (every pin passed explicit args),
  and the exact Place answers unasserted - which let MACRO_TYPES
  enum drift hide behind reference-based deepEquals, and Place's
  shared case 2/case 3 answer masked it further (only a PERSON
  building-vs-town assert distinguishes). Three pin rounds closed
  them: 12 pins (part 1), 7 sharpened fixtures for MASKED kills
  (part 2 - the reveal message finally carrying a resource macro,
  the undefined-arg variant default, arg-EXACT stubs for
  %oth/%reg/NM4, exact literals Raithi/Baos-i/Cauvin/F'orcten and
  King Gothryd/Saalpki/D'eght-si/Rirhtun pinning both sides of BOTH
  gender coins), and 2 micro-pins (the two-entry %qdt id-match, the
  male %rn seed), the last three full-suite-confirmed. 88 -> 39 ->
  fixture-final.
- RECORDED EQUIVALENTS (36, each with a proof): the STRING-GATE
  family - a non-string expandMacro return is never substituted, so
  every `return false`->true mutant is inert (C#'s bool-out
  contract); the item gold disjunct redundant to the port's own
  Currency-group mint; the clock 86400->86401 ceiling UNREACHABLE -
  no multiple-of-60 clock lands in a distinguishing window (the
  divisibility proof); the ?? -1 -> -2 seam-contract family; the
  out-of-slice quest inits the sweep range grazed; the baked
  FACTION_RACE_KEYS literals (representative killed; key 3 provably
  masked by the Breton default); the fall-through and no-call-site
  tails; place 716's ||-variant save-shape-bounded (the workaround
  round-trips on faithful maps - Q4-iv's envelope revisits).

## Q4-ii - THE OFFER FLOW (SHIPPED 2026-08-21)

DaggerfallQuestOfferWindow.cs whole + DaggerfallQuestPopupWindow.cs's
offer/accept/refuse half + DaggerfallGuildServicePopupWindow.cs's
Quests service (:546-667), headless (offerFlow.js), over the
QuestMachine's own questor-click halves (machine.js) - the
QuestListsManager's draw half goes LIVE end to end, and
guildServiceFlow's FLAGGED Quests arm closes.

- THE QUESTOR CLICK (QuestMachine.cs:888-985, in machine.js):
  setLastNPCClicked stores the click and sweeps EVERY quest's
  Persons - no IsQuestor gate, no QuestComplete skip, both are the
  scan's filters, not the sweep's; isNPCDataEqual is the four-field
  STRUCT identity (hash/mapID/nameSeed/buildingKey; null reads as
  the zero struct, so two unassigned sides ARE equal);
  isLastNPCClickedAnActiveQuestor scans INCOMPLETE quests for a
  questor match and stamps the passed mcp on the ACTIVE quest -
  the guild rides in here, %pct's second provider. The machine's
  own field beats the Q3-ii deps seam, which stays the fallback.
  DELTA (recorded): a never-clicked machine compares the zero
  struct where C# NREs on lastNPCClicked.Data - unreachable
  through the windows, which only open off a click.
- THE PROMPT (CreateMessagePrompt): a YesNo descriptor - tokens at
  default expansion with the variant draw riding quest.rolls
  (Ledger A), no click-anywhere, no cancel; a missing message
  answers null and the offer silently shows NOTHING while the
  drawn quest leaks unstarted, verbatim.
- THE SOCIAL DOOR (offerSocialQuest): the ctor's questor-pool
  removal (deps.removeNpcQuestor) runs BEFORE the active-questor
  bail and is castle-gated; the draw is GetSocialQuest over the
  clicked NPC's factionID/gender + GetReputation + player level;
  NO external MCP (C#'s own `TODO - need to provide an mcp?`); a
  failed draw shows the TEXT.RSC 600 flavour - silenced inside
  castles, as classic.
- THE GUILD DOOR (offerGuildQuest): the Temple deity folds into
  MembershipStatus by NAME (Enum.Parse's throw mirrored:
  `Requested value 'X' was not found.`); the orders home
  reputation on the BUILDING faction, everyone else on
  GetGuildFactionId; rank rides player level under
  IsSatisfyQuestReqByLevel; the member's guild lands as
  quest.externalMCP; questPool.Clear() after ONE offer, whatever
  happened. An unknown guild group's null pool flows through the
  port's null-guarded selectQuest where C# NREs first (recorded
  Q2b-ii).
- THE ANSWER HALF (OfferQuest_OnButtonClick): Yes draws the
  AcceptQuest popup tokens FIRST (pre-start state under them),
  then StartQuest runs immediately; No scrubs the TalkManager
  three ways in C#'s order - info topics, quest rumors, progress
  rumors - then RefuseQuest with exitOnClose FALSE. The popups
  read this.offeredQuest.externalMCP - the FIELD, never the quest
  argument - and carry it as `mcp` for the message box's generic
  second pass (the UI text arc's).
- THE QUEST PICKER (GuildQuestListBox, default off): the
  gettingQuests wait box (the two Internal_Strings literals; %pcf
  rides the generic pass), labels from HEADER-ONLY parses
  (partialParse threads Parser.cs:144 through
  QuestListsManager.loadQuest), the localization override, the
  full parse on pick throwing out uncaught - and C#'s RemoveAt
  BUG replayed exactly: failure pruning walks ORIGINAL indices
  over a shifting list, so a second failure prunes the WRONG row,
  and past the end throws the ArgumentOutOfRangeException mirror.
- ExpandLetterSignoff (QuestMacroHelper.cs:176-264, in
  questMacros.js - Q4-i's deferral closes): the letter item's
  label walks tokens LAST to FIRST and keeps exactly ONE
  non-empty line ("last 2 lines" says the caller's comment; the
  code takes one, bug-for-bug) under `'Letter: '` with C#'s
  trailing space; name/details/faction/context/binding macros
  expand as the message pass does, NameMacro1 ALWAYS reveals (no
  gate), and a location macro swallows its WHOLE word into "..."
  - attached punctuation included. The ItemHelper caller half
  (the parchment long-name arm) rides the inventory arc.
- OUT OF SLICE: the DaedraSummoningService (a separately flagged
  guildServiceFlow arm), the Spymaster arm (a talk-window door -
  TalkToStaticNPC), and the message box's generic MacroHelper
  pass.

Gate: `test/questoffers.test.js` - 25 pins: the click laws, the
prompt shape, both doors with their gates and fold, the scrub
order, the picker with both RemoveAt-bug faces, the destination
flip, and the letter signoff family.

## QUEST AUDIT X (2026-08-21, the Q4-ii verify pass)

The parity lane ran raw-C# in the main loop DURING implementation
(the subagent limit still held; the multi-agent retry covers Q3-iii/
Q3-iv/Q4-i and folds this slice in): DaggerfallQuestOfferWindow.cs
whole, DaggerfallQuestPopupWindow.cs whole (the Daedra half read and
bounded out), the guild popup's Quests region, QuestMachine.cs's
click/prompt region, the QuestListsManager draw half re-read against
the shipped port, ExpandLetterSignoff + Parser.partialParse at
source. One parity refinement landed from the re-read: the accept
popup call rides C#'s exitOnClose DEFAULT (two args), not an
explicit true. One delta recorded in place: the never-clicked
questor scan compares the zero struct where C# NREs - unreachable
through the windows.

- THE CAMPAIGN (one instance, baseline re-measured at 4 before and
  after the sync): 82 mutants over offerFlow.js + the machine's
  Q4-ii region (the new --lines filter, now a committed mutate.mjs
  flag) + the letter signoff + the lists partialParse thread. 63
  died in coverage subsets; 18 subset survivors + 1 uncovered line
  triaged to 12 REAL HOLES, all pinned in round 2: the questor
  scan's isQuestor gate (whose mutant only shows on the null-click
  zero-struct face), first-word letter macros (the w=0 init), the
  Place AND Item letter reveals (the Item arm was the uncovered
  line - no letter test had ever revealed one), the one-character
  signoff line, the social GENDER FOLD (no test had used an M/F
  social row - the === inversion survived untouched), the absent
  player-fact/guild seams all reading ZERO (rep, level twice,
  buildingFactionId, getGuildFactionId - C#'s own defaults), the
  menu-flag ledger, the popup variant draw's -1 (a -2 would fall
  into the explicit-variant zero arm), and the strict past-the-pool
  pick boundary.
- Full-suite confirmation: 17 verified kills at fails=5. One
  round-2 pin needed sharpening first - the guild level-seam row
  had NO quest source, so the levelful mutant's draw THREW into
  selectQuest's catch and answered the same fail step (the
  masked-kill family again: a fixture that cannot tell the arms
  apart pins nothing); loadable, it kills at fails=5.
- RECORDED EQUIVALENTS (2, each with a proof): the letter walk's
  `<`→`<=` - the one-past-end word is undefined, getMacro coerces
  it to the STRING 'undefined' which matches no macro pattern, so
  the extra iteration is a no-op; the rank override's `>`→`>=` -
  the only added case is level === rank, where `rank = level`
  assigns the value it already holds.

## Q4-iii - THE SCENE MOUNT (SHIPPED 2026-08-21)

QuestResourceBehaviour.cs whole + GameObjectHelper.cs's quest half
(AddQuestResourceObjects :903-1163) + PlaceFoeFreely's raycast ring
(CreateFoe.cs:260-345) + the machine's individual-NPC trio
(QuestMachine.cs:1310-1421) + the deferred CreateFoe invalidations +
TeleportPc's two-phase arrival + the Place hot-place/hot-remove tail
- the ENGINE half, headless over adapter seams shaped against the
real hosts (scenes/dungeonContext's foe chain, hostCombat's entity
surface). The LIVE BRIDGE - instantiating the machine in scenes/*,
the real adapters, click/combat routing - re-carves as Q4-v below.

- THE BEHAVIOUR (resourceBehaviour.js): a plain object the host
  drives (update/doClick/notifyDestroyed) instead of a MonoBehaviour,
  with the host handle contract in the header. The Update order
  verbatim: the reload recouple; person hidden/destroyed ->
  SetActive(false) THROUGH the resource's own behaviour; foe hidden
  -> self-destroy; the queues; restrain (setNonHostile once,
  restraintApplied latching even with no motor); the injured check
  BEFORE death with its held-tick RETURN; DeathTrigger's zeroing;
  the isFoeDead kill latch. CastSpellQueue parks on a missing
  effect manager and on EXACT zero health (negative casts), then
  jumps the position to the END - an unresolvable spell is the
  seam's own skip, never retried. AddItemQueue lands clones on the
  corpse container over the live entity. DoClick: the item
  transfer+hide; the individual broadcast ASSIGNS its result (a
  matchless individual OVERWRITES the direct click's true, the
  follow-up-quest bootstrap door) and walks EVERY quest, completed
  ones included. The v1 save shape excludes restraintApplied -
  restraint re-applies after load, C#'s own hole.
- THE MOUNT WALK (sceneMount.js): SiteLinks -> quest -> Place ->
  markers over a scene adapter; the behaviours SNAPSHOT taken once
  per link guards double-injection (safe with the Q3-i struct-copy
  marker law); the dangling quest/Place THROWS verbatim; enableItems
  is C#'s DEAD parameter; foes gate on killCount < spawnCount and
  never stand during a load; placement REARMS the injured trigger
  (the per-wave law). The flat pick: individuals ALWAYS flat1
  whatever the gender, questors wear the clicked NPC's saved
  billboard indices (the NPCData contract grows
  billboardArchiveIndex/billboardRecordIndex), else male flat1 /
  female flat2, split archive = flat >> 7, record = flat & 0x7f.
  The classic marker position: dungeonX/Z * RDB_SIDE + flatPosition.
- THE RING (placeFoeFreely): the FOV + Range(0,4) jitter with the
  side coin (>0.5 = LEFT), the wall-hit arm's cos_normal separation
  (1.25/cos) with the slack gate and Range(0,min(2,slack)) backoff,
  the open-area distance roll, the 4-unit floor probe, the 0.65
  overlap veto at +1.25 - pure math over raycast/overlapSphere
  probe seams; 8/25 wilderness constants published for the bridge.
- THE MACHINE HALVES: isIndividualNPC (faction type; no world seam
  ≙ C#'s null PlayerEntity), isIndividualQuestNPCAtSiteLink (the
  away-from-home walk, log-and-continue on bare links),
  setupIndividualStaticNPC (away -> home copy disabled; else the
  bootstrap behaviour ALWAYS attaches, assigned to the first active
  faction Person); notifyExteriorTransition/notifyInitWorld fan the
  CreateFoe wave invalidations across live AND scheduled quests
  (C# subscribes each action ctor; same population, one door).
- TeleportPc goes TWO-PHASE: respawnPlayerAtSite (GetLocation +
  RespawnPlayer; false retries), the IsRespawning idle, the marker
  landing on the settle tick (indexed marker picked BEFORE the
  respawn, the [0] fallback AFTER, C#'s order), RearmAction
  dropping a pending resume (the desync note). QuestResource's
  behaviour accessor subscribes the destroy uncoupling (C#'s
  property setter law) and the base Tick now drives
  SetActive(!IsHidden) - the Q3 pend closes. Place's assign tail:
  hot-place mounts via world.mountCurrentSiteQuestResources when
  the player is HERE; a behaviour stood where they are NOT
  hot-removes; the missing seam RETURNS and skips both, mirroring
  C#'s missing PlayerEnterExit.

Gate: `test/questscene.test.js` - 39 pins; the TeleportPc pins in
questplaces.test.js rewrite to the two-phase law.

## QUEST AUDIT XI (2026-08-21, the Q4-iii verify pass)

The parity lane ran raw-C# in the main loop DURING implementation
(the subagent limit still held; the multi-agent retry now covers
five slices): QuestResourceBehaviour.cs whole, GameObjectHelper's
quest region whole, CreateFoe's placement half + invalidation
events, TeleportPc.cs whole, QuestMachine's individual region, the
QuestResource property/tick/handler bodies, the Place assign tail -
plus the PORT-side host survey (scenes/dungeonContext's foe chain,
hostCombat, worldModes, the missing machine wiring) that shaped the
adapter seams and forced the Q4-v re-carve.

- THE CAMPAIGN (one instance; baseline re-measured at 4 before and
  after both syncs): 185 mutants over the behaviour, the mount +
  ring, the machine's Q4-iii region, the TeleportPc/CreateFoe-hook
  action lines, the QuestResource accessor/tick, and the Place
  tail. 142 died in coverage subsets; the machine and accessor
  sweeps came back CLEAN. The 43 subset survivors triaged to 33
  REAL HOLES, all pinned in round 2: the cacheTarget miss faces
  (the half-cached second call faking a hit, the poisoned success
  return, the untouched-targetQuest identity gate), the unbound
  behaviour's inert update/false doClick, the strictly-below-max
  injury gate and the <=0-not-<=1 death gate, the foe-never-takes-
  SetActive face of the person arm's &&, the queue drains' FOUR
  null-guard validate arms (each || flip lands on a TypeError), the
  destroy-handler ledger (a stale handler must not null a RECOUPLED
  resource; splice removes exactly one), the individuals-only
  broadcast &&, the save shape's clean isAttackableByAI, the
  mount's wildcard buildingKey default, the ring's constant pins
  (5/20 defaults, the probed 0.65 radius), the side coin's strict >
  at exactly 0.5, zero slack placing at exactly minDistance, the
  straight-down floor probe, the pre-cosine normal normalization,
  the assign default drawing a real marker (a -2 default spreads
  UNDEFINED into selectedMarker, silently), the markerless-site
  throw, configureFromPlayerLocation's unloaded false, and the
  TeleportPc marker boundaries (usingMarker holding the indexed
  arm; index == length falling to [0] through the strict <).
- Full-suite confirmation: 43 mutants re-run against the whole
  suite - 33 kills at fails=5, and the 10 baseline-survivors are
  EXACTLY the 10 argued equivalents, each with a proof: the -1/-2
  negative-sentinel pair (the only consumer is >= 0); the resume
  flag's post-completion deadness (read only before completion or
  after the rearm rewrite); the marker-0 boundary folding both
  arms to spawn marker [0]; the ?? arms reachable only on
  marker-less sites where both faces throw the same mirrored NRE;
  the unsigned-data >>/>>>; the always-array getSiteLinks guard;
  the cos-threshold pair killed by AMPLIFICATION (1.25/cos exceeds
  any in-contract hit distance, so the slack gate re-rejects); and
  the zero-vector-only || divisor.

## Q4-iv - JOURNAL + SAVE (SHIPPED 2026-08-21)

The quest save envelope whole (QuestMachine -> Quest -> Message /
Resource / Task / Action v1 shapes, each in its C# home), the
journal's ACTIVE-page walk (GetAllQuestLogMessages), EndQuest's
notebook filing, and PlayerNotebook.cs whole (systems/notebook.js).
The journal WINDOW's geometry (layout, scrolling, click hit-testing,
the find-place dialog) is the UI arc's; the notebook and the walk
are its whole law half.

- THE ENVELOPE: plain-JSON shapes with C#'s field names, riding the
  port's save.js conventions. Type identities are explicit - the
  resource type derives from the is* flags, every action carries a
  static typeName - because vite's minifier would rename
  constructor.name. Symbols round-trip as {original} (name
  re-derives); SiteDetails/SiteLinks/marker targets round-trip as
  plain data, the shape C#'s serializer writes. The port's SECONDS
  clock stands in for DaggerfallDateTime fields (Ledger A);
  smallerDungeonsState/compiledByVersion serialize at defaults (no
  port counterparts, recorded).
- THE ACTION WALK: a declarative saveShape per class ([[portField,
  kind, savedName?]], kinds raw/sym/symArray) with ONE generic
  implementation - every shipped action's C# GetSaveData/
  RestoreSaveData is a pure field copy (spot-verified: PlaySound,
  WhenTask, DroppedItemAtPlace, CreateFoe), so the walk IS the law;
  one alias (port soundId <-> C# soundIndex). Transients stay out
  exactly where C# leaves them: CreateFoe's in-flight wave,
  TeleportPc's resume, GivePc's offer latch, WhenNpcIsAvailable's
  click memory all reset on load, verbatim.
- KEPT HOLES (C#'s own): rumorsMessageID sits in the resource
  struct, never saved, never restored - loads reset it to the ctor's
  -1; currentLogMessageId/lastResourceReferenced/externalMCP are not
  in the quest shape, so the journal's %qdt context falls to quest
  start after a load; Quest.OneTime is not in the shape either (the
  one-time law survives via oneTimeQuestsAccepted, which C# persists
  in the PLAYER save - a Q4-v wiring row for save.js); the task
  restore ORDER is itself law - IsTriggered restores through
  SetTriggerValue while globalVarLink still holds -1 and dropped
  false, so a load never re-writes the global store and the rearm
  arm fires over an empty action list.
- THE FAILURE LAWS: each quest restores under a per-quest catch -
  an unknown action/resource type (the removed-mod law) warns with
  C#'s message, adds the HUD line, and the load continues; a
  duplicate UID throws into the same catch as Dictionary.Add;
  Person's faction record re-derives from the live store with the
  deserialize throw; RemoveStaleSiteLinks scrubs orphaned links
  after. The uid allocator advances past restored uids (C# persists
  its global NextUID; the port derives from what it loads).
  ReassignLegacyQuestMarkers and the Foe v1->v2 upgrade arm are
  legacy-save migrations with no port-side legacy saves (recorded).
- THE NOTEBOOK (PlayerNotebook.cs whole): notes / finished quests /
  the 50-slot message ring over deps dateTimeString/
  midDateTimeString/cityName; the 70-column wrap breaking at the
  LAST space with C#'s leading-space prefix on EVERY line; the
  noteHeader '{0} in {1}:' and finishQuestHeader '{0} {1} at {2}:'
  literals with completed/ended and the 'Quest' fallback; moveNote's
  destIdx-- law; the page splits at maxLinesSmall*2 / maxLinesQuests*2
  with the finished-quest OVERFLOW QUIRK kept whole (the current
  message refiles HEADERLESS and the final push is unguarded, so an
  empty entry can land); Clear() spares the ring; the ring is NOT in
  the save shape and empties on load; the D:/Q:/A: line encoding
  with the one-joins-two-breaks newline law. EndQuest resolves the
  active log to Message objects and files through the machine's new
  addFinishedQuest hook.

Gate: `test/questsave.test.js` - 29 pins, led by THE CORPUS
ROUND-TRIP GATE (all 265 quests save -> restore -> save to a fixed
point) and the LOCKSTEP TWIN (a restored started quest ticks
identically to its original).

## QUEST AUDIT XII (2026-08-21, the Q4-iv verify pass)

The parity lane ran raw-C# in the main loop DURING implementation
(the multi-agent retry now folds in every main-loop-only slice):
the Quest/QuestMachine/Message/QuestResource/Task serialization
regions whole, the five resource save bodies, QuestAction's envelope
halves, spot-verification that the action restores really are pure
field copies (PlaySound, WhenTask, DroppedItemAtPlace, CreateFoe),
PlayerNotebook.cs whole, and the oneTimeQuestsAccepted persistence
traced to SerializablePlayer (the Q4-v wiring row).

- THE CAMPAIGN (one instance; baseline 4 verified at every sync):
  112 mutants over the notebook, the envelope regions of machine/
  quest/task/message/questResource, the five resource envelopes, and
  the action walk. 49 died in coverage subsets (the task and
  questResource sweeps clean); 63 survivors + uncovered lines
  triaged. THE SWEEP-FIND: the --lines range over place.js grazed
  isPlayerAtBuildingType/isPlayerAtDungeonType (Q3-i surface) and
  exposed their wildcard/guildhall/faction arms as WHOLLY unpinned -
  16 uncovered lines now under direct law pins in questplaces. The
  real holes pinned: the action walk's copy-not-alias law in both
  directions (an !== flip shares live objects with the envelope) and
  its never-null shapes, EndQuest's exact gates (factionId 1
  qualifies; an empty log never files; a re-ended complete quest
  survives the null log), the envelope literals, restored clocks/
  places standing RESOLVED as booleans, the no-clock seam zero, the
  stale-link scrub sparing the neighbour, the notebook literal
  quartet with the exact wrap column (70 stays, 71 breaks, the
  remainder starts one past the space), strict-null index
  boundaries, same-slot and to-the-front moves, the guard arms, the
  page splits at their exact token boundaries, clear() emptying both
  lists, and remove/insert touching exactly one entry.
- Full-suite confirmation: 58 kills at fails=5 across two rounds.
  THE COMPENSATED COUNT (an operational lesson for the masked-kill
  family): the addNoteTokens `=== 0 -> === 1` mutant survived a
  COUNT assert because a second wrong arm compensated - the mutated
  guard let the EMPTY-array call file a spurious header note,
  restoring the count the lone-token call lost; the kill needed a
  CONTENT assert. Counts can be conserved by paired defects;
  contents cannot.
- RECORDED EQUIVALENTS (6, each with a proof): the raw arm's
  `&& -> ||` pair in both walk directions (structuredClone is the
  identity on primitives, so the object-gate flip changes nothing);
  Message's consecutive-text flush arm pair (unreachable through
  loadMessage's strict text/format alternation - the documented C#
  quirk arm); convertEntry's lineBreak init (every entry begins
  with a header or text token); ensureUidAtLeast's `> -> >=` (the
  identity assignment at equality).

## Q4-v - THE HOST BRIDGE (SHIPPED 2026-08-21)

The machine goes LIVE in the hosts - the arc's last slice. One new
module owns the wiring (`scenes/questBridge.js`): it builds the
QuestMachine over the world seam the host composes, the
QuestListsManager over the vendored pack, the offer flow and the
PlayerNotebook, and hands the scenes a small verb set - tick with the
frame, click an NPC, open the Quests service, mount a scene's quest
resources, snapshot/restore the whole envelope. Everything in it is
PURE WIRING over the pinned Q1-Q4 law modules, node-testable with a
mock ctx; `scenes/questData.js` is the browser half of the data seams
(vite raw-glob over vendor/dfu-quests, preloaded once so the machine's
reads stay synchronous - node tests feed fs instead and never import
it).

The law that lives IN the bridge, pinned (questbridge.test.js, 25
after AUDIT XIII's rounds):

- **The NPC-data law** (StaticNPC.cs:210-224, :333-336).
  GetPositionHash is `x ^ y << 2 ^ z >> 2` - the shifts bind tighter
  than the xor, int32 semantics via `|0` (the negative-z arithmetic
  shift and the `y << 2` int32 wrap both pinned). And StaticNPC.cs:218's
  famous precedence quirk kept whole: `nameSeed = (int)position ^
  buildingKey + locationIndex` - C#'s `+` binds TIGHTER than `^`, so
  the seed is position xor the SUM, proven against the
  wrong-precedence value. Gender is `flags & 32` exactly; the
  billboard indices ride along for Q4-iii's questor flat-pick. The
  `position` identity is the block person record's STREAM OFFSET
  (DFU's obj.Position) - `characters/interiorPeople.js` now carries it
  through (the one data-layer touch).
- **QuestMachine.Update's pacing** (QuestMachine.cs:305-320): tick at
  ticksPerSecond=10 of REAL time; the timer resets to ZERO on fire,
  DROPPING the excess - pinned by a fresh sub-interval not firing
  after a cross.
- **IsSatisfyQuestReqByLevel**: base false with EXACTLY two overrides
  - MagesGuild.cs:67 and KnightlyOrder.cs:83 (the offer surface
  composes it from the guild group).
- **ClearState** (QuestMachine.cs:533-546), the missing C# member the
  live load path needed: quests/siteLinks/questsToInvoke/
  lastNPCClicked wipe; the bridge's restore runs it FIRST, which is
  what stands between a quickload and the duplicate-UID
  Dictionary.Add throw. factionListeners survive exactly as C#'s
  dictionary does.
- **The DaggerfallDateTime header strings** (gameDate.js):
  DateTimeString/MidDateTimeString over the en-table literals, format
  quirks kept - the `{5:00}`/`{4:00}` spec lands on the STRING
  MonthName and is dropped (System.String is not IFormattable), the
  day is UNPADDED in DateTimeString but PADDED in MidDateTimeString
  (`{3:00}` on the int), GetSuffix has no teens rule (11 takes 'th').
  The notebook's D: and finished-quest headers read these.
- **The window faces**: tokensToRows (text appends, every formatting
  token breaks - loadMessage's own pairing) and offerBoxes (C#'s
  silent faces - 'close', a null step, a popupless answer - show
  NOTHING; 'fail' boxes the TEXT.RSC record; 'offer' carries YesNo
  with the answer steps recursing through respond). THE END-TO-END
  DOOR pinned over fs-backed seams: list table -> pool -> QuestorOffer
  prompt -> respond(true) -> AcceptQuest popup with the quest LIVE in
  the machine.

The HOST wiring (browser-side, the probe half):

- **world.js** composes the bridge over its REAL objects: the world
  seam (maps/getBlock/currentLocation off the pixel index/the faction
  STORE via ensureFactionRep - never the raw file/playerPixel/
  playerInside off the mode router/changeLegalRep through court.js),
  the item seams over the live inventory (quest-item stamps
  questItem/questUID/questSymbol; releaseQuestItem unequips before
  the sweep), CreateGold's guild surface (guildOfFaction + membership
  + the faction record's power), regionPriceAdjustment through the
  shops' own producer, popups routed to whichever overlay slot is
  LIVE (exterior townTalk / interior mode slot). InitAtGameStart
  fires ONCE when a NEW character finishes chargen - recorded and
  fired by whichever side (chargen, bridge) is ready last;
  OnInitWorld rides the teleport core (fast travel + quickload); the
  quest envelope rides F9/F11 beside `world` in snapshotPlayer (an
  opaque slot; pre-Q4-v saves restore(null) as a no-op).
- **worldModes.js** owns the interior half: EVERY static-NPC click
  stamps LastNPCClicked before the routing decides what opens; the
  `questOffer` service arm boxes the offer flow for the
  ServiceFlowWindow (reputation on the guild's OWN faction, variant
  groups falling back to the hall's building faction); the interior
  mount runs Q4-iii's walk over a host adapter standing quest Persons
  and Items as billboard batches async-filled into the live interior
  context (parented through the same transform as the interior's own
  flats), each stand an activation target routing DoClick at the
  static-NPC reach; behaviours update every modal frame (Unity
  Update runs whatever timeScale is) while the machine's own tick
  freezes under a paused window (PauseGame -> timeScale 0 ->
  deltaTime 0 - the overlay gate reproduces it); teardown notifies
  destruction exactly as OnDestroy does on transition; both exits
  fire notifyExteriorTransition.

RECORDED (the pending seams - each idles LOUDLY, the headless
charter): quest FOES in interiors (standFoe absent - the walk skips
the stand) and the dungeon context's own mount; dungeon-mode popups
(the dungeon overlay slot is not pluggable yet - logged, never lost
silently); the talk seams (rumor/dialog-link/topics - the talk arc);
playVideo; the HUD faces panel; the disease seams; the QuestComplete
loot window (offerReward lands the item directly with a HUD line);
playSound's busy-skip (the one-shot engine has no busy state - every
call reports played); isPlayerInsideCastle false (this host never
stands inside a palace interior). AND THE STANDING CAVEAT: this
environment has no ARENA2, so the browser half is build-verified
(vite clean, the quest chunks emit) but NOT probe-verified - the live
geometry pass (stand positions, the click ray, the offer window over
real art) needs a machine with game data, recorded as the arc's one
open verification.

## QUEST AUDIT XIII (2026-08-21, the Q4-v verify pass)

The bridge slice's adversarial pass, run - like VII through XII - in
the MAIN LOOP against the raw C# (the subagent limit still holds; the
armed trigger's multi-agent retry now lists all seven slices).

**The parity re-read.** Regions walked line-against-line:
StaticNPC.cs (the whole SetLayoutData family, GetPositionHash,
SetRuntimeData's buildingKey), QuestMachine.cs Update + ClearState,
PlayerActivate.cs StaticNPCClick (:1501-1570), GameObjectHelper.cs
AddQuestNPC (:995-1063), Guild.GetReputation, DaggerfallDateTime.cs
(:374-424, :641-652) with the format literals dug out of the
Internal_Strings_en localization asset itself, and
QuestListsManager.InitAtGameStart. THREE findings, fixed and shipped
mid-audit (commit db3fea5):

1. **The faction-listener shutdown arm** (PlayerActivate.cs
   :1530-1535). A quest actively LISTENING on the clicked NPC's
   faction (WhenNpcIsAvailable) shuts down ALL further routing - no
   talk, no service popup. The first wiring stamped the click and
   routed anyway; openStaticNpc now returns after the stamp when
   `machine.factionListeners` holds the faction, C#'s own TODO about
   releasing listeners riding along.
2. **The quest-stand click's LastNPCClicked stamp** (:1521 before the
   behaviour click, with StaticNPC.cs:245-255's peer layout law). A
   quest NPC in DFU is BOTH components - its click stamps the machine
   before DoClick runs. The port's questflat click now stamps the
   derived peer record: the hash from the SCALED marker ints
   truncated ((int) casts), flags 0/32 from the Person's gender, the
   nameSeed with the -1-falls-to-hash arm, buildingKey from the
   runtime data, and mapID never written (this overload leaves it 0).
3. **The load gate on the machine tick** (QuestMachine.cs:310-316).
   Update refuses to tick while SaveLoadManager.LoadInProgress - no
   quest popups while the world is unavailable. The world host's
   exterior tick now holds behind its `_loading` flag.

And one CONFIRMATION the geometry needed: AddQuestNPC positions the
billboard at the marker scene position and raises by HALF THE
BILLBOARD HEIGHT for non-dungeon sites (:1033-1037) - the marker IS
the base in buildings, exactly the convention the port's billboard
batches take, so the adapter passes positions through untouched.
AlignBillboardToGround's 4-unit floor probe stays with the recorded
probe pass.

**The campaign.** 68 single-instance mutants over the node-covered
Q4-v surface - questBridge.js whole, gameDate.js's new header-string
lines, machine.js's clearState, save.js's quest slot (the
worldModes/world host halves are browser-only and belong to the
probe pass; clearState's four statements carry no sites for the
operator set and are held by the direct wipe pins). Round 1: 41
caught, 26 survivors + 1 uncovered site. Round 2 wrote 6 pins - the
all-zeros NPCData struct over empty record AND empty context, the
bare bridge's headless-charter defaults (every `?? 0`/`?? false` ctx
seam in one sweep), the PlayerNudity-off adult row failing the
offer, buildingFactionId's C# zero riding to the variant-group
quest, the pad law truncating fractional clock components, the
mountScene delegation with its zero default (the uncovered site,
closed) - and the full-suite confirmation landed EXACTLY on the
triage: 25 kills at fails=5+ (one at fails=7 - the `| 0` int32 rail
broke three pins at once), 2 survivors at the baseline 4, both
PROVEN equivalents:

- questBridge.js:63 `rawZ ?? 0 -> ?? 1`: the hash's only read of
  rawZ is `z >> 2`, and `1 >> 2 === 0 === 0 >> 2` - for any record
  LACKING rawZ the mutated default is arithmetically invisible.
- questBridge.js:70 `(pn.flags ?? 0) -> (?? 1)` in the gender arm:
  gender reads bit 5 alone, and `1 & 32 === 0 === 0 & 32` - Male
  either way, every path.

Final: 66 kills of 68, 2 equivalents with proofs, 0 unexplained.
save.test additionally pins the quest slot riding the extras
verbatim and the unset clock's minute-zero default.

**Recorded, not widened:** 12 pre-existing eslint `structuredClone`
no-undef errors across the Q4-iv quest files (the lint env lacks the
ES2022 global) - tooling debt from before this slice, left for a
tooling pass rather than smuggled into the arc's last diff.

## QUEST AUDIT XIV (2026-08-22, the seven-slice sweep, wave 1)

The whole-codebase parity audit re-read the quest arc end to end
against the C# rather than against the port's own comments. Its first
`bug`-severity finding was a guard that had never once fired.

**THE SPAM-CLICK GUARD WAS DEAD.** WhenNpcIsAvailable.CheckTrigger:84
is `if (lastClicked == clickMemory) return false;` - and both operands
are `StaticNPC`, a MonoBehaviour. A scene holds exactly ONE StaticNPC
per NPC, so a reference compare there is an IDENTITY compare: it reads
"the player clicked this same NPC again", and it is the whole reason
spamming the same questor does not re-pulse the task. DFU makes you go
click someone else and come back.

The port carries `lastNPCClicked` as an NPCData-shaped OBJECT LITERAL,
and both hosts mint a fresh one at every click - worldModes.js:858's
quest-flat arm builds `{ hash, flags, factionID, nameSeed, gender,
buildingKey, mapID }` inline, and questBridge.clickNpc runs
`staticNpcData(pn, sceneCtx)`. So `lastClicked === this.clickMemory`
could never be true, for any click, ever. The guard was a line of dead
code sitting where a rule belonged, and re-clicking one questor
re-triggered the task on every tick that saw the click.

The fix is the compare the machine ALREADY owns:
`IsNPCDataEqual(a, b)` - hash, mapID, nameSeed, buildingKey, the four
fields DFU itself uses to decide two NPCData refer to one NPC (it is
what matches a questor). Exposed on the hooks table as
`isNPCDataEqual`, consumed in CheckTrigger behind the
`this.clickMemory &&` null guard the reference compare got for free.

**The pin had encoded the bug** - the fifth time in two days. Its
"a fresh click fires again" step built a second `{ factionID: 364 }`
with no hash, no nameSeed, no mapID, no buildingKey; in DFU terms that
is the SAME NPC as the first one, so the assertion demanded exactly the
re-fire the C# forbids. Corrected, not extended: the fixture now names
a real King (hash 111, nameSeed 7, mapID 3, buildingKey 9), asserts a
same-identity re-click is REFUSED, and only a different hash fires.
Verified by reintroduction - restoring `===` fails the pin.

**Standing law, restated:** A PIN THAT RESTATES THE PORT INSTEAD OF THE
SOURCE IS NOT A PIN. And its corollary, earned here: a reference
compare in C# is not noise to be transliterated - ask what one
reference MEANS in that scene before porting `==` to `===`.

### Wave 2 - CreateFoe, CastSpellDo, and the region the player is in

Six more the sweep raised and the re-read confirmed against the C#.

**CreateFoe's `msg` kept the FIRST match.** C# runs
`Regex.Matches` and then `foreach (Match option in options)`,
reassigning `action.msgMessageID` on every hit - so a line carrying two
`msg` options keeps the LAST. The port used a single `.exec`. Now a
`matchAll` loop, one assignment per hit, same as the foreach.

**The backdate draw was CONDITIONAL.** `CreateFoe.cs:110` is
`(uint)UnityEngine.Random.Range(0, spawnInterval)` with no zero guard.
Two things here. First, the overload: `spawnInterval` is a `uint`, and
uint has NO implicit conversion to int, so resolution binds
`Range(FLOAT, float)`, not the int one - the `(uint)` cast then
truncates, landing the same 0..n-1 uniform, so the VALUE was never
wrong. The DRAW was: the port guarded with `n > 0 ?` and `every 0
minutes` is all over the corpus (S0000008, S0000503, M0B21Y19,
N0B00Y16), so every one of those quests skipped a roll DFU spends and
slid its whole stream. `floor(r * 0)` is 0 anyway; the guard bought
nothing and cost the sequence.

**CreateFoe.RestoreSaveData's trailing re-stamp was dropped.** The
port's generic save walk assumes every action's C# restore is a pure
field copy. CreateFoe's is not - it ends with
`if (lastSpawnTime == 0) lastSpawnTime = now;`. A quest saved before
CreateFoe's first Update carries lastSpawnTime 0, and DFU stamps NOW on
load, permanently retiring Update's random backdate: the first wave then
waits a FULL interval and no draw is taken. The port backdated after
every such load - spawning early and spending a roll DFU never spends.
The one non-pure restore in any shipped action, now an override.

**CASTSPELLDO'S LATCH WAS THE HOST'S.** The port polled
`world.readiedSpell()` each update and recorded "the readied state IS
the window" as an equivalence. It is not one. C# holds `lastReadySpell`
as ACTION state, and the host's readied slot and that latch come apart
three ways:
- `AbortReadySpell` (EntityEffectManager.cs:361-365) nulls the host's
  readySpell and raises NOTHING - no OnCastReadySpell. So C#'s latch
  survives an aborted ready and still fires the task on the next tick.
  The poll saw an empty slot and never fired.
- the action subscribes in its CONSTRUCTOR, so a ready that landed
  before the task ever ran is latched and fires on the task's first
  tick.
- a MISMATCH consumes the latch, so C# evaluates one readied bundle
  exactly ONCE; the poll re-tested the same bundle every tick.

The latch is ported. The host now pushes through the machine's
`notifyNewReadySpell` / `notifyCastReadySpell`, the same fan-out door
CreateFoe's transitions ride, and the seam took the bundle it was always
a method on (`spellHasMatchForClassicEffect(bundle, effect)`). Two more
C# quirks came with it: SetComplete UNSUBSCRIBES and RearmAction never
resubscribes - a rearmed CastSpellDo is deaf forever - and the success
arm never clears the latch, so that deaf rearmed action re-fires off a
bundle the player readied a cycle ago. Both pinned.

**CastSpellDo's missing-spell log printed the real id.** C# formats the
unqualified `spellID` inside `CreateNew` - the TEMPLATE's field, never
assigned, always -1. Same family as the never-assigned `Symbol` in the
throw two arms down, which the port already kept.

**LOCATION_TYPE_NONE was -1 where DFRegion.LocationTypes.None is
0xffff.** No Quests-Places p2 reaches 65535 (the table tops out at 23,
with -1 the 'anywhere' wildcard), so both sentinels read identically
through the guards - but the value RIDES THE SAVE, and a sentinel is
only a sentinel if it is the source's.

**THE REGION THE PLAYER IS IN WAS THE LOCATION'S.**
`world.currentRegionIndex()` answered `currentLocation()?.regionIndex ??
-1`. PlayerGPS.CurrentRegionIndex (:165-186) derives from the POLITIC
map at the player's pixel, which answers on EVERY pixel of the world -
the +128 band, 64 for the High Rock sea coast, 105 patched to
Wrothgarian Mountains, everything else clamped to 0. It cannot answer
"no region". The port's version answered -1 across the entire
wilderness, and `getNameBankOfRegion(-1)` is Breton - so every quest
humanoid named outdoors came out Breton whatever province he stood in,
and %fn/%mn, the temple divine, and the region faction lookups all read
the same hole. Now `MapsFile.getRegionIndex(x, y)`, wired at all four
host seams plus `currentRegionName`. Where a location DOES exist the two
agree - `politic === regionIndex + 128` is this file's own law.

Ten mutants, ten kills: every pin was verified by putting its bug back,
including reverting CastSpellDo to the old poll, which takes four of
them down at once.

### Wave 3 - the location rect, and the edge it is read on

**ISPLAYERINLOCATIONRECT WAS "THIS MAP PIXEL HAS A LOCATION".** The
host answered `_musicLoc !== null` and the comment beside it called
that DFU's flag. C#'s own comment at PlayerGPS.cs:687 says otherwise in
as many words: *"Player can be inside a map pixel with location but not
inside location rect"*. The real test (`PlayerLocationRectCheck`,
:668-716) is a WORLD-COORDINATE one against the town's footprint -
the pixel corner shifted by the terrain tile origin, sized by the
exterior's RMB block count - widened by `extraRect = 4096`, one full
city block on every side, "to better match classic". A map pixel is
32768 units across; a 1x1 town plus its slack is 12288. The port was
answering an area up to seven times too large, and every consumer read
it: `when pc enters/exits`, CreateFoe's `send` gate, isPlayerInTown, and
the music director's location context. Ported as
`locationWorldRect` + `isInLocationRect` in streamingWorld.js, over the
`getLocationTerrainTileOrigin` the port already had.

**AND THE TRIGGER READ THE WRONG EDGE.** WhenPcEntersExits polled the
derived location TYPE and shifted `previous` whenever the VALUE moved.
C# writes those two fields from PlayerGPS's OnEnter/OnExitLocationRect
handlers only - on the RECT FLAG's edge. The difference bites when the
flag stands and the type moves under it: the map pixel rolls over to a
neighbouring location whose rect the player is already inside, or the
location stops being Loaded. The value poll invented an exit DFU never
raises. The port now holds `_wasInRect` and runs the two handlers
verbatim - a transient, out of the save shape exactly as
`isPlayerInLocationRect` is out of C#'s SaveData_v1, and SEEDED at
create from the live flag, because a quest that starts inside a town
must not read an enter edge on its first poll.

Both pinned, both verified by putting the old code back - the value
poll fires the phantom exit, and dropping the seed fires a phantom
enter that takes a second existing pin down with it.

### Wave 4 - four dead seams, and two enums the port had been adding together

**THE SEAM GATE, first**, because it is what makes the rest not happen
again. Every action, resource and macro reaches the host through
`world?.x?.()`. That shape is the port's charter - a seam the host
cannot honestly answer stays ABSENT and the law idles - and it is also
a trapdoor: a seam nobody mounts is a ported law that evaporates in
silence, with a green suite. `test/audit24_questseams.test.js` now
reads the source both ways: every `world.x` the quest system calls must
be MOUNTED on questWorld or named in a PENDING table with the reason.
A stale PENDING row (the seam got mounted) and a dead one (nothing
calls it any more) both fail too.

It caught four laws that had never once run:

- **`discoverLocation`** - the corpus carries 193 `reveal` lines. Every
  one of them discovered nothing. Now
  PlayerGPS.DiscoverLocation (:872-890) over
  `maps.getLocationByName`, C#'s own throw included when the pair names
  nothing.
- **`addNote`** - `reveal <place> readmap`'s journal note. The
  notebook has been mounted on the bridge since Q4-iv; the seam just
  never reached it.
- **`currentRegionRace`** - declared in Q3-ii, answered by nobody, so
  every Person whose faction race does not map to a FactionRaces
  0..7 fell to -1 rather than the region's race.
- **`getRandomText`** - %oth's TEXT.RSC read. Nothing answered it, so
  the oath macro expanded to nothing at all.

**AND THE TWO RACE ENUMS WERE BEING ADDED TOGETHER.** `Races`
(EntityEnums: Breton 1, Redguard 2, Nord 3, DarkElf 4 ...) and
`FactionFile.FactionRaces` (Nord 0, Khajiit 1, Redguard 2, Breton 3
... DarkElf 7) disagree in ORDER as well as base. The port already knew
this - `raceFromFactionRace` says so in a comment that ends "*and every
NPC in the game would have taken the wrong race with the suite green*"
- and then three places did it anyway:

- Person had no `race` at all. It kept only `factionRace`, and
  `AssignRace`'s region fallback is `GetRaceOfCurrentRegion()`, a
  RACES - written straight into the FactionRaces field. A region of
  Nords (Races 3) produced FactionRaces 3, which is Breton. And
  `getSaveData` has always written `race: this.race ?? -1`, so the
  envelope's race column has been -1 for every Person ever saved.
  `race` is C#'s own field now and `factionRace` derives from it
  through the new `factionRaceFromRace` (RaceTemplate.cs:142-167,
  written out case by case like its inverse).
- `%oth` mixed all three of its branches - a FactionRaces questor
  field, a Races off NPCData, and whatever the region seam felt like -
  and added each to 201 alike. All three carry a Races now and ONE
  conversion runs at the end, as QuestMCP.Oath (:182-202) does it.
- the talk bundle's `randomText` seam answered
  `lines(id).map(...).join(' ')`. TextProvider.GetRandomText (:250-268)
  picks ONE Text token out of the record's flat pool - it is not a
  variant pick and it is certainly not every line of every variant in
  one breath. `TextRsc.randomTextById` is the real law.

**Two more from the same sweep.** `%di`'s fall-through answered
`'Resolving Error'` - the Internal_Strings KEY, not its value.
Id 425's en text is `...never mind...`, which is what DFU actually
prints when a place will not resolve. And Person's `=symbol_` detail
macro dropped `GetFlatDetailsString`'s fallback: when FLATS.CFG has no
caption for the flat id, DFU answers the RACE NAME, where the port
returned false and left `=symbol_` standing in the sentence. (Its
individual-NPC arm carries a C# quirk worth naming: "Individuals are
always flat1 no matter gender" has no `else`, so the gender branch
overwrites it immediately and an individual female still takes flat2.
The comment is a lie about C#'s own dead assignment; the port writes
what runs.)

Five mutants, five kills, including the naive-offset
`factionRaceFromRace` - which takes six pins down at once.

### Wave 5 - a struct is not a nullable, and the NPCData the hosts mint

**`add <sym> as questor` CRASHED THE TALK TOPIC REBUILD.**
`StaticNPC.NPCData questorData` is a C# **struct field**
(StaticNPC.cs:88-107). There is no null for it: an un-setup questor
holds the all-zero value, every field its type's zero (Genders.Male,
Context.Custom, BankTypes.Breton, and `(Races)0`, which is not even a
member). So C# reads it without a guard, and three port sites copied
that shape faithfully onto a field the port had made nullable -
topicTree's `GetPersonBuildingKey` (:350) and its quest-topic rebuild
(:773), and sceneMount's questor billboard pick (:63).

Every one of them is reachable. `SetupQuestorNPC` is not the only route
to `isQuestor`: `Quest.addQuestor` - the `add <sym> as questor` action -
sets the flag and never touches questorData, exactly as C#'s
Quest.cs:472 does, because there the struct is already in the field. A
quest that names its own questor took a TypeError on the next topic
rebuild. `ZERO_NPC_DATA` is the value C# actually holds, and the ctor,
the restore (including an old envelope carrying null), and both mints
start from it.

**AND THE MINTS CARRIED EIGHT OF THIRTEEN FIELDS.** Both hosts built
their NPCData by hand. `race` was not among them - so
QuestMCP.Oath's clicked-NPC arm, *"used in some of the main quests
before the questor is actually set"* in C#'s own comment, read
undefined and fell through to the region on every main-quest line that
needs it. `SetLayoutData`'s two overloads are ported properly now:
`staticNpcData` for the block-record path and a new `layoutNpcData` for
the direct one, both over the zero struct, both running
`GetRaceFromFaction` with the machine's own faction lookup. worldModes'
hand-rolled literal is gone.

Two mutants, two kills - and one honest non-kill recorded rather than
dressed up: `context: Context.Custom` is 0, which is the struct's zero
too, so the line documents SetLayoutData's intent without changing a
value, and the pin says so.

### Wave 6 - EVERY ALLOCATION HAS AN OWNER, five times over

The bug-hunt half of the sweep read the port as JavaScript rather than
against the C#, and the law it broke most was the port's own.

- **Encounter foes leaked their billboard batch on BOTH ends.** The
  distance cull sets `dead` and the tail splice drops the record -
  taking the only reference to a VAO and two GL buffers with it. Death
  is worse: the record STAYS in `foes` (the splice spares corpses) and
  the live batch sits there unreachable and undead while the corpse
  draws from its own. Encounters respawn on a timer for the whole
  session.
- **City guards, both death paths.** Killed or walked away when the
  crime clears, the live batch was abandoned either way. The `guards`
  ARRAY still cannot be pruned - lootTargets keys corpses by their
  array INDEX and takeLoot reads `guards[i]` straight back, so a splice
  would hand the player someone else's purse - and the pin says so, so
  nobody "fixes" that next.
- **Retired dungeon missiles never left the list.** `retireMissile`
  frees the batch and sets `dead`, and nothing spliced; `updateMissiles`
  then walked the corpse of every arrow and trap bolt, every frame, for
  the whole dungeon. hostMagic has had exactly this line since its own
  slice - the dungeon's sibling loop never got it.
- **The sky panorama cache had no eviction at all.** Each entry's
  `colors` is 1024 x 220 x 4 = 901,120 bytes and the key space is 32 day
  frames plus night PER SKY INDEX, so one region reaches ~29 MB as the
  day turns and every weather or region change starts another. DFU
  keeps no such cache - DaggerfallSky rebuilds on each frame change and
  holds only the current one - so the cache is the port's own speed
  trade and now carries a bound (4, LRU) instead of the source's zero.
- **`forceExitToExterior` destroyed the interior context raw.** No
  `teardownQuestFlats`, no bridge notification, where `tryExit` does
  both and its comment says why: the stands must leave the context's
  batch list FIRST "so ctx.destroy() cannot free them a second time".
  Skipping it left questFlats holding live-looking entries over batches
  the context had already freed, so the next building's teardown
  double-freed them - and every quest behaviour missed its OnDestroy.

**One transliteration, one refutation.** The knockback gate read
`reKnockOk || (!isClass && weight > 0)` where WeaponManager.cs:578-581
writes `(speed <= 5/ratio && isEnemyClass) || Weight > 0` - the
`!isClass` is the port's, a no-op on today's data (every class row
leaves Weight at its struct 0) but not what the source says. And the
NaN reported in `weaponKnockbackSpeed` at weight 0 is **refuted**: C#
produces exactly the same NaN by exactly the same route (float division
by an int zero, `Infinity * 0`, and `NaN < floor` false), and the
caller's gate cannot deliver a zero weight anyway - a class enemy
weighs 240 or 350, and a monster only passes on `weight > 0`.

`test/audit24_lifetimes.test.js` gates all five, and says out loud that
a source-shape pin is a weak pin: these modules need a live WebGL
context to construct and the defect is an ABSENCE. Six mutants, six
kills.

### Wave 7 - two async races, and four switches wired to nothing

**THE ABANDONED PIXEL BUILD PUBLISHED ITSELF.** `buildPixel` awaits a
dozen textures and publishes into `built` only at its very end. If the
player walks far enough during those awaits, the frame loop's streaming
step calls `destroyPixel` for that key - which finds no entry, because
there is none yet - and `state.release`s it. Then the build finishes and
`built.set` publishes a pixel nobody wants: a terrain mesh, a tilemap
texture, its billboard batches, a collider bucket and its doors, with no
unload left to come for them. Walking back rebuilds the key and
OVERWRITES the orphan, leaking all of it. `pump` re-checks
`state.loaded` after the await and tears down what it just built.

**AND THE LOOT PILE HAD THE SAME SHAPE.** `mount(pile)` sets
`pile.batch` in a `.then()`, and all four removal paths - `collectPixel`
with the map pixel, `releaseEmptied` when the loot window closes, and
both restores clearing the set - guard on `p.batch`, which is null for
the whole in-flight window. So all four free nothing, splice the pile
away, and the continuation mints a batch onto an orphan. The dungeon's
missile mount has carried exactly this check since its own audit; the
pile now marks `dead` on removal and the continuation reads it.

**FOUR SWITCHES REACHED NOTHING.**
`ChildGuard/PlayerNudity`, `Enhancements/GuildQuestListBox` and
`GUI/ShowQuestJournalClocksAsCountdown` were hardcoded `false` at the
bridge and absent from the world seam - every one with a live consumer
(questLists' adult filter, offerFlow's list-box arm, clock.js's
countdown) and a launcher toggle the player could flip for nothing.
They are LIVE reads now, GETTERS because C# reads the setting at the
point of use, and the settings tier map's own both-ways gate covers
them from here.

The fourth is `preventNormalizingReputations`, and it is the sharpest.
PlayerEntity.cs:458 reads it, :528-530 clears it,
DaggerfallCourtWindow.cs:474 is the only setter - and the port had
ported the READ alone, so the guard was a constant `true` in one
direction and dead in the other. The prison arm's own comment described
the missing line in as many words: *"it sets
PreventNormalizingReputations across the skip precisely so the elapsed
days cannot decay what it just credited. Harmless while
NormalizeReputations was unported; not harmless now that it is."* A
sentence long enough to cross a 112-day boundary normalized away the
reputation the court had just credited. Both halves are wired, and the
pin drives a real 112-day crossing both ways rather than reading the
source.

**Standing law, restated one more time:** A COMMENT THAT DESCRIBES A
LINE THAT IS NOT THERE IS A BUG WITH A WITNESS.

Six mutants, six kills.

### Wave 8 - two reference compares, a dead provider, and the audit's own bug

**THE AUDIT BROKE SOMETHING AND THE AUDIT CAUGHT IT.** Wave 2's
politic-derived region index shipped as `MapsFile.getRegionIndex` -
colliding with the `getRegionIndex(NAME)` that has been in that class
all along. A JS class body keeps the LAST definition, so the by-name
lookup simply vanished, and `getRegionByName` / `getLocationByName`
began handing a region NAME in as a map pixel x. That took the
`discoverLocation` seam wave 4 had just wired straight back to
answering nothing - 193 corpus `reveal` lines, live for one wave and
dead again the next. **Nothing failed**, because nothing covered
either method; the bug hunt's own read found it. Renamed
`getRegionIndexAt`, and the pin now covers both.

**ISALREADYINJECTED COMPARED NAMES.** `resourceBehaviour.TargetSymbol
== resource.Symbol` (GameObjectHelper.cs:984) is a REFERENCE compare -
Symbol overrides `Equals` and `GetHashCode` and does NOT overload
`operator==`, so `==` on it is object identity, and identity here means
THE SAME RESOURCE (`CacheTarget` assigns the resource's own instance).
The port compared `.name`, and its comment asserted "C# Symbol equality
is name equality" - true of `Equals`, and the wrong member. It matters
because the snapshot is scene-wide, every quest at once, and the corpus
reuses symbol names relentlessly: a second quest's `_king_` collided
with the first's and was silently never stood. This is the wave-1
spam-click bug's twin, down to the wrong-member comment.

A C# quirk rides along and is kept: a RESTORED behaviour holds a
DESERIALIZED Symbol, a different object, so after a load DFU stops
recognising its own resource and stands a duplicate.

**THE CLICK BROADCAST SWEPT DEAD QUESTS.** `ClickAllIndividualNPCs`
opens with `GetAllActiveQuests()` - neither Complete nor Tombstoned
(:849-859). The port walked `machine.quests` whole and the comment above
the loop asserted "EVERY quest in the machine - no complete-skip" as if
that were the source, with a pin that spelled it out
(`q3.questComplete = true;   // even a completed quest's individual
clicks, C#`). A finished quest's King went on answering clicks for the
rest of the session. **The sixth pin in this audit to record the port
instead of the source.**

**%PCT'S SECOND PROVIDER WAS DEAD.** `Quest.ExternalMCP` is an
`IMacroContextProvider` and `Guild` implements it
(Guild.cs:355-380 - GuildTitle and Amount). The port's engine reads a
provider as a `{ quest, source }` bundle, and `source(mcp) =
mcp?.source ?? null` - so the RAW guild the offer flow lent had no
source, and that `?? null` makes a wrong-shaped provider
INDISTINGUISHABLE FROM NO PROVIDER. %pct degraded silently to its
mcp-null arm, the player's name, in all 42 corpus quests that use it: a
guild offer read *"Arkay be with you, Bob Smith."* where DFU says
*"...Curate."* The port already owned the missing piece - `getTitle`,
DFU's `Guild.GetTitle`, which the training window has been using to
expand %pct all along.

Four mutants, four kills.

### Wave 9 - four the bug hunt's own verify pass confirmed with runtime probes

The JS bug hunt finished with an adversarial verify stage - 30 agents,
13 claims refuted (eight of them because the fix had already shipped in
an earlier wave, which is its own confirmation), and these four
confirmed by RUNNING them.

**LOAD GAME BOOTED A NEW GAME.** main.js sets `?load` when the menu
resolves it, under a comment that says *"Load Game rides the dungeon
host's OWN quickLoad"* - true when the classic start booted
`scenes/dungeon.js`, and U31 moved the classic start to `world.js`.
`grep params.has('load')` finds exactly one reader in the whole tree,
and it is dungeon.js. So the flag travelled into a host that never read
it: the player clicked LOAD GAME, got a brand-new character in
Privateer's Hold, and the only route to their save was to start a new
game and press F11. A load takes the classic start's PLACE now, and the
chargen wizard does not mount over the game being resumed.

**AND NEW GAME MOUNTED TWO CHARACTER WIZARDS.** `world.js` mounts one
when `!chargenDone`; the classic start then enters the dungeon, whose
context mounted a SECOND, independently-rolled one. Both were drawn -
the dungeon's, then townTalk's over it - and both were DRIVEN: the two
hosts register separate keydown listeners on the same target and
neither stops propagation, so every arrow and Enter advanced both, and
whichever finished last wrote the character. Different rolled stats,
class and starting kit than the player chose. The classic-start probe
never caught it because it boots with `&class`, which takes the
headless branch in both hosts. The outer host owns chargen now and says
so (`chargen: false`); the standalone dungeon scene keeps its own.

**SPELL MISSILES WERE THE ONE POOL THE RECENTER MISSED.** The
floating-origin block offsets the guards, the encounter foes, the loot
piles and the arrows under a comment reading *"everything else holding
a WORLD position must follow the origin too, or it strands 819.2 units
behind"* - and then listed four of five. A crossing fires an 819.2-unit
shift and a missile lives 8 seconds at 25 units, so mid-flight
crossings are easy: the billboard left the world, the wall raycast
probed the old frame and never hit anything, and the foe sweep compared
a stale position against shifted feet. The spell and its magicka went
silently nowhere.

**A QUEST ITEM STOPPED BEING THE ITEM IN THE PACK.**
`ItemCollection.Contains` and `RemoveItem` look an item up by its UID,
never by reference. The port used `indexOf` and `includes`, and that
identity DOES NOT SURVIVE A LOAD: the player's held record and the Item
resource's `daggerfallUnityItem` are serialised into the envelope
separately and restored separately, so afterwards they are two distinct
objects with equal content and nothing relinks them - contrast
`Person.restoreSaveData`, which re-derives factionData from the live
store for exactly this reason. The tombstone sweep and `give item to`
silently no-opped on every quest item the player was already carrying.
The port has no per-item UID allocator, so the stand-in is the QUEST
identity the sibling hooks already match on, which for a quest item is
what DFU's UID lookup resolves; object identity is still tried first.

Four mutants, four kills.

### Wave 10 - the parity sweep's tail

**PARSEQUEST HAD NO CATCH.** `QuestMachine.ParseQuest` wraps the whole
parse in `try { ... } catch (Exception ex) { LogFormat("Parsing quest
{0} FAILED!..."); return null; }` (:670-687). The port's had none - so a
quest whose QBN the parser chokes on threw out of the guild picker
instead of answering null, and `questLists.loadQuest` already carried
the `if (!quest) return null;` arm C# feeds it, sitting unreachable. One
broken row took the whole guild quest list with it where DFU drops that
row and offers the rest. The pin that had recorded the throw is the
SEVENTH in this audit to describe the port instead of the source: the
pick's `LoadQuest` call IS uncaught, but LoadQuest reaches ParseQuest,
so a broken QBN lands `offeredQuest = null` and OfferQuest apologises.
Only a missing FILE throws.

**TELEPORTPC WITHHELD ITS SITELINK.** C#'s order is: respawning check,
resume, CreateSiteLink, GetPlace, marker pick, respawn. The port's
transport-seam guard sat at the TOP, above the SiteLink write - so on a
host that has not mounted `respawnPlayerAtSite` (which is today's port,
a declared pending) the link was never created, where C# writes it every
tick regardless of what the transport does. The SiteLink is machine
state other actions read; it is not the transport's to withhold. And the
marker-array read lost its `?? 0`: C# reads
`place.SiteDetails.questSpawnMarkers.Length` unguarded, so a null array
NREs before any respawn - the port's guard sent it down the
usingMarker=false path, respawned the player, and only then threw on
`[0]`, leaving a teleport half-done.

**A LATE DESTROY EVENT COULD NULL A RECOUPLED LINK.** C#'s
`QuestResourceBehaviour_OnGameObjectDestroy` writes
`questResourceBehaviour = null;` - and its PARAMETER is named
`questResourceBehaviour` too, so the assignment lands on the shadowing
local and the FIELD IS NEVER CLEARED. It reads as cleared anyway,
because a destroyed MonoBehaviour compares `== null` under Unity's
fake-null, which is why the port clears it and why that stays. What does
not stay is clearing it BLINDLY: a resource already recoupled to a new
behaviour had its live link nulled by the old one's late destroy event,
and C# cannot do that because its assignment never reaches the field.
Guarded on identity.

Three mutants, three kills.

### Wave 11 - a field C# gets for free, a lifecycle Unity gets for free

**A RESTORED PLAYSOUND WENT NaN AND NEVER PLAYED AGAIN.** `int
timesPlayed;` is a C# FIELD, so it is 0 before anything touches it - and
C# is right not to save it (SaveData_v1 carries the other six). The port
set it only in `createNew` and `rearmAction`, and a restore mints the
action through its `(Quest)` constructor and then walks `saveShape`,
which correctly omits it. So `this.timesPlayed++` ran on `undefined`,
`NaN <= count` was false, and the sound went silent for the rest of the
save. A gate now sweeps every action class for the same shape - a field
assigned in createNew, read elsewhere, in neither the constructor nor
the save shape. PlaySound was the only one, and it is declared now.

**THE BOOTSTRAP BEHAVIOUR WAS NEVER STARTED.**
`SetupIndividualStaticNPC` mints a QuestResourceBehaviour for EVERY
individual NPC - "required to bootstrap quest as often questor is not
set until after player clicks resource". C# gets `Start()` for free:
AddComponent schedules it and Unity runs it on the next frame, AFTER
the AssignResource, which is exactly why
`QuestResourceBehaviour.Start` warns *"This will fail if targetQuest and
targetSymbol are not set before Start()"*. The port's stand-in for that
lifecycle is an explicit `start()`, which sceneMount calls at all three
of its mints and this one did not - so the behaviour came back
permanently uncached, `targetResource` null, and the bootstrap click it
exists to carry could not resolve.

**THE JOURNAL DREW EVERYTHING IN ONE COLOUR.**
`MultiFormatTextLabel.SetText` (:355-371) gives each token's label its
own colour by formatting: TextHighlight takes HighlightColor
(219,130,40), TextQuestion and TextAnswer their own two - and Answer is
`DaggerfallDefaultInputTextColor` (227,223,0), *not* the default text
colour, so a naive "highlight is just brighter" would have collapsed
them. `pageLines` flattened all five to bare strings, so the notebook's
date/city headers, the finished-quest headers and the whole talk-arc
Q&A drew in the default yellow. Rows carry their colour now.

And the four page TITLES are Internal_Strings_en's own (ids 628, 630,
632, 634) - two of them were the port's sentence case where the table
title-cases both words.

Three mutants, three kills; the title change is a string the gate reads
rather than a behaviour a mutant can flip.

### Wave 12 - the same trapdoor, one seam surface over

Wave 4's seam gate covered `deps.world`. The BRIDGE's own `ctx` surface
has the identical shape - every read is `ctx.x?.()` - and the identical
hole.

**REMOVENPCQUESTOR WAS NEVER CALLED.** It is the offer window's ONE
constructor side effect (DaggerfallQuestOfferWindow.cs:35), and
`npcSession.removeNpcQuestor` has carried it since TK-iv. Nothing
called it. So a townsperson who was offered work stayed in
`npcsWithWork` for ever, and re-offered the same quest every time the
player talked to them - the offer flow's own header says the potential
questor "leaves the work pool BEFORE the offer resolves", and it never
left.

**AND THE TWO DISEASE SEAMS.** `makePcDiseased` and `cureDisease` were
declared in Q3-iv over an S18 system that shipped in its own slice, and
mounted to nothing - so `make pc diseased` and `cure <disease>` were
silent for every quest that used them.

The gate now reads both surfaces, both ways: every `ctx.x` the bridge
reaches for must be SUPPLIED or named in a PENDING table with a reason,
and a stale row (the seam got mounted) or a dead one (nothing reads it)
fails too. Five rows stand, honestly: the two vampirism/lycanthropy ends
have no racial-effect system to reach, the HUD escorting faces have no
surface, and `onQuestStarted` is an OPTIONAL host listener - the bridge
already fans RaiseOnQuestStartedEvent to the QuestListsManager's
one-time recording itself.

One mutant, one kill.

### Wave 13 - the one file the mutation campaign could not kill

The campaign over every line range AUDIT 24 touched came back with 44
files and exactly one at **0 of 8 caught**: `src/systems/loot.js`. Every
survivor was a DATA TABLE constant flipped by one - a LootChanceMatrix
cell, an ingredient template index.

That is the shape a transcription typo takes, and no behavioural test
finds it. A wrong 10 for an 11 still produces loot; it just produces the
wrong loot, silently, for ever. Twenty-one rows of fifteen cells is 315
chances to have mistyped one, and nothing in the suite would have said
so.

The only pin that catches that class is one that REBUILDS the table from
the source, which is the idiom `audit24_systems2.test.js` already uses
for MAGIC_ONLY_KEYS. `test/audit24_loottables.test.js` parses all 21
`new LootChanceMatrix()` rows out of LootTables.cs and compares them
cell for cell, and parses the nine ingredient enums out of ItemEnums.cs
and compares them in order. It skips wherever the gitignored DFU tree is
absent - the same charter the ARENA2-backed pins run under.

Three cell mutants, three kills.

**Standing law:** A TABLE TRANSCRIBED BY HAND NEEDS A PIN THAT READS THE
SOURCE, NOT A PIN THAT READS THE TABLE.

### Wave 14 - the save file's own survivors

The campaign left five live mutants in `src/systems/save.js` - the file
that decides whether a loaded character is the character who was saved.
Every one is a law with a comment above it and no test under it:

- `restoreFactionRep`'s TWO RETURNS. They are the caller's only signal
  that the rep half of a load happened at all; a restore that quietly
  answered `true` on a missing store would lose every faction standing
  in the save with nothing said. (And an id the rebuilt store no longer
  has is SKIPPED, not invented - the store comes from FACTION.TXT.)
- The pre-S15 FATIGUE DEFAULT, `(Str + End) x 64`. 64 is MaxFatigue's
  own multiplier: at 65 a loaded character opens over-rested and the
  first tick clamps them back, at 63 under. And it applies only to a
  MISSING field - a save that carries fatigue keeps its own number.
- The pre-17f GOLD-STACK UPGRADE, gated on an AND of two conditions.
  Both matter: an OR would rewrite an already-indexed stack (losing a
  real index) and every index-less item of any group. Without the
  upgrade at all, a restored index-less stack grows a SECOND gold stack
  the next time gold is added, and `goldAmount` only ever finds the
  first.
- The LIGHT-SOURCE relink, to the RESTORED record rather than a
  reference into the array the load just discarded - with a missing
  index reading as NOTHING lit, not as `items[0]`.

The fifth is recorded as an **EQUIVALENT MUTANT** rather than dressed
up. Flipping `?? -1` to `?? -2` changes nothing any test can see: the
only reader is `li >= 0`, so every negative behaves identically. -1 is
the value because it is the sentinel the rest of the port writes, not
because anything can tell. The pin says so, and asserts -99 reads the
same, so a future reader does not go hunting for the missing coverage.

Four mutants, four kills, one honest equivalent.

### Wave 15 - the knockback arm nobody had ever swum through

Four of `enemyMotor.js`'s five surviving mutants sat in one place: the
KNOCKBACK SWIMMER ARM - a foe that swims, in water, being shoved. The
suite had a knocked walker, a knocked flyer, and a swimming fish, and
never once a knocked swimmer.

Pinned now, and each half of it matters:

- the STORE cap clamps on the way IN (500 classic is written down to
  40, so the decay always ends in the same eight ticks) and the MOTION
  cap is a SEPARATE `Math.min` on the way out - a stored 40 still moves
  at 25, which is what stops a huge hit teleporting the foe. Flipping
  that `Math.min` to `Math.max` was a live mutant.
- a submerged swimmer is shoved along the ray, and an UPWARD ray is cut
  to zero once the head would break the surface. The gate is read
  BEFORE the move, so the last permitted step still lands a full
  frame's rise past it - C#'s own WaterMove shape, and the pin bounds
  the overshoot at one frame at the motion cap rather than pretending
  it does not happen.
- the arm is skipped entirely with no water AND with the centre above a
  real surface. That second case is the half of the `&&` the no-water
  fixture cannot reach, and it took a second fixture to kill the
  `|| ` mutant.

The fifth is another honest **EQUIVALENT MUTANT**: the store cap's `>`
flipped to `>=` assigns the same value at exactly the cap, and always
will. Recorded in the pin, not papered over.

Four mutants, four kills, one equivalent.

### Wave 16 - a pin that tested far enough either side to feel nothing

The swim surface clamp had a pin - AUDIT 24 wrote it - and the campaign
left BOTH of that line's constants alive anyway. The reason is worth
naming: the pin tested feet 99.30 (refused) and 99.10 (rises), and the
float point is 99.23. Shift the point by a centimetre and both
assertions still pass. **A pin that brackets a boundary loosely does not
pin the boundary.**

The boundary is DERIVED now, from the rule itself -
`feet + height/2 + 50 * GlobalScale - 0.93 >= surface`, which for a
force-crouched swimmer under a surface at 100 is exactly 99.23 - and the
band that separates the 50 constant from a 51 is tested directly. That
mutant dies.

The `>=`-to-`>` flip is recorded as an honest **NON-KILL**. The two
differ only where the sum lands exactly on the surface, one float wide,
and at that point the rise measures zero either way through the motor's
public update. The pin says so and asserts the derived boundary really
is exact, so the next reader knows the arm is reachable and simply not
distinguishable from outside.

One mutant, one kill, one recorded non-kill.

### Wave 17 - three pins that had to be aimed at the seam

`playerWeapon.js`'s gesture door had four survivors, and the first pass
at all four missed - which is the lesson, so it is written down.

- **The bow's RISE edge.** `held && !this._bowHeld` is what makes one
  press one arrow. A first pin held the button for thirty frames and
  saw nothing extra - because the ~1.33s BOW COOLDOWN masks a missing
  edge for the first second all by itself. Held past the cooldown, an
  `||` there is a machine gun.
- **The direction angle.** `atan2 * 180 / Math.PI`. A 181 rotates every
  band by half a percent, which is invisible at a cardinal and decisive
  at a SEAM - and the bands are 15-degree sectors, so the pin aims at
  14.95 degrees, just under the Right/Up boundary, where 180 says Right
  and 181 says Up.
- **The gesture clear.** A clear that left 1 behind fires every swing
  one pixel early, for ever. Pinned at 59.5px of trail against the 60px
  gate, so the leftover decides.

The fourth is an honest **NON-KILL**: the tracking-start clear's `!`
cannot be witnessed, because the un-held branch one line above already
clears on every frame the button is up. It is kept because C# keeps it,
and the pin says exactly that.

**Standing law, third time in three waves:** A PIN AIMED AT THE MIDDLE
OF A BAND TELLS YOU NOTHING ABOUT ITS EDGE.

Three mutants, three kills, one recorded non-kill.

### Wave 18 - a new character started no quests at all

**THE MAIN QUEST NEVER BEGAN.** StartGameBehaviour.cs:444-456 starts
THREE things on a new character:

```
QuestMachine.Instance.StartQuest("_TUTOR__");
QuestMachine.Instance.StartQuest("_BRISIEN");
...
GameManager.Instance.QuestListsManager.InitAtGameStartQuests();
```

The port called only the third. And with vanilla tables the
InitAtGameStart list is EMPTY - so a new character started no quests
whatsoever: no tutorial, and `_BRISIEN`, the main quest's first quest,
never ran. Both files have been sitting in `vendor/dfu-quests/Quests/`
the whole time and neither had ever been parsed. `startQuestByName` is
QuestMachine.cs:705-713's own arm, and the pin drives the real bridge
over the real pack and asserts both start, in order, live in the
machine. (The optional `LaunchQuest` between them has no port-side
setter and is recorded rather than invented.)

**AND THE SOCIAL QUESTOR POOL IS DEAD, LOUDLY NOW.** C# populates
`npcsWithWork` inside `GetBuildingList` (:2751-2876). The port split the
POLICY into `buildQuestorPool` and the host's building-list seam answers
only `{name, buildingType, buildingKey, position}` - it has no
per-building NPC records to hand in, so nothing calls it. `npcsWithWork`
is always empty, `WorkAvailable` is always false, and worldModes'
questOffer arm is unreachable: no townsperson ever has "any work". The
missing half is a HOST slice (the exterior block walk's person records
grouped by building), not a policy change, so it is FLAGGED rather than
guessed at - dead and loud instead of dead and silent.

**One more region read fixed:** `nameBankOfCurrentRegion` was still on
`currentLocation().regionIndex`, the -1-across-the-wilderness value
waves 2 and 4 chased out of every other region seam.

One mutant, one kill.

### Wave 19 - a frozen tab, a lost main quest, and two dead enums

**THE NOTEBOOK WRAP SPUN FOR EVER WHERE C# THROWS.**
`WrapLinesIntoNote` breaks on the last space at or before column 70.
`LastIndexOf` answers -1 when the first 71 characters carry no space,
and C#'s `Substring(0, -1)` is an ArgumentOutOfRangeException - DFU
shows an exception. In JS `slice(0, -1)` is a legal "drop the last
character" and `slice(0)` is the SAME STRING, so the loop made no
progress and spun: **a frozen tab**. A 71-character unbroken run is
easy to reach - a long quest name, a pasted token, any note the player
types.

Its pin had to be built differently, and the test says so: a
SYNCHRONOUS infinite loop is the one defect a behavioural pin cannot
catch, because the pin never returns, node's per-test timeout never
fires (the event loop gets no turn), and the whole suite hangs with no
output instead of going red. So the source shape is asserted FIRST,
before the call that would hang.

**THE 64 GLOBALS WERE IN NO ENVELOPE AT ALL.** DFU keeps them on
`PlayerEntity.GlobalVars` and serialises them with the PLAYER
(SerializablePlayer.cs:134, :303). The port homed them on the machine,
where `getSaveData` wrote two keys and `clearState` wiped four - and
this store was in NEITHER. Every SAVEVARS.DAT flag a quest had set, the
main quest's own progress among them, was lost on save and reset to
false on load. They ride the envelope now, survive a `clearState`
exactly as C#'s do (its ClearState wipes the machine's own four
collections; the globals live elsewhere and the player restore replaces
them wholesale), and an old save does not blank them.

**TWO DEAD ENUMS.**
- `NPCData.context` is a NUMBER - StaticNPC.Context, Custom 0 /
  Dungeon 1 / Building 2. Every writer stamps one and topicTree's
  castle-questor test, the ONLY reader, compared it against the STRING
  `'dungeon'`. It could never be true, so that whole branch was dead -
  and the pin carried the strings too, which is why it never said so.
  The building mint stamps Context.Building now (StaticNPC.cs:178),
  which is what it always should have; a dungeon caller passes Dungeon.
- `GetRaceFromFaction` IGNORES `GetFactionData`'s bool (:362) and reads
  the `out` struct regardless - and a MISS leaves that struct at its
  default, whose `race` field is 0, which maps to FactionRaces.Nord. So
  an unresolvable faction id answers **Nord** in DFU, not the region's
  race; only a faction whose race really maps to None falls through.
  The port read `fd?.race` as undefined and sent every unknown id to
  the region, which agrees only when the region happens to be Nord -
  which is exactly what the old pin's fixture used.

Four mutants, four kills.

### Wave 20

**The click that never reached the quest, and the behaviour that was
never there to reach.**

`PlayerActivate.StaticNPCClick` (:1512-1570) does exactly three things
before it will consider routing a click anywhere:

```csharp
QuestMachine.Instance.LastNPCClicked = npc;

QuestResourceBehaviour questResourceBehaviour = npc.gameObject.GetComponent<QuestResourceBehaviour>();
if (questResourceBehaviour && TriggerQuestResourceBehaviourClick(questResourceBehaviour))
    return;

if (QuestMachine.Instance.HasFactionListener(npc.Data.factionID))
    return;
```

The port had the first line and the third. The middle one - the one
that ends the activation when the click landed on a live quest
resource - was not there, so a clicked questor got their quest
progressed AND their shop opened, their guild service popup pushed,
their conversation started. DFU stops dead.

The order matters twice over. `DoClick` has to see the stamp already
in the machine, and the resource click has to beat the listener
return, or a questor who is also a `WhenNpcIsAvailable` target never
gets clicked at all.

That was the finding. What made it interesting is that the missing
return could not have fired even if I had written it, because the
thing it tests never existed:

```csharp
// DaggerfallInterior.AddPeople, :1224 - the last act on every person it stands
QuestMachine.Instance.SetupIndividualStaticNPC(go, obj.FactionID);
```

`setupIndividualStaticNPC` shipped in Q4-iii. It is a careful port -
it has the away-copy `SetActive(false)`, it has the
always-attach-a-behaviour bootstrap arm with C#'s own comment about
the questor not being set until after the player clicks, and wave 12
even fixed its missing `start()`. It had **no caller**. Nothing in
`src/` ever invoked it. `grep -rn setupIndividualStaticNPC src/`
returned the definition and nothing else; every other hit was a test
driving it directly.

So: no building NPC in the entire game carried a
`QuestResourceBehaviour`. The follow-up-quest bootstrap click - the
whole reason C# attaches one unconditionally - had nothing to click.
And `IsIndividualQuestNPCAtSiteLink`, which exists so that a quest
that moved King Gothryd to a tavern takes his palace copy off the
board, never ran: both copies stood, both drawn, both clickable.

*A PORTED FUNCTION WITH NO CALLER IS A COMMENT.* The tests were green
because the tests called it themselves. `questscene.test.js:520`
drives every arm of it faithfully, and the arc's own coverage sweep
counted those lines as covered. A fixture that reaches a line the
game cannot reach is the same failure as a fixture that cannot reach
the line at all - it tells you the function works, not that it runs.

The hook now runs where C# runs it: inside `buildInteriorContext`,
per person, during layout. `PlayerEnterExit` does not reach
`AddQuestResourceObjects` until `DoLayout` has returned (:800), so
the bootstrap behaviours exist before the marker walk asks
`IsAlreadyPlaced` - which was the other half of the repair.
`findBehaviours` fed that check `questFlats.map(s => s.behaviour)`,
the quest stands only, where C# opens with
`Resources.FindObjectsOfTypeAll<QuestResourceBehaviour>()`
(GameObjectHelper.cs:917) - every behaviour alive in the scene. Miss
the static-NPC ones and a Person the bootstrap behaviour already
holds gets stood a second time by the marker walk, which is a
duplicate NPC arriving by a different door than the one I had just
closed.

`SetActive(false)` on a Unity GameObject takes the renderer and the
collider with it, so the away copy had to leave both draw paths (the
classic billboard batch and `?voxelfolk`'s rig) and the activation
ray. And Unity destroys those behaviours with their GameObjects on a
scene transition, so the interior teardown notifies them exactly as
it already notified the quest stands.

**The pin that could not see a deletion.** The first draft of the
draw-path assertion was `assert.match(ic, /if \(!pn\.active\) continue;
\/\/ ...the away copy does not draw/)`. Both draw paths carry that
same line. Deleting either one left the other, and the pin passed. It
is now an occurrence *count*, and each deletion is a separate
verified kill.

*A PIN THAT ASKS WHETHER A LINE EXISTS SOMEWHERE CANNOT SEE IT
DELETED FROM ONE OF THE TWO PLACES IT BELONGS.*

Six mutants, six kills: the DoClick return removed; the DoClick
return moved below the listener; the hook unwired from
`buildInteriorContext`; `findBehaviours` narrowed back to the quest
stands; and the away copy restored to each draw path in turn. Plus
the earlier one - `questJournal`'s empty-page fallback, the
regression this audit wrote itself in wave 11, where turning page rows
from bare strings into `{ text, color }` made `!lines.some((l) => l)`
unreachable on the same day the colours landed. An object is always
truthy.

**Still open, unchanged by this wave:** the port stands every interior
person, where DFU disables them for an owned house, a closed shop, or
a TG/DB house the player is not a member of - and calls
`SetupIndividualStaticNPC` only on the ones that survive those gates.
The gates are a pending of their own; when they land, the hook moves
inside them.


### Wave 21

**Where the tokens get read.**

`Quest.ShowMessagePopup` (:775-844) reads the message once, at the top,
and everything after that works on the array it got:

```csharp
TextFile.Token[] tokens = message.GetTextTokens();
if (tokens == null || tokens.Length == 0)
    return null;
```

The port pushed the `Message` object onto the pending stack and let
the host call `getTextTokens` when the box finally opened. One line
of difference, and it moves three things at once:

- **the variant draw.** `GetTextTokens(-1)` picks a variant off the
  quest's roll. Drawing it at pop time takes the roll out of order
  against every other draw in the tick (Ledger A), and a box that is
  queued and drained across a break draws against a different state.
- **the macro expansion.** `%qdt`, the clicked NPC, `%pcn`,
  `lastResourceReferenced` - all of them answered with the world as it
  was when the box *opened*, not when the task said to show it. The
  gap is not theoretical: `say` queues, then the task keeps running,
  and `_showPendingTaskMessages` drains after.
- **the dialog reveal.** Wave 6 established that quest popups reveal
  the Places and Persons they name, "on purpose" per Nystul's comment.
  That reveal fired at pop time too.

The emptiness check was wrong in a way that only reads wrong once you
know what C# is testing. C# tests the array it just read - the CHOSEN
variant, expanded. The port tested
`message.variants.some((v) => v.tokens.length)`: *any* variant, *raw*.
So a message whose drawn variant expands to nothing still queued a box
**and still burned its `oncePerQuest` record**, because C# returns
above the line that records it.

And the chunker was simply absent:

```csharp
const int chunkSize = 22;
...
if (++lineCount > chunkSize) { chunks.Add(...); currentChunk.Clear(); lineCount = 0; }
```

`++lineCount > 22` breaks on the twenty-**third** counted line, which
has already been added to the chunk being closed. A full chunk holds
23 lines, not 22. Kept verbatim, with the off-by-one named in the
comment so nobody "fixes" it.

**The stack that wasn't.** `DaggerfallMessageBox.Show()` is
`uiManager.PushWindow`. `ShowPendingTaskMessages` pops the whole
pending stack and Shows each one, so the boxes end up layered and the
player clicks down through them. Work the double reversal out and it
lands exactly where you would want it to: push chunks 0..n, pop n..0,
each landing on top, so chunk 0 of the first-queued message is what
the player sees first, then chunk 1, then the next message.

The port's host minted a **fresh** `ServiceFlowWindow` per call and
dropped it into the overlay slot. Every box after the first threw the
previous one away. A task that showed two messages showed one. It only
looked harmless because the survivor happened to be the right one -
the last popped is the first queued - and because nothing chunked yet,
so there was rarely more than one box in flight.

`ServiceFlowWindow.push()` already unshifts to the front, which is
`PushWindow` exactly. The host now holds the live window and stacks
onto it while the overlay slot is still showing it.

Six mutants, six kills: the read moved back to pop time; the empty
check back onto raw variants; `>` weakened to `>=`; the final chunk
pushed unconditionally; the chunker bypassed; and the host restored to
replacing. The hook's contract changed with it - `showPopup(quest,
tokens)` takes one box's already-expanded tokens now, not a Message -
so five fixtures across four files moved from asserting a message id
to asserting the text the player actually reads, which is a better pin
than the one it replaced.


### Wave 22

**Six things that were ported and then never reached.**

This wave has one shape. Every finding is a piece of DFU that the port
already contains, correctly written, sitting behind a call that nobody
makes - or behind a call that hands it the wrong argument. None of it
would show up in a diff against the C#. All of it shows up the moment
you ask *who calls this*.

**The journal's fourth page.** `PopupText.AddText`'s last line, after
it has queued the label:

```csharp
GameManager.Instance.PlayerEntity.Notebook.AddMessage(pgText);
```

and `DaggerfallHUD.SetMidScreenText` (:371) does the same. Every HUD
popup the player ever sees - every skill-up, every "You are too far
away.", every "Game saved." - is filed in the notebook's 50-slot ring,
and the journal's **Messages** page is that ring. The port has the
ring. It has `getMessages` with the rotation. It has `addMessage` with
the wrap. Nothing called `addMessage`. The page was blank from the day
it was written, and would have stayed blank for ever.

**The map the guild revealed.** A Thieves Guild promotion at rank 6 or
8, and *every* Dark Brotherhood promotion, calls
`PlayerGPS.DiscoverRandomLocation()` and then

```csharp
GameManager.Instance.PlayerEntity.Notebook.AddNote(
    TextManager.Instance.GetLocalizedText("readMapTG").Replace("%map", revealedDungeon.Name));
```

The port's `revealLocation` discovered the dungeon, and then logged
`(the notebook note pends its surface)`. The surface it was waiting
for is `notebook.addNote`, which wave 4 of this same audit wired **340
lines above it in the same file**. A pending comment outlives the
thing it was pending on, and nothing tells you.

**Twice the reach.** `PlayerActivate` splits quest resources in two:

```csharp
if (QuestResourceBehaviourCheck(hit, out questResourceBehaviour) && !(questResourceBehaviour.TargetResource is Person))
{
    if (hit.distance > DefaultActivationDistance)   // 128
```

A Person goes through `StaticNPCClick` at 256. Everything else - the
quest item on the floor, and a behaviour with no target resource at
all, because `!(null is Person)` is true - is 128. The port gave every
quest stand the static-NPC 256, so a quest item could be picked up
from twice as far away as in DFU. (Recorded delta: C# also prints "You
are too far away." and aborts the whole activation; the port's picker
just does not select the target, so a too-far click falls through in
silence.)

**A hash that will be wrong later.** `AddQuestNPC` stands the
billboard at `dungeonBlockPosition + marker.flatPosition` (:1022) and
then hands `SetLayoutData` **`marker.flatPosition` alone** (:1062).
The port hashed the stand position. Inside a building `dungeonX` and
`dungeonZ` are zero and the two are identical, which is why nothing
caught it; in a dungeon they are a whole RDB block apart, which is a
different hash, a different `nameSeed` fallback and therefore a
different generated *name* than DFU gives the same NPC. Fixed now, so
it is right on the day the dungeon mount lands rather than a bug that
arrives with it.

**The menu flag, and the flag the route computed for nobody.** All
four `TalkToStaticNPC` calls inside `StaticNPCClick` pass
`menu: false` - the talk did not come from a popup menu, so
`DaggerfallQuestOfferWindow` must not close itself when its message
box closes (:94-97). The port passed `true`. And the
HolyOrder/spymaster escape passes a third argument:

```csharp
talkManager.TalkToStaticNPC(npc, false, factionData.id == (int)GuildNpcServices.TG_Spymaster);
```

`staticNpcRoute` has returned `{ kind: 'talk', spymaster }` since G8.
`npcSession.talkToStaticNPC` has accepted `isSpyMaster` and threaded
it into `allowGuildResponse` since then too. The call site between
them read `route.kind` and dropped `route.spymaster` on the floor.

**And `:60`.** The last one is the eighth time this audit has caught a
pin that restates the port instead of the source, and the first time
the pin argued its case:

```js
// C#'s Hour/Minute/Second are ints; the port's dateFromClassicMinutes
// can carry a fractional second off the ticker - {0:00} must floor,
// never round 59.9 up to the impossible '60'.
```

Two of the three are ints. `DaggerfallDateTime.cs:63` is
`public float Second = 0;`, and .NET's `{0:00}` custom numeric format
rounds away from zero. So DFU really does print `13:30:60`, and the
port was quietly correcting the game it is a port of. *THE PORT MUST
NOT BE MORE ACCURATE THAN THE THING IT IS A PORT OF* has been an arc
law since the seasons table; this is the first time it was broken by a
test rather than by code.

Seven mutants, seven kills.


### Wave 23

**A generator nobody runs is a hand transcription with extra steps.**

`src/characters/enemyBasics.js` is 3025 lines of `MobileEnemy` records
and it is *generated*, from `EnemyBasics.cs`, by
`tools/extract-enemy-basics.mjs`. That reads like the safe answer to
the transcription law - and it is, right up until you ask when the
generator last ran. It asserts C3 parity when a human invokes it.
Nothing invoked it. There was no gate.

Which means a column the extraction never *looked at* was invisible
from both directions at once: absent from the port, and absent from
every pin, because every pin read the port. You cannot notice a field
you have never seen.

Nine of them:

| column | what it drives in DFU |
|---|---|
| `SoulPts` | `ItemBuilder.cs:303` - a filled soul trap is worth `5000 + SoulPts`. 32 of the 62 records set it |
| `BloodIndex` | the TEXTURE.380 splash (`EnemyAttack.cs:332`, `WeaponManager.cs:572`, `EnemyHealth.cs:52`) |
| `NoShadow`, `GlowColor` | the shadow caster and the point light (`SetupDemoEnemy.cs:137-148`) |
| `HasSeducerTransform1/2` + frames | which transform anim set the Lamia plays (`DaggerfallMobileUnit.cs:850`) |
| `PrefersRanged`, `PrefersNoise` | AI preference flags on the struct |

`GlowColor` carries its own trap. Unity's `Color operator*` scales
**every** channel including alpha, and the three-argument constructor
leaves `a = 1` - so `new Color(18, 68, 88) * 0.1f` has alpha `0.1`,
not `1`. Three enemies glow, and all three would have glowed wrong.

The repair is two gates over a pure extraction library that the
generator and the tests now share:

1. re-extract from the vendored source and deep-equal the checked-in
   module, cell for cell - the LootTables idiom;
2. enumerate every field name the **source** assigns inside its
   `MobileEnemy` initialisers and fail on any that has nowhere to
   land, with an explicit allow-list of the falsy-omitted booleans.

Gate 2 is the one that found the nine, and gate 2's first draft was a
fake pin of a kind this audit had not seen before.

**A pin that scans an empty string passes everything.** The draft
hand-rolled the table slice:

```js
const table = cs.slice(start, cs.indexOf('};', cs.indexOf('// Custom enemies', start)));
```

The library it was copying from has a guard the copy dropped:
`indexOf('// Custom enemies', …) === -1 ? tableStart : …`. That
comment is not in the vendored tree. So `indexOf('};', -1)` searched
from **zero** and answered a brace eighteen thousand characters
*before* the table - a backwards slice, an empty string, zero columns
found, and a confident "no dropped columns" verdict. It passed on the
first run, which is what made me look.

Both gates read the library's slicer now, and gate 2 asserts it found
at least 25 columns before it will believe a clean result. *A PIN THAT
FINDS NOTHING MUST PROVE IT LOOKED.*

Twenty-two mutants, twenty-two kills - one cell edited by hand in the checked-in
enemy table, the `SoulPts` column dropped from the extraction again,
the `=== -1` guard removed, the glow alpha forced to 1, a whole enemy
deleted; then one cell edited in encounter table 22, the comment strip
removed, and a divergent second copy of the encounter table grown
back; then the Nord's description id, the Nord's frost resistance
turned to fire, and the female clothed/unclothed body art swapped;
then a Drugs index, the hand-added Currency row, the implicit-enum
Deeds row truncated, and the hand-added QuestItems row; then isChain
widened to the whole 0x01xx band, a rung of the plate ladder, and the
second GetMaterialArmorValue grown back; then the corpse reach
returned to the 128 default, the static-NPC reach halved, talk.js's
second declaration grown back, and a second GlobalScale.

Also corrected: `loot.js`'s "21 keys" comment over a 22-row matrix
(`-` plus A..U), and the same off-by-one in the LootTables gate's
message, which had been asserting `rows.length >= 21` where an exact
22 is what the source has.

**Then the same law over the encounter tables.** `encounters.test.js`
spot-checks maybe eight cells out of 45 x 20. All 900 are rebuilt from
`RandomEncounters.cs` now, with `MobileTypes` resolved by *counting*
the implicit-value enum rather than trusting a literal.

That rebuild has to strip C# block comments, and finding out why was
the useful part: the source carries a dead
`/* Cemetery - DF Unity version */` table between index 18 and
Underwater (Ledger B). Leave it in and every table from 19 on shifts
by one - which is exactly what the first run reported, twenty-seven
"differences" that were all the same off-by-one. The port was right;
my throwaway parser was wrong. *WHEN A REBUILD DISAGREES WITH THE PORT
IN A PERFECTLY REGULAR WAY, SUSPECT THE REBUILD.*

And it turned up **two copies of those 900 cells**:
`systems/encounters.js` carried its own hand-maintained literal beside
the generated one in `characters/encounterTables.js`. Character for
character identical the day it was found, which is the only day that
was ever guaranteed - and only one of them could ever be gated. One
table now, imported and re-exported, pinned by object identity rather
than by deep-equality so a future copy cannot pass by agreeing.

**And the race templates.** `races.js` derives all seven paperdoll
filenames per race from an art index, on the strength of "one regular
scheme". `RaceTemplate.cs` spells every one of them out as a literal,
one race at a time, which is exactly the shape a scheme goes to break
in. The eight playable races are rebuilt from the source constructors
now - filename for filename, plus `DescriptionID`, `ClipID` and all
four `DFCareer.EffectFlags` channels. The scheme holds today; the
point is that it will be told to stop holding rather than quietly
stopping.

**Two more tables, and a third twin.** `GROUP_TEMPLATE_INDICES` - the
group-to-template-index lists that decide what loot generation and
shop stock can mint at all - is extracted from `ItemEnums.cs`, and
**two of its rows were added by hand** because the generator predates
the quest mint. Nothing could check those two. Now the whole table is
rebuilt from every enum in the file, resolved the way C# resolves
them: an explicit `= n` sets the value, a bare member takes the
previous plus one.

`Deeds` is the reason that last clause matters. It is the only item
group DFU declares implicitly (`Deed_to_townhouse, Deed_to_house,
Deed_to_manor` → 0, 1, 2), and the gate's first draft skipped
implicit-value enums as "not group lists" and then asserted `Deeds`
must be present. It failed on the first run, which is the correct
behaviour for a draft that wrong.

And `loot.js` declared twelve of those rows *again* - the same
numbers, from the same enum file, in a module that already imports
`GROUP_TEMPLATE_INDICES` two lines above the copy. Identical the day
it was found. It is a view onto the one table now, pinned by object
identity per row.

**A fourth twin, found by looking for them on purpose.** Having hit
three by accident, I wrote a ten-line scan for the same numeric
literal appearing in two different files. Six hits; five were
coincidence (an identity matrix, powers of two, `[0,1,2,...]`). The
sixth was the ten-step plate ladder `[7, 9, 9, 11, 13, 15, 15, 17,
19, 21]` in both `systems/armorMaterials.js` and
`combat/enemyEquipment.js` - two live implementations of
`DaggerfallUnityItem.GetMaterialArmorValue`, both exported under that
name, both used.

`armorMaterials.js`'s own header, written by an earlier audit, says
this:

> These were ported TWICE - systems/equip.js and ui/paperDoll.js each
> carried a copy - and the copies drifted: both invented Chain2 =
> 0x0101 where DFU has 0x0103.

The module that exists *because* this function was duplicated twice
had a third copy sitting next to it. The two agreed over every input
from -2 to 0x0300 on the day I checked, which is the only guarantee a
duplicate ever offers. One implementation now, pinned by function
identity - and the survivor is the C# switch verbatim, including that
`0x0101` and `0x0102` are not chain at all.

**And a fifth, which is mine.** The numeric scan only sees literals on
one line, so I ran a second one: every symbol *declared* (not
re-exported) in more than one module. Forty-three. Most are honest
homonyms - two different `LABELS`, two different `ROW_SPACING`. Nine
disagreed in value, and eight of those nine are different things that
happen to share a name.

The ninth was `DEFAULT_ACTIVATION_DISTANCE`, and **wave 22 of this
audit added it**. `player/activate.js` has been the home of
`PlayerActivate.cs:76-88` since the activation ray landed;
`systems/talk.js` had a second set written out as bare `256 * 0.025`
literals; and I added a fourth constant to the copy without noticing
the first three. That is how a duplicate set gets built - one honest
commit at a time, each of which looks local and correct.

All eight are rebuilt from `PlayerActivate.cs` now: the gate reads the
classic unit count out of the source and multiplies by
`MeshReader.GlobalScale` - which `activate.js` had *also* redeclared
as its own `0.025`, so that is one home now too. `talk.js` re-exports.
And the commented-out `TouchSpellActivationDistance` is asserted
**absent**, because it is commented out on the C# side.

That is five duplicated tables in one wave: the encounter tables, the
item groups, the armour ladder, the activation reaches, and (in
effect) the enemy stat blocks, whose second copy was a generator's
output drifting from a generator nobody ran. *IF A TABLE IS WORTH
WRITING ONCE, THE SECOND COPY IS A BUG THAT HAS NOT HAPPENED YET.*

FLAGGED: none of the eight new columns has a port consumer yet -
there is no blood splash, no enemy point light, no Seducer transform,
and no `CreateRandomSoulTrap` mint. They are data now, so the gate can
see them and the slice that needs them will find them already correct.


### Wave 24

**The rule, as a gate.**

Wave 23 found five duplicated tables. One of them this audit had
written itself, two waves earlier. Every one of them agreed in value
on the day it was found - which is the only guarantee a duplicate ever
offers, and it expires overnight.

*ONE DFU MEMBER, ONE EXPORT* has been an arc rule since AUDIT 17e. A
rule people remember is a rule that gets broken by people who are
concentrating on something else, which is exactly how I broke it in
wave 22. So it is a gate now: scan `src/` for every symbol **declared**
(not re-exported) in more than one module, load both homes, and demand
either identical values or a listed reason. Forty-three pairs. Thirty-
four agreed, nine disagreed, and eight of those nine are honest
homonyms - two different `LABELS`, two different `ROW_SPACING`.

The ninth was not.

**`staticNpcData`.** `characters/staticNpc.js` carried a copy of
`SetLayoutData` that predated the seven-slice sweep's corrections: no
`race`, no `context`, no zero-struct base, and a gender written as the
**string** `'female'` where C# writes the `Genders` enum. The corrected
one lived in `questBridge.js`. Both exported under that name; nothing
in production called the stale one, and its own module's
`staticNpcName` compared `data.gender === 'female'` to accommodate it -
so the workaround kept the bug looking correct.

One implementation now, living in the `StaticNPC.cs` home, and
`staticNpcName` hands `FullName` the enum the way `GetDisplayName`
does (`:328`).

**And the bug underneath it.** `staticNpcName` *is*
`StaticNPC.GetDisplayName`, ported carefully, individual-faction arm
and name-seed arm and all. Nothing called it.

`openStaticNpc` read `pn.displayName` - a field
`collectInteriorPeople` does not write. So every shopkeeper, priest,
banker and guild clerk in Daggerfall reached `TalkManager` with an
empty name. Two things read it:

- the greeting says the NPC's name once reaction is above zero, and
  "stranger" below it (`townTalk.js:467`). Every static NPC in the
  game stayed a stranger no matter how well liked.
- `topicTree`'s same-building-static test (`:558`) matches a topic
  caption against that name, so it never matched.

Mobile townspeople had names the whole time (`townPopulation.js:70`).
Only the ones you can actually talk to were anonymous. *A PORTED
FUNCTION WITH NO CALLER IS A COMMENT* - the second time in five waves,
and this one had a workaround written to keep it plausible.

**The collapse.** Seventeen of the forty-three pairs were one DFU
member with two homes, and they are one home now: the calendar
constants, `MeshReader.GlobalScale`, the eight `PlayerActivate`
reaches, `ItemEnums.BodyParts`, `FormulaHelper.MaxStatValue`, the
classic 320x200 panel, `EnemyAttack`'s ranged bounds, the walk base,
the book template, `GetMaterialArmorValue`, `SetLayoutData`,
`GetPositionHash`. The ratchet stands at 26; it may fall freely and
needs a deliberate edit to rise.

Three mutants, three kills: the string gender compare put back, the
click stopped naming the NPC, and a fresh disagreeing duplicate
landed in a third module.


### Wave 25

**What 151 agents found.**

The seven-slice adversarial sweep - three lenses over each of the
seven quest slices that had only ever been re-read by the main loop,
every claim then handed to independent refuters - finished after
eleven and a half hours and 11.8M subagent tokens. Five findings
survived the refute pass. Two of them are real.

**StartQuest drops its tail.**

```csharp
public void StartQuest(Quest quest)
{
    quest.Start();
    GameManager.Instance.TalkManager.AddQuestTopicWithInfoAndRumors(quest);
    quests.Add(quest.UID, quest);
    RaiseOnQuestStartedEvent(quest);

    // Assign QuestResourceBehaviour to questor NPC - this will be last NPC clicked
    // This will ensure quests actions like "hide npc" will operate on questor at quest startup
    if (LastNPCClicked != null)
        LastNPCClicked.AssignQuestResourceBehaviour();
}
```

The port has the first four lines. The fifth it waved off in a doc
comment - *"The questor-behaviour relink that follows in C# is scene
work (Q3)"* - and Q3 came and went. C# tells you in its own comment
what breaks: `hide npc` on the questor, at quest startup, which the
corpus fires constantly. The questor you have just accepted a quest
from carries no behaviour until the next layout, so every action that
reaches a Person through one operates on nothing.

`ActiveQuestor` and `AssignQuestResourceBehaviour` came with it,
including C#'s **last-quest-wins** overwrite: the inner loop breaks on
a match, the outer one does not, so with two quests from the same NPC
in flight the one that iterates last wins. And `setLastNPCClicked`
carries the host now - C#'s `LastNPCClicked` is the *component*, so it
still has its GameObject when the tail reaches for it, where the port
had stored the bare `NPCData` and had nothing to attach to.

**The rumor mill freezes its own text.**

```csharp
TextFile.Token[] tokens = entry.listRumorVariants[variant];
macroHelper.ExpandQuestMessage(GetQuest(entry.questID), ref tokens, true);
```

`tokens` *is* the mill's stored variant, and `QuestMacroHelper.cs:158`
writes each expansion back into it. So a quest rumor is fixed at the
wording of its **first telling**: `%qdt`, the questor's name, a Place
that has since been renamed - all of it frozen, for the rest of the
game.

The port cloned first, with an honest-looking comment: *"the mill's
stored variants must not"* be mutated. That is the port being more
correct than the game it is a port of, which is the one thing this arc
has never allowed. Expanding in place now. (The caller-side
`if (quest)` went too - C# calls `ExpandQuestMessage` whether or not
`GetQuest` found anything, and the null-parent bail is a forum-bug fix
*inside* the helper, which `questMacros.js:437` already carries.)

**Three nits with teeth.**

`HasFactionListener` has exactly one consumer in the DFU tree:
`PlayerActivate.StaticNPCClick:1534`. `TalkManager.cs` does not
contain the word `Listener`. Three port comments named TalkManager as
the reader and marked the wiring `(Q4 wires)` - over a reader the port
already ships, at `worldModes.js:451`. A pending marker over shipped
work is worse than no marker at all: it sends the next reader looking
for work that is done, in a file that never had it. Four sites
corrected, the bible's copy included.

`questMacros.js`'s module header still asserted that only `%G` has a
capitalized handler and that the corpus's fourteen `%G3` lines render
`%G3[undefined]` - a claim the *same audit* refuted forty lines below
it, where all six capitalized forms are registered. *A COMMENT THAT
DESCRIBES A LINE THAT IS NOT THERE IS A BUG WITH A WITNESS*, and this
one had the witness in the same file.

And the quest-flat click threw away `DoClick`'s bool - the value that
says whether any live quest owned the click, and the one
`StaticNPCClick` returns on.

Seven mutants, seven kills.


### Wave 26

**The two the refuters could not agree on - and the hole under both.**

The seven-slice sweep sent five findings through with both refuters
agreeing, and two where they SPLIT. Those two were mine to adjudicate,
and the interesting part is that the disagreements were real: in each
case one refuter had the C# right and the other had the reachability
right.

**Split 0: `%rt`/`%t` and `%nrn`.** One refuter verified, line for
line, that `RegentTitle` discards `FindFactionByTypeAndRegion`'s bool
and reads the out struct regardless - and that
`PersistentFactionData.cs:239` assigns `new FactionFile.FactionData()`
*before* searching, so a miss really does hand back all zeros, and
`GetRulerTitle(0)` takes its `default:` and answers **Lord**. The
port's `if (!region) return null` renders `[nullMCP]` instead.

The other refuted it: the seam is mounted nowhere, so the handlers are
in their *unmounted* state, not a miss state, and the port's charter is
that an unmounted seam pends LOUDLY. Rendering a plausible silent
"Lord" from a seam nobody answers is the exact trapdoor the seam gate
exists to prevent.

Both are right, and the second one's argument is what exposed the
actual defect. **The seam gate could not see the seam at all.**

```js
for (const m of read(join(dir, f)).matchAll(/\bworld\??\.(\w+)/g)) names.add(m[1]);
```

It scanned for the literal `world.` / `world?.`. `questMacros.js` is
written the other way throughout -

```js
const w = hooks?.world;
return w?.findFactionByTypeAndRegion?.(7, w.currentRegionIndex?.());
```

- so an entire module's worth of seams was invisible to the gate. Three
were unmounted behind the alias: `findFactionByTypeAndRegion`,
`locationCompassDirection` and `buildingCompassDirection`. That is the
fifth, sixth and seventh instance of the failure the gate's own header
says had "happened four times over", sitting in the one module the gate
could not see. *A GATE HAS A BLIND SPOT UNTIL SOMEBODY LOOKS FOR IT
FROM THE OTHER SIDE.*

So the resolution is all three at once: the gate resolves aliases; two
of the three seams are **mounted**; the third gets a PENDING row with
its reason; and `%rt`/`%nrn` become structurally 1:1 - gating on `!w`
like `%rn` already does, and letting a lookup MISS take C#'s
zero-struct fallback. The pending table owns "not mounted"; the macro
owns "what DFU does".

Tightening the alias scan mattered as much as widening it. The first
draft matched any `const x = <anything containing world>`, which swept
up `const loc = world?.currentLocation?.()` and duly reported
`building` and `dungeon` as missing seams.

**The compass law**, ported for the mount: eight half-open 45-degree
bands off east (`TalkManager.cs:1163-1187`), reached by `Acos` plus
C#'s longer road back to the lower half-plane rather than `atan2`. Two
edges kept - a ZERO vector divides by a zero magnitude, and NaN fails
every band comparison, so "exactly where you are" answers
`...never mind...`; and the location lookup does not break on a match,
so the LAST location of that name in the region wins.
`buildingCompassDirection` stays pending: it needs the player
transformed into the exterior automap's layout space, and a direction
computed in the wrong space is a plausible wrong answer where the miss
arm is loud.

**Split 1: `Quest.displayName`.** Same shape of disagreement. `Quest.cs:56`
is a bare `string displayName;`, so DFU's field is null and
`DaggerfallGuildServicePopupWindow.cs:640` leans on it:
`AddItem(displayName ?? quest.QuestName)`. The port initialised it to
`''`, and `'' ?? x` is `''` - the fallback was dead code. One refuter
confirmed all of that; the other showed the consequence is unreachable
today, because every quest in both loaded lists carries a
`displayname:` line.

Unreachable today is how wave 20's journal regression looked too. Null
now - with `?? ''` at the two template literals, because
`string.Format` renders a null argument as empty and `${null}` in JS is
the four-letter word.

**Two pins had to be rebuilt after their first drafts survived
mutation.** Weakening a band's `>=` to `>` passed everything: my probes
at 22.4999 and 22.5001 straddle the seam but never land on it, and no
vector I can build makes `acos` return exactly 22.5. The inclusivity is
pinned on the source now, comparison for comparison. And dropping the
faction search's partial-match arm passed too, because nothing
exercised the mount - so the search moved into `talk.js` beside
`findFactions`, where it can be driven directly.

Six mutants killed, one equivalent mutant recorded as equivalent:
swapping the two `if`s inside the search loop passes every pin, and it
really is equivalent - the only item that could satisfy both is one
with `region === -1` when the query is also -1, and the exact-match
return fires either way.


### Wave 27

**The scout landed after the wave it was scouting, and found two bugs
in it.**

Wave 26 shipped without its scout: the box has four CPUs, so each
workflow runs two agents at a time, and waiting was slower than reading
the C# myself. That was the right call for throughput and it cost
something. When the scout finished it had a checker on every answer,
and between them they found **two defects in what wave 26 had already
pushed**.

**The one I got wrong.** `GetLocationCompassDirection` looks like a
last-match-wins loop, and I read it that way:

```csharp
for (int i = 0; i < locations.Length; i++)
{
    if (locations[i].ToLower() == name)
    {
        if (currentDFRegion.MapNameLookup.ContainsKey(locations[i]))
        {
            int index = currentDFRegion.MapNameLookup[locations[i]];
            locationInfo = currentDFRegion.MapTable[index];
```

The loop does not break - that part is true. But the row is fetched by
`MapNameLookup[locations[i]]`, **not by `i`**, and `MapNameLookup` is
built first-wins (`if (!ContainsKey(name)) Add(name, i)`,
`MapsFile.cs:1082-1083`). So every iteration for a duplicated name
resolves the *same first row*; the repeats are wasted work, not a rule.
I had written `mapTable[i]`, which really is last-wins, and then
**pinned my misreading as the law**.

That is the ninth catch of *a pin that restates the port instead of the
source* - except this one restated a misreading of the source, which is
a worse failure and one only a second reader was ever going to find.
The port carries `mapNameLookup` already, built first-wins at
`mapsFile.js:519`, so the fix is to use it. Two names differing only in
CASE still take the last, because the `ToLower` compare matches both
while the dictionary keys stay exact-case - so the lookup is
per-iteration, not hoisted.

**The one I walked past.** `talkTopics.js` has carried `compassHint`
since the talk arc: a complete second implementation of
`DirectionVector2DirectionHintString`. Wave 26 wrote a third.

Two waves after wave 24 built a gate against exactly this.

The gate keys on the exported **name**, and `compassHint` and
`directionHintString` are different names for the same DFU member. It
saw nothing. And the older copy was wrong in the one place the two
differ:

```js
const mag = Math.hypot(dx, dz) || 1e-9;
```

C# divides by the raw magnitude, so a coincident target gives
`0/0 = NaN`, every band comparison fails, and the chain falls to
`...never mind...`. That guard turns it into `acos(0) = 90` - **north**.
So "where is the shop I am standing in?" got a confident wrong
direction, and its `else` answered `east` rather than the never-mind.
One implementation now.

**I tried to gate the class and could not.** Three mechanisms:

| mechanism | result |
|---|---|
| group exports by the C# member their doc cites | 4 cross-module hits, every one a helper and its caller sharing a line - and it would **not** have caught `compassHint`, whose doc carried no citation at all |
| file pairs sharing distinctive numeric literals | 961 pairs. Small integers are ids and indices; they are shared everywhere |
| the same, restricted to FRACTIONAL literals | still 637. The port is full of 0.05/0.1/0.2 tuning constants |

So the boundary is **written down** in the gate rather than gated. A
noisy gate gets suppressed and then protects nothing, and claiming
coverage you do not have is worse than naming the gap. What does work
is wave 23e's scan for a bracketed run of six or more numbers on one
line - distinctive enough to be signal, and it is what found the armour
ladder. It catches TABLE-shaped duplicates only; function-shaped ones
under different names still need a reader.

**Examined and not a divergence,** recorded so the next sweep does not
raise it: `Foe.cs:45-46` declares `displayName` and `typeName` with no
initialiser, exactly the shape wave 26 had to fix on `Quest`. The
consumer is what differs. `Quest.displayName` is read through
`displayName ?? quest.QuestName`, where `''` and null part company;
the Foe pair is read through `words[word].Replace(macro.token, result)`
(`QuestMacroHelper.cs:122`), and .NET documents a null `newValue` as
"all occurrences of oldValue are removed" - which is what `''` does.
Unobservable, so the port keeps `''`.

Three mutants, three kills, and one that survived and should not have:
dropping the `lookup?.has` guard passed every pin, because every
fixture supplied a lookup. It is not equivalent - it turns a
partially-built region record into a TypeError that takes the whole
macro expansion down - so the fixture that has no lookup at all is
pinned now.

**Still open, for the next wave:** `answerPipeline`'s
`buildingCompassDirection` dep is not supplied by world.js's
construction, so `%di`'s local arm is dark on the talk path too - and
the seam gate scans `src/systems/quest/` only, so that whole dep
surface has no gate at all. The seam itself is legitimately PENDING;
the missing gate is not.


### Wave 28

**The twelve-slice sweep lands: 60 agents, 37 confirmed, 16 of them
high.**

The non-quest sweep - combat formulas, player entity, the effects
engine, items, survival, the talk stack, guilds, format readers, world
tick, enemy AI, save/load and chargen - finished after six and a
quarter million subagent tokens. Wave 27's lesson governs the triage:
**verify each against the C# myself**, because an agent caught me
trusting my own reading and the seven-slice refuters were wrong about
as often as they were right. This wave takes the first two.

**Enemies could not hit a new character.**

```csharp
int armorValue = 0;
if (struckBodyPart <= target.ArmorValues.Length)
    armorValue = target.ArmorValues[struckBodyPart] + IncreasedArmorValueModifier + DecreasedArmorValueModifier;
return armorValue;
```

`CalculateArmorToHit` reads the seven-part table and DFU has **no
scalar-armour path anywhere**, because every entity carries that array
from the moment it exists: `CharacterDocument.cs:86-88` fills the
player's with 100 - "no armor" - and `AssignCharacter` copies it
wholesale; `EnemyEntity.cs:264-267` fills a monster's with
`ArmorValue * 5`; `:409-413` starts a class enemy at 100 before its
equipment subtracts.

Higher is *easier to hit*. 100 is the largest single term in the
formula.

The port nulled the player's array in both chargen paths, as a
lazy-rebuild trick - `armorValuesOf` has a `??=` that would refill it.
The trick never fired: `updateEquippedArmorValues` early-returns for a
non-Armor, non-footwear item **before** it reaches `armorValuesOf`, and
the starting kit is a shirt and a pair of pants. So the array stayed
null until the first armour equip or a save-and-reload, and the read
fell through to an invented `armor: 0` scalar.

A rat at chance-to-hit 30 computes `30 + 100 - 50 = 80%` in DFU and
`30 + 0 - 50 = -20` in the port - clamped to the 3% floor. A fresh
character was very nearly unhittable.

The fixture that pinned the to-hit chain used `armor: 0` too. It was
the invention's own shape, and 0 is not even the unarmoured value.

**And the magicka ceiling never moved.** `MaxMagicka` is a getter:

```csharp
public int MaxMagicka { get { return GetMaxMagicka(); } set { maxMagicka = value; } }
...
if (career != null && this == GameManager.Instance.PlayerEntity)
    return FormulaHelper.SpellPoints(stats.LiveIntelligence, career.SpellPointMultiplierValue);
```

recomputed on every read, plus `MaxMagickaModifier`, floored at zero.
The port wrote it once in `applyCharacter`, from the **base**
intelligence. Everything downstream - the bar, the rest-recovery rate
of `maxMagicka/8`, the absorption headroom - read a number frozen at
chargen, while `liveStat` already reflected every Fortify, Drain and
Transfer for all eight attributes on every *other* consumer.

It is a real accessor now rather than a helper function, because
eleven call sites across four hosts read `entity.maxMagicka` as a
property, exactly as C#'s do. The setter keeps the stored value for the
non-player arm - "enemies are set by level elsewhere".

Eight mutants, eight kills, and two of them only after the pin was
rebuilt. Dropping the `already live` guard from the accessor survived
everything, because on the player path `career` is set and the stored
value is never read - it is the *enemy* path where a second install
would drop the ceiling to NaN. And the class-enemy 100 needed its own
fixture; the monster arm alone did not reach it.

**Thirty-five findings remain**, and the standing rule for them is
wave 27's: the agent's citation is a lead, not a finding, until I have
opened both files myself.


### Wave 29

**Two item highs - and the container took the findings with it.**

Between waves the container was reclaimed again. The local clone rolled
back to `5e47aab`, `git reset --hard origin/...` restored everything to
`f95205a`, and the vendored C# survived (it is large but it is on disk,
not in `/tmp`). What did **not** survive was the workflow journal and
the task output - so the thirty-five remaining findings lost their
`csBehaviour`/`portBehaviour`/`reachable` prose. Their titles, slices
and port line numbers are still in the conversation.

That turns out not to matter, because wave 27's rule already said the
agent's prose is a lead and not a finding. A title with a file:line is
exactly as much as I am allowed to trust anyway.

**A name is not a template.**

```csharp
public virtual int GetWeaponSkillUsed()
{
    switch (TemplateIndex)
    {
        case (int)Weapons.Dagger:
        ...
        default:
            return (int)Skills.None;
    }
}
```

`equip.js` keyed that on `item.name`. Three populations miss:
`itemTemplates.json` spells 117 **"Wakizashi"** and 123
**"Dai-katana"** where the weapon table has `Wakazashi` and
`Dai_Katana`, and `createRegularMagicItem` renames an enchanted weapon
to its MAGIC.DEF name.

They fall to the `default:`, and `Skills.None` is **-1**
(`DFCareer.cs:450`) - all bits set. `-1 & ForbiddenProficiencies` is
non-zero for any career with any restriction at all, so a Wakizashi, a
Dai-katana and every renamed magic weapon were **refused outright** by
every restricted class.

The -1 is not the bug. It is a real DFU quirk, ported deliberately, and
it stays. The bug was *reaching* it.

And the port already knew. `characters/weapons.js` carries the correct
template-index map, under a comment that spells out this exact trap -
"a name is not immutable... an enchanted broadsword swung with
LongBlade 70 was scored on HandToHand 20". An earlier audit found it on
the damage path and fixed it there. `equip.js` was the second copy, and
it did not get fixed with it. *ONE DFU MEMBER, ONE EXPORT*, again -
and the gate cannot see it, because the two are named
`weaponSkillUsed` and `weaponProficiencyFlag`, which is precisely the
boundary wave 27 wrote down.

The fixture pinning it built weapons with `templateIndex: 0` and a
name, so it restated the keying that was the bug.

**And a broken item could be put straight back on.**

```csharp
if (item.currentCondition < 1)
{
    ... GetRSCTokens(itemBrokenTextId) ...
    return;
}
```

`DaggerfallInventoryWindow.EquipItem` checks that **first**, ahead of
the whole prohibition chain, with its own TEXT.RSC record (29, not the
forbidden 1068). The port had no such gate anywhere, so an item worn
down to zero condition unequipped and re-equipped freely. Strictly less
than one - a condition of exactly 1 still equips - and an item with no
condition recorded is not broken, because the port mints many without
one.

Five mutants, five kills. A sixth *looked* like a survivor and was not:
weakening `< 1` to `< 0` passed, and the reason was that my mutation
string matched the doc comment quoting the expression before it reached
the expression. *A MUTANT THAT EDITS A COMMENT TESTS NOTHING* - re-run
against the code, it died at once, and so did `<= 1`.

**Thirty-three findings remain.**


### Wave 30

**Time passed and nothing happened.**

`DaggerfallRestWindow.TickRest` raises the clock ten classic minutes at
a sub-tick and counts off an hour at a time, and the port does exactly
that. Raising the clock is only half the machine. The other half is a
component that has nothing to do with the rest window at all:

```csharp
// Note: Effect system must be able to update while game is paused but
// game time still passes, e.g. rest or fast travel
...
int catchupRounds = Mathf.Min(maxCatchupDays * DaggerfallDateTime.MinutesPerDay, (int)minutesPassed);
for (int i = 0; i < catchupRounds; i++)
    RaiseOnNewMagicRoundEvent();
```

`EntityEffectBroker.Update` is a MonoBehaviour update, and
`Time.timeScale = 0` - which is precisely what `PauseGame` sets when a
window opens - does not stop one. The comment says so in as many words.

The port's equivalent is `tickPlayerMinutes`, and it runs in the host's
frame body. `dungeon.js` returns thirty lines before it:

```js
if (ctx.uiOverlayActive) {
  ctx.tickOverlay(dt); ctx.drawOverlay(canvas);
  ...
  return;   // U2b/U3: hold gameplay, keep the loop
}
```

So through a whole rested night nothing ticked a disease, a poison or
an active effect. The rest deps said otherwise, in a comment that had
been wrong since the day it was written:

```js
classicMinutesRef.value += n;   // the round loop catches the magic rounds up
```

It does not catch up *during*. AUDIT 21 F4 gave the port the broker's
own marker, so it catches up **after** - the entire backlog fires on
the first ordinary frame once the window closes, by which time
`tickVitals` has already applied every hour of healing. Rest off a
Continuous Damage Health for free, sleep through a poison and meet it
in the doorway, wake with eight hours of Levitate still on the clock.

DFU interleaves: sixty rounds, one heal, sixty rounds, one heal. A
poison **can** kill you in your sleep, and when it does the rest ends
`youNeverAwaken` rather than "You wake up."

So the broker came out of the entity tick. `runMagicRounds` is its own
exported member now, on its own marker, and both callers use it - the
frame tick and the rest advance. The behavioural pin runs a real
`RestSession` twice over the same fixture, once with each shape: a
100-health sleeper with a one-point-per-minute bleed and five health
back an hour dies 110 minutes in with the broker wired, and wakes at
full health with 600 untouched rounds without it.

And the foe half, which is the same event. `OnNewMagicRound` is global
- every `EntityEffectManager` in the scene subscribes - while the
dungeon's foe round loop anchors on the clock at the top of the current
frame. Those minutes were not merely late for the foes; they were
**lost**.

*A COMMENT THAT DESCRIBES A LINE THAT IS NOT THERE IS A BUG WITH A
WITNESS*, and this is the clearest case the arc has produced. "The
round loop catches the magic rounds up" reads as a note about *where* a
law lives, so three audits went past it without looking for the law.
The pin now asserts the sentence is gone.

**And nothing above ground could infect you.**

```csharp
int hitDamage = 0;
if (DFRandom.rand() % 100 < reflexesChance && minBaseDamage > 0 && CalculateSuccessfulHit(...))
{
    hitDamage = UnityEngine.Random.Range(minBaseDamage, maxBaseDamage + 1);
    // Apply special monster attack effects
    if (hitDamage > 0)
        OnMonsterHit(AIAttacker, target, hitDamage);
```

`OnMonsterHit` is the only door in the game to rat, giant bat, zombie
and mummy disease, to spider and giant scorpion paralysis, and to the
nymph and lamia fatigue drain. The dungeon host has passed it since
S18. `exteriorFoes.js` - the pool behind every wilderness encounter and
every night-in-town spawn - passed `onInflictPoison` and `say`, and not
the rider.

The exterior climate tables are indexes 20-37, and they are full of
exactly those monsters: rats in nine of the eighteen, giant bats in
eleven, wereboars in eleven, werewolves and vampires in nine each,
giant scorpions in seven, spiders in six, zombies in four, nymphs in
four. Above ground, none of them could do anything but hit you.

The gate looks from both sides. Every `calculateAttackDamage` call in
`src/` is sliced by paren-matching and classified: the two monster-melee
doors must carry the rider, and the other five must not - DFU calls it
only in the weaponless branch and only when the attacker is not an
`EnemyClass`, so the two arrow paths and the city watch are *right* to
omit it, and a one-directional gate would invite a later hand to
"fix" them. The count is pinned too, so an eighth damage door has to be
classified rather than quietly added.

Wiring it needed the pool's fatigue door, and `FatigueDamage` is
`DaggerfallEntity.SetFatigue`, not a field write: at zero with health
left it raises `OnExhausted`. So `createPlayerTicker` exposes its
`sinks` rather than letting the pool mint a second set that would have
written the number and missed the collapse.

Twelve mutants, twelve kills.

**Thirty-one findings remain.**


### Wave 31

**You could kill a dungeon without ever being seen.**

```csharp
public static void BreakNormalPowerConcealmentEffects(DaggerfallEntityBehaviour entityBehaviour)
{
    if (entityBehaviour.Entity.HasConcealment(MagicalConcealmentFlags.BlendingNormal))
        manager.EndIncumbentEffect<ChameleonNormal>();
    if (entityBehaviour.Entity.HasConcealment(MagicalConcealmentFlags.InvisibleNormal))
        manager.EndIncumbentEffect<InvisibilityNormal>();
    if (entityBehaviour.Entity.HasConcealment(MagicalConcealmentFlags.ShadeNormal))
        manager.EndIncumbentEffect<ShadowNormal>();
}
```

Unported. Not at one door - at every door, all four of them, and the
member itself did not exist.

S21 shipped the concealments and wired the senses gate that reads
them, which is what made this expensive: cast the *cheap*
Invisibility, walk into a dungeon and nothing can see you for the
whole duration, however many things you kill. Or meet a Nightblade who
has done the same, and be beaten to death by something that never
becomes visible. The normal/true split exists precisely so the cheap
spell can be taken away when you attack and the expensive one cannot,
and the port had built the split and then never used it.

DFU calls the break from three places:

```csharp
if (playerEntity.IsMagicallyConcealedNormalPower && damage > 0)
    EntityEffectManager.BreakNormalPowerConcealmentEffects(...);
```

`WeaponManager.cs:549-552` (the player's swing - and the player's
arrow, because `DaggerfallMissile.AssignBowDamageToTarget` routes a bow
hit straight back through `WeaponDamage`), and `EnemyAttack.cs:255-257`
and `:316-318`. Those three are **the entire caller set of
`CalculateAttackDamage` in the DFU tree**, and all three carry the same
two lines. So the law is not "these three sites"; the law is *any
attack that lands damage*, and the port puts it at the tail of the
formula - one home instead of the seven doors the port has. Wave 30 is
the receipt for why: two hosts had already forgotten `OnMonsterHit`
exactly that way.

That is a claim about the C#, so the pin reads the C#. It counts the
`FormulaHelper.CalculateAttackDamage(` call sites in the vendored tree,
requires the guarded break within six lines of each, and checks that
the break ends exactly `ChameleonNormal`, `InvisibilityNormal`,
`ShadowNormal` in that order. If a future DFU grows a fourth caller
without the guard, the port's shortcut stops being equivalent and the
pin says so.

The fourth door is `DaggerfallEntityBehaviour.HandleAttackFromSource`,
which every `Damage{Health,Magicka,Fatigue}FromSource` runs on the
SOURCE - and for an effect the source is `IEntityEffect.Caster`. So the
port's continuous-damage entries now carry their caster. That has one
consequence worth writing down: `activeEffects` rides the save
envelope, and a live entity reference inside it would drag the player -
and through a foe, the scene - into the snapshot. `copyEffectEntry`
drops it, which is also what DFU does: `SerializablePlayer` writes
bundle settings and `RestoreInstancedBundleSaveData` re-resolves the
caster on load, so a restored effect whose caster is gone simply has
none, and `HandleAttackFromSource(null)` is DFU's own no-op case.

**A cycle, and a leaf.**

The first cut imported the break into `combat/formulas.js` from
`systems/effects.js`, and twenty-seven test files died at once on

```
ReferenceError: Cannot access 'EFFECT_FLAGS' before initialization
```

`effects.js` imports `spellcast.js`, `spellcast.js` imports
`formulas.js`, and the new edge closed the ring - so `effects.js`
evaluated its top-level `ELEMENT_EFFECT_FLAG` while `spellcast.js` was
still mid-evaluation. The break lives in its own leaf,
`systems/concealment.js`, with no imports at all; `effects.js`
re-exports it for the readers that already speak to that module. The
leaf is small enough not to need `hasActiveEffect`: DFU's three
`HasConcealment` guards are exactly what the call-site
`IsMagicallyConcealedNormalPower` check already established, and ending
an effect that is not there is a no-op, so the guards fold into the
filter. Which is also why the port has no
`IsMagicallyConcealedNormalPower` member - it would be a ported
function with no caller.

**And a stat drained to zero did not kill you.**

```csharp
// Kill host if any stat is reduced to 0 live total
for (int i = 0; i < DaggerfallStats.Count; i++)
{
    if (entityBehaviour.Entity.Stats.GetLiveStatValue(i) == 0)
    {
        entityBehaviour.Entity.CurrentHealth = 0;
        return;
    }
}
```

The tail of `UpdateEntityMods`, and it is not a magic round: it runs
out of `Update()` on a 0.2-real-second timer that resets to zero rather
than subtracting. The port has no AssignMods moment - `liveStat` is
computed on read - so the check rides the host tick's `dt` on that same
cadence, with the accumulator on the entity so it survives a host swap.
Putting it on the real-time timer rather than the magic round has a
consequence that is DFU's, not the port's: `Time.deltaTime` is zero
under a paused UI, so **a rest cannot kill you this way** however long
it runs, and the pin says so from both sides.

Every entity has an `EntityEffectManager`, so the foes get it too: a
drained-to-zero Strength kills the thing you drained.

One guard is the port's own, and it is load-bearing. `liveStat` reads
`entity.stats?.[statName] ?? 0`, and DFU's `DaggerfallStats` always
carries all eight permanent values while the port's foes and fixtures
routinely carry a partial block. Without `if (entity.stats?.[stat] ==
null) continue`, the check killed every entity in the game on its first
frame - twenty-seven test files again, which is how it was found.

Sixteen mutants. Fourteen died first time; two survived and were real
misses, not equivalents. The cadence pin only ever probed a *killing*
firing, so deleting the timer reset changed nothing it looked at - and
the reset matters on a firing that finds nothing, which is the common
case. And the kill pin asserted the resulting health rather than the
call, so writing `entity.health = 0` in place of `sinks.hurt(...)`
passed - while in the real port that is the difference between the one
damage door running the death presenter and a corpse walking around
with the HUD still up. Both pins rebuilt; both mutants died.

**A new one, on the way past.** `tickActiveEffects` and
`updatePoisons` are called for foes in exactly one place in `src/` -
`dungeonContext`. Neither `exteriorFoes` nor `cityGuards` ticks its
pool's effects at all, so above ground a foe's Continuous Damage never
takes a round, its poison never fires, and a paralysed encounter foe
stays paralysed forever. Same shape as wave 30's gap, one layer down.

**Twenty-nine findings remain**, plus that one.


### Wave 32

**One broker, many subscribers - and above ground there were no
subscribers at all.**

Wave 31 ended with a note found on the way past: `tickActiveEffects`
and `updatePoisons` were called for foes in exactly one file in
`src/`. This wave is that note, and it turned out to be the shallow end
of it.

DFU's shape is one `EntityEffectBroker`, which owns a single
`lastGameMinute` and raises `OnNewMagicRound` once per elapsed game
minute, and one `EntityEffectManager` **per entity**, every one of them
subscribed. The player is not special; a rat is not special. The port
had the broker (AUDIT 21 F4 gave it the marker, wave 30 pulled it out
of the entity tick) and exactly one subscriber, plus an ad-hoc loop in
the dungeon host.

So above ground: a foe's Continuous Damage never took a round, its
poison never fired, a drained-to-zero attribute never killed it, and a
paralysed encounter foe stayed paralysed **for the rest of the
session** - because the thing that would have expired the paralysis is
the same round that never ran.

Except it did not even stay still, which is the second half.

```js
f.ai.update(dt, playerFeet, senses, false);
```

That fourth argument is `paralyzed`. Both exterior pools passed the
literal `false`, and both ran their attack machine unconditionally. So
a paralysed watchman kept chasing you and kept swinging, and a
paralysed wolf kept biting. `EnemyMotor.HandleParalysis` (:247-260)
drops `CanAct`; `EnemyAttack` returns at the top of both its `Update`
(:91-94) and its `FixedUpdate` (:55-57). The dungeon host has had all
of that since S19. The motor even took the argument.

**The fix is the shape, not the lines.** `runMagicRounds` split into
`claimMagicRounds` - the broker's bookkeeping, the marker, the cap -
and `runMagicRoundsFor`, one subscriber's handler over a claimed
window. The window is claimed once per frame and handed out; a
per-entity function that also owned the marker could only ever serve
its first caller, and the second would find the marker already
advanced and run nothing. The ticker grew a `subscribe`, and each host
registers its pools beside the cast engine, through the same
`foeSinks` the cast engine already takes - one set of doors per entity,
exactly as one manager per entity.

Gating the damage frames needed care in the two pools that do not have
the dungeon's shape. The dungeon suppresses the whole mobile update
under paralysis, so its hit and shoot frames never resolve; the
exterior pools resolve off the mobile's own frames, so freezing only
the attack MACHINE would have let a swing already in flight land its
blow. `EnemyAttack.Update`'s early return is what makes that not
happen in DFU, and the gate is now written out in both.

**And the dungeon's own loop was not the broker's either.**

```js
for (let r = _prevMinute; r < Math.floor(classicMinutesRef.value); r++)
```

Its own arithmetic, from the clock at the top of the frame - so it had
neither the broker's catch-up nor its 2880-minute cap, and any minute
added by somebody else (the rest window, a court sentence) was simply
lost for the foes rather than merely late. It rides the claimed window
now, like everything else.

**A loop in the wrong place, off by one.**

Moving the fan-out exposed a passenger. PlayerEntity's per-minute loop
- the 112-day reputation normalisation - had been written *inside* the
broker's round loop by AUDIT 23, and it does not belong there:

```csharp
uint minutesPassed = gameMinutes - lastGameMinutes;
for (int i = 0; i < minutesPassed; ++i)
    if (((i + lastGameMinutes) % 161280) == 0 && !preventNormalizingReputations)
        NormalizeReputations();
```

That is `PlayerEntity.Update` (:452-459), on **PlayerEntity's own**
`lastGameMinutes`, with **no cap** - DFU steps a 21-day prison sentence
through all 30,240 of its minutes while the broker sees only the last
2,880. And the minute values it tests are `[last, now)` with no `+1`,
while the broker's rounds represent `[last+1, now]`. Living inside the
broker's loop, the port had inherited its `r + 1` and normalised one
game minute late.

Two off-by-ones, then: the cap, and the minute. Neither is
world-ending, and both are exactly the kind of thing that survives
forever once a law is filed under the wrong owner. The pin that
covered the boundary had probed the minute *after* it, so it certified
the port's own error - *a pin aimed at the middle of a band tells you
nothing about its edge*, one more time.

**Twenty-two mutants: twenty dead, two recorded as equivalent.**

Making `runMagicRoundsFor` advance the marker as well survives
everything, and genuinely cannot be observed: the next claim's
`fromMinute` is the clock before that frame's step, which can never
exceed the previous claim's `to`, so an overshot marker always trips
the load re-anchor and is corrected before it can skip a round. The
split still matters - a subscriber that owns the marker is a
subscriber that only works when it is called first - but that is a
reason a test cannot reach, and it is written into the test as such
rather than dressed up as a kill. The second is the `Number.isFinite`
guard on the entity marker: no caller can put a non-finite value
there, and if one did the loop would decline to run either way.

**Found, verified, and deliberately NOT fixed here.**

```csharp
if (entityBehaviour.Entity.IsParalyzed)
{
    mobile.FreezeAnims = true;
    CanAct = false;
    flyerFalls = true;
}
mobile.FreezeAnims = false;
```

`:259` is outside the brace. `FreezeAnims` is a plain field with a
plain setter, there are exactly five references to it in the whole
tree, and nothing reads it between the two writes - so a paralysed
enemy's animation is **never** frozen in DFU, and
`UpdateToIdleOrMoveAnim` (called after the `if (CanAct)` gate) puts a
stationary one into Idle, which keeps playing. The comment on :252
says the freeze "also prevents the attack from triggering", and that
is done by `EnemyAttack`'s early return instead.

The port's dungeon host freezes the sprite, and quotes that comment
while doing it. An independent verifier chased every refutation - a
second writer, a side-effecting setter, a partial class, a `#if`, some
other mechanism in the animation layer - and found none, then went
further than asked: the port freezes the **orientation** too, so a
paralysed foe never turns to face you, and `UpdateOrientation` has no
`FreezeAnims` check at all even under the port's own mistaken model.
It also flagged, unprompted, that for the ~48 enemies with a static
idle sprite the difference may be invisible, while the 13 with
`HasIdle = false` - every flyer, every spectral, every aquatic - fall
back to the **move** cycle for their idle and would visibly keep
animating.

It is not in this wave because undoing that freeze reopens the damage
frame it currently suppresses, and DFU latches `doMeleeDamage` through
the paralysis and lands the blow when it clears. That is its own piece
of machinery and it gets its own wave.

**Twenty-eight findings remain**, plus that one.


### Wave 33

**A paralysed enemy is not a photograph.**

Wave 32 closed with a finding it refused to fix in the same breath.
This is it.

```csharp
void HandleParalysis()
{
    // Freezing anims also prevents the attack from triggering until paralysis cleared
    if (entityBehaviour.Entity.IsParalyzed)
    {
        mobile.FreezeAnims = true;
        CanAct = false;
        flyerFalls = true;
    }
    mobile.FreezeAnims = false;
}
```

`:259` is outside the brace at `:258`. Two plain field assignments sit
between the write and the overwrite - no call, no yield, no event.
`FreezeAnims` is a plain `bool` behind a plain getter and setter,
there are exactly five references to it in the entire tree, and the
only two writers are those two lines. It is a **dead store**, and the
comment three lines above it is describing a law the code cancels.

So in DFU a paralysed enemy keeps animating. `UpdateToIdleOrMoveAnim`
is called *after* the `if (CanAct)` gate, unconditionally, and puts a
stationary one into `Idle`, which plays; `UpdateOrientation` has no
`FreezeAnims` check at all, so the sprite keeps turning to face you as
you circle it. What stops the blow is `EnemyAttack`, which returns at
the top of `Update` while paralysed.

The port's dungeon host skipped the whole mobile update and redrew a
cached output - and it quoted that comment while doing it, in the
source and in `Combat.md` twice. It froze the **facing** as well as
the frame, which DFU would not do under any reading, mistaken or
otherwise.

The verification is the part worth recording. This was a claim about
DFU that would reverse shipped, pinned behaviour, so it went to an
independent refuter with a list of six specific ways it could be
wrong - a second writer, a side-effecting setter, a partial class, a
`#if`, some other mechanism in the animation layer, and the awkward
one: *if `Idle` is a single-frame sprite for most enemies, "keeps
animating" and "holds its frame" are the same picture and the finding
is empty.* It came back CONFIRMED on the first five, and on the sixth
it did what a good refuter does - it conceded the point as far as the
evidence went (~48 enemies have a static idle and no ARENA2 data is on
this machine to check the frame counts), and then showed the finding
survives anyway: the thirteen enemies with `HasIdle = false` fall back
to the **move** cycle for their idle, and those thirteen are every
flyer, every spectral and every aquatic in the game. A paralysed bat
keeps flapping while it falls. It also volunteered the orientation
freeze, which nobody had asked about.

**And the blow is not dropped. It waits.**

```csharp
if (mobile.DoMeleeDamage)
{
    MeleeDamage();
    mobile.DoMeleeDamage = false;
}
```

`EnemyAttack.Update:97-100`, and that clear is the **only** writer of
`false` in the tree. The animation coroutine sets the flag when the
sequence reaches its `-1` marker; the paralysis return at `:93`
happens *before* the clear. So a swing that reaches its damage frame
during paralysis stays armed and lands on the first unparalysed frame.

The port's flags were per-frame edges, cleared at the top of every
`update()`. Under the dungeon's freeze the marker was never reached at
all; under wave 32's exterior gate it was reached and thrown away.
Both dropped a blow DFU delivers. They are latches now, named
`doMeleeDamage` and `shootArrow` after the members they are - a name
that says "frame" for something that persists across frames is the
same hazard as a comment for a line that is not there - and all three
pools consume-and-clear exactly as `EnemyAttack.Update` does. The gate
asserts the pairing: every latch read in a host has a clear, counted.

Seven mutants, seven kills - including reinstating the freeze and
removing any one of the three clears, which is the failure mode a
latch invites.

**Twenty-eight findings remain.**


### Wave 34

**AttemptMove is not "move".**

The twelve-agent host-parity sweep landed while wave 32 was being
written - 61 agents, two independent refuters per claim, and a
synthesist that re-read every port cite against the working tree and
opened its report by **voiding three of its own confirmed findings**
because waves 32 and 33 had already closed them. Its number one, and
the most player-visible thing on the list:

```csharp
ObstacleCheck(direction2d);
FallCheck(direction2d);

if (fallDetected || ObstacleDetected)
{
    if (!strafe && !backAway)
        FindDetour(direction2d);
}
else
// Clear to move
{
    if (swims) WaterMove(motion); else controller.Move(motion * Time.deltaTime);
}
```

The translation is inside the `else`. None of the probe was ported -
the port moved unconditionally and let the capsule slide - so a foe
pressed into a wall and ground along it, and walked off any ledge in
its path. DFU refuses the step and commits to a way around.

**ObstacleCheck** (:1140-1201) casts a capsule of half the
controller's radius over `radius / sqrt(2)` - "follow walls at 45
degrees incidence" - from a point `0.1388` of the body below its
centre, which is the climbable-step height. Three things clear the
flag: the obstacle is the combat target, it is a `DaggerfallActionDoor`
(which also records it for OpenDoors), or a taller capsule aimed a
unit ahead and a unit UP is clear, which makes it a climbable slope
rather than a wall.

Two of those three cannot fire here and are documented rather than
written as dead branches: entities are not in the port's collider at
all, and neither is a loot pile. The door arm can and does - doors are
their own collider buckets, keyed by the action object, which is the
same key the senses already hand the host for OpenDoors. The AI cannot
resolve a key to an action object, so it asks: `isActionDoor` is a
dep, defaulting to false, and the dungeon host wires the registry it
already owns.

**FallCheck** (:1204-1218) is a downward ray from a unit ahead,
reaching `height * 0.5 + 1.5` - and it early-outs on an obstacle, a
slope or a door, which is why ObstacleCheck must run first. Because
the ray starts at the controller CENTRE, which is `height / 2` above
the feet, the two halves cancel: the real limit is a metre and a half
below the foe's own soles, and the pin probes both sides of it.

**FindDetour** (:1002-1137) is the interesting one. Flyers and
swimmers try a +/-0.3 vertical dodge first, one way then the other,
and skip the horizontal sweep entirely if it works. Two seconds clear
of trouble resets the committed hand. Otherwise, once per five
seconds, a hand is chosen - 45 degrees one way picked at random, then
the other, and if both are blocked, by the signed angle from the
direction to the destination; a second visit inside those five seconds
simply flips it. Then the sweep steps 45 degrees at a time in the
committed hand until something is clear, giving up after eight tries.

That bound has a quirk worth stating, because it is the difference
between the port being right and being merely plausible: `angle`
starts at zero and moves 45 degrees per probe, so the **eighth probe
is a full 360** - it is the original heading again. A boxed-in foe
therefore commits to walking two units straight into the thing that
blocked it and comes back here three-quarters of a second later. Raise
the bound and the last probe lands somewhere else entirely, which is
exactly what the mutant that raised it did, and what the pin now
catches.

**A capsule cast the engine did not have.** DFU delegates the geometry
to Unity; `collider.js`'s header has always said the port owns it and
must honour the contract. `capsuleCast` is a ray bundle - samples
along the axis, each with four more at the cross-section radius -
which is the same kind of approximation the two-sphere capsule beside
it already is, sized for its one caller. The detail that mattered:
a real `CapsuleCast` leads with its cap, so it touches an obstacle
`radius` before the axis reaches it and reports the distance
**travelled**. The first cut cast from the axis and reported the raw
ray distance, and a foe walked up to a wall, stopped 0.1 short of
being able to see it, and stood there. Both halves are pinned.

**An import cycle, revealed by a constant.**

```
ReferenceError: Cannot access 'CAPSULE_RADIUS' before initialization
```

Twelve test files, from one new line. `player/motor.js` imported
`DF_WALK_BASE` from `characters/enemyMotor.js` while `enemyMotor.js`
imported the capsule constants back from `motor.js` - a cycle wave 24
created deliberately, and which stayed invisible for as long as every
use sat inside a function body. `OBSTACLE_CHECK_DISTANCE =
CAPSULE_RADIUS / Math.SQRT2` is module-level, and the ring closed on
it. The edge is turned round: `DF_WALK_BASE` now lives in `motor.js`
beside its sibling `DF_CROUCH_BASE`, still declared exactly once. This
is the second cycle in four waves - wave 31 hit `effects -> spellcast
-> formulas` the same way - and both were invisible until something
had to be evaluated at module scope.

**Twenty-four mutants, twenty-four kills** - six of them only after
the pins were rebuilt. The interesting failures: a pin that asserted a
foe "stayed on the floor" could not tell the fall probe's reach from
its existence until it probed both sides of the edge; a pin that
watched a wall could not tell "did not translate" from "the capsule
blocked it" until it counted what the move was actually asked for; and
a pin on a boxed-in foe could not tell the eight-probe bound from an
infinite one until it pinned which direction the last probe picks.

**FLAGGED, and next.** `GetDestination`'s other two arms are still
unported: the `ClearPathToPosition` gate on the predicted target
position, and the `LastKnownTargetPos + LastPositionDiff * searchMult`
search. A foe still beelines at the player's LIVE position through
walls rather than searching where it last saw them - and
`ClearPathToPosition` is literally ObstacleCheck plus FallCheck plus a
sphere cast, so it could not have been written before this wave.

**Twenty-seven findings remain**, plus thirteen the sweep added.


### Wave 35

**The archer walked up and shot you in the face.**

```csharp
// Ranged attacks
if (DoRangedAttack(direction, moveSpeed, distance, isPlayingOneShot))
    return;
```

`TakeAction:468-470`, ahead of the advance/retreat decision, and
`DoRangedAttack` ends with `return true`. So a classic bow or
ranged-spell enemy inside the 6 - 51.2 metre band, with the target in
sight, **does not pursue at all**: it turns to face and rolls its shot.
Unported, so the port's archers closed to 2.25 like everything else -
and the port's own ranged band, which lives in the attack and cast
components, then only fired during the charge, because 2.25 is under
the 6-metre floor. The band was self-extinguishing.

**And the destination was always the player, live.**

Wave 34 ported the first of `GetDestination`'s three arms and flagged
the other two. They are the ones that make a foe behave like something
with eyes:

```csharp
else if (ClearPathToPosition(senses.PredictedTargetPos, (destination - transform.position).magnitude)
      || (senses.TargetInSight && (hasBowAttack || entity.CurrentMagicka > 0)))
{
    destination = senses.PredictedTargetPos;
    ...
    searchMult = 0;
}
else
{
    Vector3 searchPosition = senses.LastKnownTargetPos + (senses.LastPositionDiff.normalized * searchMult);
    if (searchMult <= 10 && (searchPosition - transform.position).magnitude <= stopDistance)
        searchMult++;
    destination = searchPosition;
}
```

`ClearPathToPosition` is the wave-34 probe pair plus a sphere cast, and
it could not have been written before that wave. The search arm needed
a memory the port did not have at all: `LastKnownTargetPos`,
refreshed by sight or earshot and **guarded** by a 200-tick LOS timer
so that a bare stealth detection does not overwrite it - the source
says why in as many words, "this gives better pursuit behavior since
enemies will go to the last spot they saw the player instead of walking
into walls". And `LastPositionDiff`, which is only differenced across
two CONSECUTIVE prediction passes that both had sight.

One thing the classic path does NOT have, and the port therefore does
not either: prediction. `predictedTargetPos = lastKnownTargetPos` runs
every pass under `|| !EnhancedCombatAI`, and `PredictNextTargetPos` is
called only inside the Enhanced guard. The port writes the assignment
and no lead. That is verbatim, not a gap.

**The band moved house, to avoid a fourth cycle.** `enemyAttack.js`
declared `MIN/MAX_RANGED_DISTANCE` and imports `MELEE_DISTANCE` from
`enemyMotor.js`; the motor now needs the band, and importing it back
would have closed the third import cycle in three waves. It is declared
in the motor - beside `MELEE_DISTANCE`, which carries the same
`EnemyAttack.cs` citation - and re-exported. Wave 31's leaf, wave 34's
turned edge, this one's move: three shapes for the same problem, and
the only reason any of them was visible is that something had to be
evaluated at module scope.

**A scout that ran while the wave was being written.**

Three lenses, sixteen claims, one refuter each. Two lenses scouted this
slice; the third re-read what waves 32, 33 and 34 had just shipped, and
it found **four real defects in them**, which is why it existed:

1. *A detouring flyer aims two units above its detour destination.*
   `_dir3` applied the "aim for the target's face" offset to whatever
   it was handed, and wave 34 started handing it the detour
   destination. GetDestination is where DFU puts that offset (:542-545)
   - and once it was ported there, the flyer got it twice and stopped
   3.6 units short of melee range instead of at it. Both halves fixed;
   `_dir3` returns the direction to the point it is given and nothing
   more.

2. *ObstacleCheck recorded a door with no yaw gate.* DFU only writes
   `senses.LastKnownDoor` when the door is within 22.5 degrees of
   facing (:1170-1175). Wave 34 recorded any door the probe struck -
   and `FindDetour` probes 45, 90, 135 degrees off, so a foe working
   its way round a corner would have the host open a door **behind**
   it.

3. *The stop distance measured to the player.* DFU measures to the
   DESTINATION unless the target is in sight (:479-482), which during a
   search is the last known position. Without it, a foe searching a
   room it had lost you in would stop dead the moment you came within
   2.25 metres of it - through the wall it could not see through.

4. *The damage-frame consumers were two independent ifs, arrow first.*
   `EnemyAttack.Update` is `if (DoMeleeDamage) {...} else if
   (ShootArrow) {...}` (:97-105). Wave 33's latch made both survivable
   at once, so a foe with both set would loose an arrow AND land a
   blow in the same frame, and would prefer the arrow.

It also observed that `capsuleCast`'s four-spoke rosette leaves the
diagonal quadrants unsampled. Four more rays over a fifth of a metre;
taken.

**Twenty-eight mutants, twenty-eight kills** - three of them only after
the pins were rebuilt, and one of those rebuilds mattered on its own
account. The wall pin asserted that the detour destination was two
units away *at the end of forty ticks*, which it is not: the foe walks
to it, arrives, and buys another. It had been passing on the geometry
of one particular collision, and the diagonal rays changed that
geometry. The claim it should have been making all along is the one it
makes now - the foe ends up **sideways** of where it started, which a
capsule grinding into a flat wall it is walking straight at can never
be.

**Twenty-six findings remain**, plus ten the host-parity sweep added.


### Wave 36

**One object, three bugs.**

```js
{ playerInvisible: isInvisible(playerEntity) }
```

That is the senses context all three exterior call sites handed their
foes. The dungeon built eight fields; above ground seven were missing,
and each absence was its own failure:

- `playerBlending` and `playerShade` read `false`, so **Chameleon and
  Shade did nothing at all outside a dungeon**. S21 shipped all three
  illusion branches and two of them were unreachable in two thirds of
  the game.
- `playerStealth` defaulted to 0, so `Dice100.FailedRoll` was computed
  from a Stealth of zero whatever the character's actually was - and no
  Stealth tally ever fired outdoors, so the skill could not advance
  there either.
- And the quiet one. `_stealthCheck`'s per-minute gate is
  `gameMinutes === this._lastStealthMinute`, and `gameMinutes`
  defaulted to 0. After the first check the equality held **forever**,
  and every later call returned the cached `detected`. Detection froze
  on its first roll for the life of the foe.

None of it is a dungeon law in DFU. `StealthCheck`'s three guards are
the dungeon-castle non-hostile exclusion, `wouldBeSpawnedInClassic` -
which `classicSpawnDespawnExterior` sets outdoors - and a range test.
There is one builder now, in `scenes/shared.js`, and the dungeon uses
it too.

The shared-stealth box moved onto the **player entity** on the way,
because that is where DFU keeps it: `PlayerEntity.TimeOfLastStealthCheck`
is one field on one player, so the tally fires once per classic minute
across every foe in the game. The dungeon's private per-host box was a
smaller version of the same mistake - two hosts could tally the same
minute twice.

**The flag the watch never touched.**

`EnemySenses:531-535` raises the enemy alert from any enemy that is
targeting and seeing the player - the last statement of FixedUpdate, at
method-body indent, not inside a conditional. `cityGuards.js` had
`g.ai.detected` and `g.ai.inSight` in hand and never called it, and
never lowered it on death either.

Worse, `decayEnemyAlert` had exactly one caller in all of `src/`: the
dungeon frame body. The decay is `PlayerEntity.Update:380-384` - the
entity update, context-free - and the encounter pool has been RAISING
the flag since the X-slice. So an alert raised in the wilderness never
decayed, and permanently armed the dungeon's random-spawn roll. It
lives in `createPlayerTicker` now, which every host already calls, and
the dungeon's own call is gone so it cannot tick twice.

And the watch took no fall damage. `ApplyFallDamage` runs
unconditionally for every enemy (:173), the port's motor has always
produced `landedFall` for guards, and the value was read by nobody.

**And a freeze wave 35 could have shipped.**

The wave-35 scout landed after the wave, as the wave-26 scout did, and
found one thing in it worth the whole run:

```csharp
senses.OldLastKnownTargetPos = attacker.transform.position;
senses.LastKnownTargetPos = attacker.transform.position;
senses.PredictedTargetPos = attacker.transform.position;
GiveUpTimer = 200;
```

`MakeEnemyHostileToAttacker` seeds the remembered position as well as
refilling the timer. The port's `makeHostileToPlayer` set only the
timer - harmless for as long as nothing read a remembered position, and
wave 35 made `HandleNoAction` refuse to act without one. A watchman
spawned hostile out of sight, which is exactly how the watch arrives,
would have had a full give-up timer and nowhere to spend it. DFU hands
it the attacker's position precisely so it walks to where the attack
came from.

That is the second time in this arc that a scout running alongside a
wave caught a bug the wave itself introduced, and the second time the
bug was invisible to the wave's own pins because the pins tested the
law the wave was adding rather than the state it was assuming.

**Sixteen mutants, sixteen kills.** Two of the pins had to be built
carefully rather than obviously: the frozen-detection one has to
demonstrate that the *cached* answer comes back, which means changing
`detected` behind the check and showing it does not matter; and the
seeded-hostility one has to place the attacker dead ahead, or the yaw
gate turns the foe in place and the pin measures the wrong law.

**Twenty-six findings remain**, plus seven from the host-parity sweep.


### Wave 37 - the guard that guarded the wrong thing

A screenshot from the deployed build, not an audit finding:

```
CRASH
TypeError: can't access property "pointerdown", it is undefined
```

Both browser hosts install their pointer and wheel listeners about six
hundred lines above the mode machine those listeners talk to:

```js
canvas.addEventListener('pointerdown', (e) => {
  if (townTalk.pointerdown(e)) return;
  if (modes.pointerdown?.(e)) return;      // <- here
  requestLook(canvas);
});
...
var modes = createWorldModes({ ... });     // ~600 lines below
```

The `var` is deliberate and correct. It hoists, so the closures reach a
binding that *exists* and reads `undefined` until the assignment runs,
rather than a `const` whose every earlier reference is a
`ReferenceError` out of the temporal dead zone. What was missing is the
other half of that bargain: if the binding can read `undefined`, the
guard has to be on the **object**. `modes.pointerdown?.(e)` optional-
calls the *method*. It reads like a guard, it satisfies the eye, and it
dereferences `modes` unconditionally before the `?.` is ever consulted.

The window is not theoretical. `?world` has exactly one `await` between
the registration and the assignment - `const questPack = await
loadQuestPack();` - and a quest pack is a network fetch. Click the
canvas while it is in flight and the listener runs against `undefined`,
throws, and takes the whole scene down. That is what the screenshot is.

`?exterior` carries the identical shape with no `await` in its window,
so the crash is latent there rather than live. It is fixed the same
way, because a single added `await` is all that stands between the two.

**The cure is mechanical, and deliberately so.** Every reference above
either declaration is now `modes?.`, including the five that were
already safe by short-circuit:

```js
collider: { raycast: (o, d, m) => ((modes?.mode === 'interior' && modes?.interiorCollider) ? ...
if ((modes?.mode ?? 'exterior') !== 'exterior') modes?.forceExitToExterior();
```

Those two could not throw - `modes?.mode` is `undefined`, the `&&`
short-circuits, the `!==` is false and the call is never reached. But a
rule with an exception list is a rule nobody can check, and the
exceptions are exactly the lines a later edit rearranges. All or
nothing is a gate; "safe by inspection" is a comment.

`test/audit24_wave37.test.js` holds both halves, over both hosts. It
takes the shipped listener line out of the file, runs it through a
`new Function` harness whose only local state is a hoisted, unassigned
`var modes` - the precise state the crash happened in - and fires the
handler. The guarded line falls through to `requestLook`; the one-
character mutation back to `modes.pointerdown?.(` throws the reported
`TypeError` verbatim. Then it strips comments (prose says "modes"
constantly), finds the declaration, and asserts no plain `modes.` or
`modes[` survives above it. Then it asserts the declaration is still a
`var` - and demonstrates why, by running the same guarded closure in
front of a `const` and catching the `ReferenceError`, because `?.` does
not reach into a dead zone. Then it asserts the crash shape
(`modes.method?.(`) is gone from the scene layer entirely, and that no
second hoisted binding has appeared to repeat the trick.

**Thirteen mutants, thirteen kills**, and two equivalents recorded
rather than dressed up: putting a `?.` on `modes.frame(dt, now)`, or
turning `modes.installShotProbes()` into an optional call, both survive.
They are *below* the declaration, where the binding is assigned and the
two forms are the same program. The gate is about reachability, not
style, and it says nothing about them - correctly.

Two existing pins had to be edited to take the fix -
`hostmagic_wiring` quoted `modes.interiorCollider` and `teleport`
quoted `modes.forceExitToExterior();`, both verbatim, both as the
correct text. That is the sharpest thing in the wave. Those lines were
not merely unreviewed; they were *pinned in their unguarded form*, and
the pins passed, because the law each one was written to protect - the
mode facade, the forced exit - was never the law that was broken. A pin
quotes the line it cares about and inherits everything else in it.

The lesson generalises past this binding. **AN OPTIONAL CALL IS NOT AN
OPTIONAL DEREFERENCE.** `a.b?.()` promises only that `b` may be absent;
it asserts that `a` is not. Every one of the four listener lines had
been read and reviewed repeatedly across the arc, and the `?.` in them
is why: it looked like the check had already been made.

**Twenty-six findings remain**, plus seven from the host-parity sweep.


### Wave 38 - EnemyDeath, and the corpse nobody could open

`EnemyDeath.CompleteDeath` (:62-141) runs for every enemy in
Daggerfall. It does five things. The port's two above-ground pools did
one of them.

```csharp
DaggerfallLoot loot = GameObjectHelper.CreateLootableCorpseMarker(...);
...
loot.Items.TransferAll(entityBehaviour.Entity.Items);
DaggerfallUI.Instance.DaggerfallAudioSource.PlayClipAtPoint(
    SoundClips.BodyFall, loot.transform.position, 1f);
```

**The corpse nobody could open.** `exteriorFoes` rolls the loot table
into `entity.items` when it spawns a foe, equips it, and on death mints
a corpse billboard. Then it stops. The pool exported
`{ foes, spawnFoe, damageFoe, update, resolvePlayerHit, batches,
offsetAll, activeCount }` - no activation seam at all - so every
encounter kill's loot and equipment were generated, drawn on the
ground, and unreachable for the life of the session. The watch has had
the seam since G3. The encounter pool never got it, and nothing ever
noticed because a corpse you cannot open looks exactly like a corpse
you have already emptied.

**The corpse in mid-air.** `CreateLootableCorpseMarker` asks the motor
where the ground is (:817, `enemyMotor.FindGroundPosition()`). The
dungeon does this - it has a `C12` comment about flyers dying on the
wing. Both exterior pools passed the foe's last feet straight through,
so a bat or a harpy left its body hanging where it was killed.

**The sound of a kill.** :126-129 plays `SoundClips.BodyFall` at the
corpse, unconditionally, in every context. No pool in the port played
it, the dungeon included.

**The kill notice.** :79-83 pops `"%s just died."` The port never said
it - and could not have, easily, because the name it needs
(`GetLocalizedEnemyName`) lived in `systems/quest/foe.js`, behind the
quest machinery, where nothing outside a quest could reach it without
risking the import cycle this arc has now hit three times.
`ENEMY_NAMES` and `isClassEnemyId` moved down to
`characters/enemyBasics.js` - a true leaf with zero imports, which
`quest/foe.js` already imports anyway - and `quest/foe.js` re-exports
them, so the edge got shorter rather than longer.

That move turned up its own bug. The dungeon's pacification line reads

```js
`${ENEMY_BASICS[f.mobileType]?.name ?? 'The enemy'} is pacified by ...`
```

and **no row in `ENEMY_BASICS` has ever carried a `name` field** - all
62 of them leave it undefined. So every pacification in the game, since
the C-slice shipped it, has said "The enemy is pacified by your Orcish
skill." The `?? 'The enemy'` fallback is what hid it: it made a lookup
that always failed look like a lookup that sometimes did.

**One home.** All of the above lives in `scenes/corpseMarker.js` now,
because the two exterior mints were the same code to the line - the
second copy of a thing worth writing once. PlayerActivate's
`CorpseMarker` arm (:936-955) came with it, and it has arms the port
did not have: an EMPTY body is told to you and the container is then
DISABLED (:942-947 - the watch pool skipped empty corpses silently, so
the line was unreachable), and a body holding nothing but arrows is
collected whole with no window (:948-952 - which is the ordinary
outcome of killing anything with a bow, since the landed arrow joins
the target's inventory). Neither taking arm disables the corpse:
DFU disables on the activation that *finds* it empty, which is the
next one, so the player is still owed the line.

**The knockback gate, which is a precedence trap.**

```csharp
if (enemyMotor.KnockbackSpeed <= (5 / ratio) &&
    entityBehaviour.EntityType == EntityTypes.EnemyClass ||
    enemyEntity.MobileEnemy.Weight > 0)
```

`&&` binds tighter than `||`, so this is
`(speed <= 5/ratio && isClass) || Weight > 0`. The encounter pool had
written only the first *half* of the first arm - `speed <= 5/ratio`,
no `isClass`, no Weight - and that broke it at both ends. A weighted
monster could not be chain-knocked, because one hit leaves the speed at
5.63 against a threshold of 1.27 and the second hit inside that shove
found the gate shut, where DFU knocks it again without asking. And
Ghost (18) and Wraith (23) - the only two rows in the table at Weight
0, which is *precisely why* DFU's gate spares them - reached the
formula and got `(10d / 0) * (2d - 2d)`: an Infinity times a zero,
which is **NaN**. That NaN then sat in `knockbackSpeed` for the rest of
the foe's life, and since every comparison with a NaN is false, no
later hit could ever write the field again either. The gate is one
exported function now (`weaponKnockbackApplies`), asked by all three
pools; the dungeon was the only one that had the precedence right, and
one home is what stops the other two drifting off it a second time.

**Twenty-four mutants, twenty-four kills**, and two equivalents
recorded rather than dressed up: the `?? 0` inside the gate (every
caller already defaults the weight) and `Array.from(feet)` for the
no-collider position both survive, correctly.

**And an accident worth recording.** A four-slice scout ran alongside
this wave - 30 agents, 2.2M tokens, 26 claims - and its verify phase
overlapped the implementation. Five of its seven refutations are
refutations of *this wave's own fixes*: it went looking for the
unlootable corpse, the mid-air corpse, the missing BodyFall, the
unreachable empty-corpse line and the dropped knockback gate, and found
all five already there. One verifier wrote that the port "reproduces
DFU's precedence bug exactly", which is the nicest thing anyone has
said about this repo.

That is not independent verification that the fixes are *right* - the
agents confirmed the code is present, not that it matches, and the
mutation campaign is what speaks to correctness. But it is a clean
demonstration of something the arc keeps relearning: **the scout and
the wave must not read the same tree at the same time.** The findings
are real; the verdicts on them were stale before they were written.

Its other twenty-one claims stand, and are the queue below.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus the seventeen this scout confirmed that this wave did not close.


### Wave 39 - nothing bled, and nothing hurt

Two whole DFU components, neither of them ported.

**`EnemyBlood.ShowBloodSplash`.** Twelve lines. The port had generated
`bloodIndex` into `ENEMY_BASICS` *correctly* - the same six rows DFU
gives a 2, everything else left at the struct default 0 - and then
nothing read it. `grep -rn bloodIndex src/` returned six data lines and
a test asserting the data existed. Not one splash, for any hit, in any
pool, since the first enemy shipped.

**`ShowPlayerDamage`.** Thirty-seven lines, of which the whole
behaviour is three: alpha starts at `0.4`, falls at `0.7` a second,
paints the screen red. The player took every hit in the game with no
feedback at all.

Both are cheap, and both were reachable the whole time: the one-shot
billboard clock had already been ported for the missile impact
(`render/flatAnimation.js`, DFU's display-then-advance coroutine
verbatim), and `drawScreenQuad(null, ..., alpha < 1)` has been the
renderer's blended solid since U10. What was missing was the wiring,
which is the thing an audit finds and a feature never does.

**Which hits flash is a law, not an omission.** This is the part worth
getting right. The flash rides `PlayerHealth.RemoveHealth`, and the
whole DFU tree sends that message from exactly three places:
`EnemyAttack.cs:406` (an enemy's blow, gated on `damage > 0`),
`DaggerfallAction.cs:739` and `:768` (the dungeon damage traps), and
`PlayerHealth.cs:57` (its own fall arm). **Spell damage does not
flash** - `DamageHealth`, `ContinuousDamageHealth` and `TransferHealth`
all go through `DamageHealthFromSource` -> `Entity.DecreaseHealth`,
which never touches `PlayerHealth`. Neither do poison, disease or
starvation. Being set alight by a Fire Daedra flashes the screen
because the *claw* lands, not because the burning does.

The mutation campaign has an arm for that specific direction: adding
`flashPlayerDamage` to the spell host is a mutant, and it is killed.
**THE PORT MUST NOT BE MORE ACCURATE THAN THE THING IT IS A PORT OF**
cuts both ways, and "more responsive" is a kind of more accurate.

**Two more call sites are deliberately not ported**, for the same
reason:

- `DaggerfallEntityBehaviour.cs:173-176`, the `showBlood` arm. Every
  caller in the tree passes `false`. It is dead code in the shipped
  game, and porting it live would make spell damage bleed.
- `EnemyHealth.cs:52`. `grep EnemyHealth` over the DFU tree returns
  nothing outside that file - a DFTFU-era component no shipped scene
  carries.

A third, `EnemyAttack.cs:332`, is foe-vs-foe melee, which the port's
pools do not do yet; it is written down against the day friendly fire
lands rather than invented now.

**`ShowMagicSparkles` is cut from this wave on purpose.** It is the
same billboard at record 3, fired whenever a cast's target type is
neither `SingleTargetAtRange` nor `AreaAtRange` - so rangeType 0, 1 and
3, at the *target's* centre. Two of those three arms have a target foe
to hang it on; the `CasterOnly` arm needs the player's feet, and
`createPlayerMagic` is handed an eye, not a body. A function with no
caller is a comment, and a function with two callers out of three is
worse. The gate is recorded in the module header and the finding is in
the queue.

**Two positions, both DFU's.** A splash goes at
`transform.position + controller.center` with `y += height / 8` - five
eighths of the way up - which is DFU's own formula at the site where it
has no raycast to work from. The port's melee resolves by yaw cone and
distance rather than a sphere cast, so that formula stands in for
`impactPosition` at the weapon-hit sites. Exactly one port site has
DFU's real impact point: the civilian murder, where the ray already
found the person at `bestD`. Fall damage is different again - DFU
passes `transform.position`, the base, while its comment says "falling
enemies bleed at the center". The line does not add `controller.center`.
The feet are what DFU passes, so the feet are what the port passes, and
the comment is noted as the thing it is.

**THE FOUR HOSTS RULE, applied before the fact.** The flash could have
been pasted into four frame bodies - `dungeonContext`, `world`,
`exterior`, `worldModes` all draw the HUD - and would then have drifted
in four directions. It rides `drawHud` instead, the one host-agnostic
call all four already make "last, over the viewmodel", and it runs
*before* that function's `if (!art) return`, because a host that never
loaded the HUD art still takes damage.

**Thirty-two mutants, thirty-two kills**, two equivalents recorded.

One older pin had to move: `ch3` sliced a fixed 500 characters after
`f.ai.landedFall > 0` and asserted `damageFoe` was inside the window.
An added comment pushed it out, and the pin failed on behaviour that
had not changed. A window is not a block; it brace-matches now.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus fifteen the wave-38 scout confirmed that these two waves have not
closed.


### Wave 40 - the fourth argument

A second crash screenshot from the deployed build:

```
TypeError: can't access property "glyphWidth", s is undefined
```

The stack mapped exactly - the local build is byte-identical to the
deployed bundle, so the five minified frames could be read straight
off:

```
us   (text.js measureText)  <- s.glyphWidth
draw (questJournal)         <- const tf = largeFont ?? font
draw (charsheet)            <- return this.child.draw(renderer, canvas, font, s)
ys   (townTalk.frame)       <- overlay.draw(renderer, canvas, font, hudScale)
is   (the host frame body)
```

**Open the character sheet, press LOGBOOK, and the scene died.** Every
time, on every host that has quests.

Every window in `src/ui` takes `draw(renderer, canvas, font, s)`, where
`s` is the HUD scale - that is townTalk's contract, and `CharSheet.draw`
forwards its own four arguments straight through to a pushed child.
`QuestJournalWindow` alone declared its fourth parameter as
`largeFont = null`. A number is not nullish, so `largeFont ?? font`
picked the *scale*, and `measureText` was handed `3 .fnt`.

The part that makes it more than a typo: **nothing in the tree had ever
passed a real font there.** The parameter had never once received what
it was declared for. It existed only to be filled by mistake - and the
one caller that could reach it filled it with a number on every frame
the window was open.

This is the wave-37 shape again, one layer up. There the guard was on
the wrong half of an expression; here the contract is on the wrong half
of a signature. Both are cases of a thing that *looks* considered:
`modes.pointerdown?.(e)` looks guarded, and `largeFont = null` looks
like an optional dependency. Neither was.

**The law was real; only its delivery was wrong.**
`DaggerfallQuestJournalWindow.cs:161-163` builds the title label with
`Font = DaggerfallUI.LargeFont`, and `DaggerfallUI.cs:153` is
`LargeFont => GetFont(FontName.FONT0000)`. So the port SHOULD draw that
title in a larger font - it simply never has, because the parameter
carrying the law was never filled. FONT0000 is a module warm now,
loaded inside `preloadQuestJournalArt` beside the art it belongs with,
and the signature drops to three arguments like every other
native-panel window in the file. **A parameter a function does not
declare is a parameter nothing can fill by mistake.**

`test/audit24_wave40.test.js` holds three separate lines of defence:
the crashing shape reintroduced (and shown to throw the reported
`TypeError`, and shown to be *fine* when the fourth argument is absent,
which is why every direct test of this window passed); a behavioural
sweep that pushes each window the character sheet can open and makes
the sheet's real forward against it; and a signature rule over all of
`src/ui` - a `draw` may take three and ignore the rest, or four where
the fourth is the scale, and nothing else.

**Thirteen mutants, thirteen kills**, one equivalent. Two of those
thirteen only became kills after the pins were rebuilt, and both
failures were the same mistake wearing different clothes:

- `assert.match(src, /FONT0000\.FNT/)` was satisfied by the *warning
  string*, so a mutant that fetched FONT0003 left the pin green. The
  pin drives the preload and reads what it actually asked for now.
- the fallback pin ran after a successful warm, so `if (!_largeFont)`
  skipped the fetch and the throwing path was never reached. It imports
  a fresh module instance now.

*A PIN SATISFIED BY THE PROSE BESIDE THE LINE IS NOT A PIN.*

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus fifteen the wave-38 scout confirmed that these waves have not
closed.


### Wave 41 - the sound of nothing

`moveSound` and `barkSound` sit in all sixty-two rows of
`ENEMY_BASICS`. `grep -rn moveSound src/` returned sixty-two data lines
and nothing else. `attackSound` had exactly one consumer, written
inline in the dungeon's frame body.

So: above ground, nothing barked, nothing moved audibly, and nothing
made a noise when it swung at you. A watchman's entire vocabulary was a
single HALT on the detection rising edge - and **DFU has no
detection-edge bark at all.** That was an invention, faithfully
commented, sitting in the file header as if it were a citation. What
DFU does is run a three-to-nine second *attract* cadence for as long as
the enemy is within sixteen metres of you.

**And the dungeon's copy had drifted**, which is what a law living in a
frame body does. Three ways:

- its mute gate was `!entity.isClass`, where DFU carves the **city
  watch** out of the human mute (`:219-226`) - the one class enemy you
  are meant to hear;
- it never ran `SetVolumeScale`, so a bark came through a dungeon wall
  at full volume;
- it played on an **inverse** distance model, where DFU sets
  `LinearRolloff = true` with `maxDistance = AttractRadius` (`:57-60`).
  `loop3d` already carried that note for torches - "or the burning
  sound is audible almost everywhere" - and `play3d` hardcoded inverse,
  so the option did not exist to ask for.

One home now (`characters/enemySounds.js`), three pools, and the drift
closed on the way in.

**Two DFU quirks are kept because they are DFU's.**

The counter steps whether or not you are in range, and the source says
why: *"Keep stepping even when player not in attract radius. This means
the player will get audio feedback the moment an enemy is near."* Walk
up on a quiet dungeon and it greets you at once rather than after a
polite pause.

And `volumeScale` is a **field**, written only by `SetVolumeScale`,
which runs only inside `PlayAttractSound` - while `PlayAttackSound`
then multiplies by it (`:110`). So a foe whose last bark was muffled by
a wall keeps *swinging* quietly after it steps into the open, and one
that has never barked swings at full volume. That is not a bug the port
should fix.

The occlusion probe is passed as a **thunk**, because DFU makes a point
of its cost - *"Only checks when enemy plays attract sound, so not very
expensive"* - and because the order matters: `IgnoreHumanSounds`
returns *before* `SetVolumeScale`, so a muted enemy that is due and in
range casts no ray at all.

**Twenty-nine mutants, twenty-nine kills**, two equivalents. One of the
twenty-nine survived its first campaign and is worth writing down:
hoisting the occlusion probe out of the thunk and calling it eagerly is
invisible on any unmuted foe, which is all the pin was testing. It
differs on exactly one case - and that case is the one DFU's ordering
encodes. **A LAZY CALL AND AN EAGER ONE DIFFER ONLY WHERE SOMETHING
RETURNS EARLY, SO THAT IS WHERE THE PIN GOES.**

**ONE DFU MEMBER, ONE EXPORT, again.** `146` -
`MobileTypes.Knight_CityWatch` - was written out in **five** places:
the human-sound mute carves it out, the combat voice forces it male,
the equipment roll caps it at iron and steel, the class level roll adds
3-7 to it, and the watch pool *is* it. Each had its own literal. The
number lives once now, in `mobileTypes.js`, with the table it came
from.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus eleven the wave-38 scout confirmed that these waves have not
closed.


### Wave 42 - one they never did, and one they did twice

**The roll nobody above ground ever made.** `EnemySenses.cs:504-527`
rolls the player's language skill the first time an enemy detects
them: a success stands it down and tallies the skill by **three**
(DFU's BCHG over classic's one, "to make raising language skills
easier"); a failure tallies one, except for Etiquette and Streetwise,
which get nothing for being ignored.

The port had all of it. `enemyLanguageSkill` and
`calculateEnemyPacification` were ported verbatim; `EnemyAI` raises
`justEncountered` for **every** pool. And `grep -rn justEncountered
src/` found exactly one consumer: sixteen lines inline in the dungeon's
frame body. So no monster in a field and no watchman in a street has
ever been talked down, in a game where the language skills are a third
of a stealth build. An Orc that speaks Orcish is as talkable-down in a
meadow as in a crypt.

One home now, with the two guards DFU puts on it that the inline copy
had no reason to carry: `!questBehaviour` (a quest foe is never
pacified) and the entity-type test. And the drawn-weapon arm reaches
the exterior pools for the first time - sheathed adds 10, drawn costs
25, a thirty-five point swing that decides most rolls - which meant
adding a `playerWeaponSheathed` thunk to both pools, read **live**,
because drawing your sword as you approach has to change the next
foe's roll.

**And the charge they made twice.** `WeaponManager.cs:420` -

```csharp
// Fatigue loss
playerEntity.DecreaseFatigue(swingWeaponFatigueLoss);
```

- sits in the single `isDamageFinished` block. It is a property of
*swinging*, not of what you swung at. Both exterior hosts drain it in
their melee arm, and `cityGuards.resolvePlayerHit` drained it **again**
on the way past. Worse than a flat doubling: the resolver opens with
`if (!live.length) return false`, so the second charge landed only
while a guard was **alive**. Eleven fatigue a swing in an empty street,
twenty-two the moment the watch turned up. The dungeon never had it,
which is the shape this was corrected to.

**Eighteen mutants, eighteen kills** - after two rounds, and both
rounds are worth writing down.

Three survived the first campaign, all for one reason. The pin was
`assert.match(src, /tryLanguagePacification\(/)`, and

```js
if (false) tryLanguagePacification(...)
```

still matches it. So would a commented-out call. A grep for a function
name proves the name is in the file, not that anything calls it.
`callsAsStatement` reads the *line* now - and the same hole was open in
wave 41's pool gate, so it is closed there too.

The other correction runs the opposite way. The campaign reported a
**kill** on rewriting `!ai?.justEncountered` as
`!ai || !ai.justEncountered` - which is the same program. It died only
because `pacification.test.js` quoted the spelling. That is a false
kill, and a campaign that rewards a pin for noticing a rename has
stopped measuring anything. The spelling assertion is gone, the edge is
pinned by behaviour, and the mutant survives now, correctly, recorded
as the equivalent it always was.

**A GREP FOR A NAME PROVES THE NAME IS THERE. A PIN THAT DIES ON A
RENAME WAS NEVER WATCHING THE BEHAVIOUR.** The two failures are the
same mistake pointing in opposite directions: a text pin too loose to
catch a disabled call, and a text pin too tight to allow a synonym.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus nine the wave-38 scout confirmed that these waves have not closed.


### Wave 43 - the three rolls nobody ran

`SetEnemyCareer` does not stop at the loot table
(`EnemyEntity.cs:388-397`):

```csharp
DaggerfallLoot.RandomlyAddMap(mobileEnemy.MapChance, items);

if (!string.IsNullOrEmpty(mobileEnemy.LootTableKey))
{
    DaggerfallLoot.RandomlyAddPotion(3, items);
    DaggerfallLoot.RandomlyAddPotionRecipe(2, items);
}
```

`mapChance` sits in all sixty-two rows of `ENEMY_BASICS`, **thirty of
them non-zero**, and had zero readers. So no enemy in the game had ever
dropped a dungeon map - which in classic is one of the main ways a
player finds new dungeons at all - nor a potion, nor a recipe.

**The asymmetry is DFU's and it is kept.** The map arm is
unconditional; the potion pair is gated on the enemy having a loot
table. So a Ghost (mapChance 1, table "I") can carry either, and the
city watch (mapChance 0, no table at all) carries neither - and would
not even if you handed it a hundred percent chance, because the gate is
about the table, not the luck.

**The pile trio is a different trio.** `LootTables.GenerateLoot:147-159`
runs its own, and every number in it differs: the map chance comes from
a six-entry table indexed by the loot key rather than from the enemy
row, only keys **J through O** roll at all, and the potion chance is
**four** where the enemy's is three. Fourteen of the port's nineteen
dungeon types fall in that window; the Coven, the Laboratory, the Harpy
Nest, the Giant Stronghold and the Dragon's Den do not, so their piles
never hold a map. That is DFU's window, not an omission.

`CreateRandomPotion` needed the potion mint that had never been built.
DFU draws its recipe from `EntityEffectBroker.GetPotionRecipeKeys()` -
every registered potion effect - while `RandomlyAddPotionRecipe` draws
from the hardcoded `classicRecipeKeys`. Those are two different
sources, deliberately. The vendored effect tree defines **twenty**
`PotionRecipe`s across fifteen files, and `classicRecipeKeys` has
**twenty** entries, so unmodded they are the same set and the port uses
the one list for both - with the note that the day the port registers a
potion effect of its own, `CreateRandomPotion`'s source moves and this
list stays put.

**Twenty-three mutants, twenty-three kills** - after two rounds, and
both corrections were mine, and one of them I had already written down.

The enemy **recipe** chance had no boundary pin at all, so changing 2
to 3 survived. The three chances are one apart, which makes a 2% roll
the thing that separates them.

And `basics.mapChance ?? 0` rewritten as `|| 0` was reported as a
**kill**. It is the same program. It died on
`assert.match(src, /mapChance \?\? 0/)` - which is exactly the false
kill wave 42 recorded one wave ago, made again in the next wave, by
the same hand, for the same reason. Writing a law down is not the same
as having learned it. The spelling assertion is gone, `mapChance` is
asserted by *use*, and the mutant survives now as the equivalent it
always was.

**A pin that quotes a spelling tests the spelling.** Twice is a
pattern; the rule is that a pin asserts what a line DOES, and reaches
for the source text only when the thing being protected really is the
text - a citation, a comment that carries a law, a signature.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus seven the wave-38 scout confirmed that these waves have not
closed.


### Wave 44 - the sparkles, and a reading that was wrong

Wave 39 ported `EnemyBlood.ShowBloodSplash` and deliberately **cut**
`ShowMagicSparkles`, writing:

> two of the three arms have a target foe to hang it on, but the
> CasterOnly arm needs the player's feet and `createPlayerMagic` is
> handed an eye, not a body.

That reading was wrong twice over, and the source says so plainly.

**It is not a player path.** The one call site sits inside
`EnemyCastReadySpell()`, whose own comment reads *"For enemies this is
equivalent to PlayerSpellCasting_OnReleaseFrame()"*. There is no
sparkle on the player's release path at all - `grep ShowMagicSparkles`
over the whole DFU tree returns exactly one hit. So no player position
was ever needed.

**And it is not the target's position either.** `entityBehaviour` in
that block is the manager's own entity (`:158`), and an
`EntityEffectManager` sits on the caster - so
`entityBehaviour.transform.position + controller.center` with
`y += height/8` is the **enemy blooming on itself**. Which is what a
self, touch or area-around-caster spell going off ought to look like,
and which every pool has had the position for since it had a foe.

The gate is the target type: anything that is not
`SingleTargetAtRange` or `AreaAtRange` sparkles - rangeType 0, 1 and 3
- because the two ranged ones already have a visual, and it is the
missile.

Cutting it was still the right call; the *reason* was wrong. A
half-wired function would have shipped sparkles on the wrong entity in
two arms out of three and been much harder to notice than an absent
one. **A WRONG READING THAT LEADS YOU TO LEAVE SOMETHING OUT COSTS A
WAVE. THE SAME READING WIRED IN COSTS AN AUDIT.**

**Thirteen mutants, thirteen kills**, one equivalent - after two
rounds, and the second round is why this wave has a rule at the end of
it.

One pin scanned the whole *file* for a `hitEffects,` line, and
`dungeonContext` also exposes one on its returned object - so deleting
the dep from the cast call left the pin green. Scoped to the call now.

And a regex over the gate's spelling false-killed
`f.ai.height` -> `f.ai.height ?? 1.8`.

**That is the third consecutive wave with a false kill off a spelling
assertion.** Wave 42 found one and wrote the law. Wave 43 made the same
mistake and wrote that writing the law down is not the same as having
learned it. Wave 44 made it again. So here is the procedure instead of
another paragraph:

> **When a mutant dies, ask what killed it.** If the only failing
> assertion is one that quotes source text, the mutant is a suspect,
> not a kill - re-run it against the behavioural pins alone. A text pin
> is legitimate only when the TEXT IS THE DELIVERABLE: a citation, a
> comment carrying a law, a signature, a "this must stay a `var`". Wave
> 37's `modes?.` pins are the good case - the spelling *is* the fix.
> Everywhere else, a pin asserts what a line DOES.

The reason this keeps happening is worth naming too: a text pin is the
cheapest thing to write and it always passes when you write it. It
gives the same green as a real one and costs a tenth as much, so it is
what the hand reaches for when the interesting work is already done.

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus six the wave-38 scout confirmed that these waves have not closed.


### Wave 45 - the swing that turned the camera

Reported from play: *"whenever attempting to attack, it swings your
entire screen."*

The right button is a **weapon** control in Daggerfall - every host in
the port suppresses `contextmenu` for exactly that reason. But the two
streaming hosts are not the only thing listening for the drag.
`world.js` and `exterior.js` each register a global `mousemove`, and so
does `worldModes.js` (`:1517`), for the interior and dungeon modes it
owns. Both fire on every move.

And the streaming hosts gated their whole swing line on
`modeNow() === 'exterior'`:

```js
if (walkMode && (e.buttons & 2) && modeNow() === 'exterior') { ...swing...; return; }
cam.yaw -= e.movementX * lookScale();
```

That test *reads* as "am I outdoors". Its actual job is **"is anybody
else eating this drag"**. Outdoors the two happen to agree. Indoors
they come apart: `worldModes` fed the modal weapon rig, this line
found `mode !== 'exterior'`, fell through, and turned the camera. So
you swung and the view swung with you - every time, in every building
and every dungeon reached from the town.

`dungeon.js:198`, the standalone host, has always had the right shape:
attack, then `return`, with no mode in the test at all. It has no modal
sibling to share the drag with, which is precisely why it never needed
one - and why the difference between the three files never looked like
a bug.

The fix is a router with **three** answers rather than a boolean with
two, because "swing" and "look" were never the whole space:

```js
routeMouseDrag({ walkMode, buttons, mode })
  -> 'swing'  this host owns the drag; feed its own rig
  -> 'modal'  a mode host owns it; do nothing, and DO NOT LOOK
  -> 'look'   nobody is swinging
```

Both hosts return on anything that is not `'look'`. Naming the third
state is the fix; the old code had no word for "somebody else is
handling this", so it used the nearest word it had, and the nearest
word was wrong.

**Sixteen mutants, sixteen kills**, one equivalent - and the first
mutant is the reported bug itself, restored one character at a time
(`'modal'` -> `'look'`).

**Two things worth recording about the report.** The user said "restore
whatever you did to the swing combat", and I did not do anything to it:
`git log -- src/combat/fpsWeapon.js src/combat/weaponRig.js
src/combat/playerWeapon.js` last touches wave 24, and waves 30-44
changed no weapon file. What changed is that **wave 37 fixed the boot
crash**, so the player could reach an interior at all for the first
time in a while. A fix that restores access to a subsystem will look
exactly like a fix that broke it. The right response is to check the
history, say so in one line, and then go and fix the thing anyway -
because the symptom was real and the bug was ours.

And the equivalent mutant here was confirmed the way wave 44's
procedure says to: re-run it against the behavioural table alone. The
table is nine rows of `routeMouseDrag` answers, so there was nothing
for a spelling assertion to do in the first place. **THE CURE FOR A
TEXT PIN IS USUALLY A FUNCTION WORTH CALLING.**

**Twenty-six findings remain**, plus seven from the host-parity sweep,
plus six the wave-38 scout confirmed that these waves have not closed.


### Wave 46 - the player's side of being hit

The C2 slice ported the race/gender voice tables whole and wired the
**enemy** side of them. The player side was never wired at all: you
took every hit in the game in silence. And the one player voice that
did exist - the attack grunt - was routed through the wrong function.

**The High Elf swap is the enemy's handling.**
`EnemySounds.PlayCombatVoice:159-161` swaps a male High Elf's voice for
a Wood Elf's, and its comment says why: *"Male high elf sounds sound
odd when coming from NPCs."* The player's two voices never reach it -
`FPSWeapon.PlayAttackVoice:315` and `PlayerFootsteps.RemoveHealth:358`
both call `GetRaceGender*Sound` **directly**. So a male High Elf
*player* grunts and screams as a High Elf, and a male High Elf *enemy*
as a Wood Elf. `playerAttackGrunt` had been going through
`combatVoice()` since C2, so a male High Elf player has been grunting
as a Wood Elf for the whole arc. There is a `playerVoice()` now, and
the swap lives only where DFU puts it.

**A fall flashes the screen and does not make you cry out.** Both the
flash and the pain voice hang off `RemoveHealth`, but Unity's
`SendMessage` reaches every component and a direct C# call reaches one:

| site | how | flash | cry |
|---|---|---|---|
| `EnemyAttack:406` - a blow, or an arrow through `BowDamage` | SENDS | yes | yes |
| `DaggerfallAction:739/:768` - the damage traps | SENDS | yes | yes |
| `PlayerHealth:57` - fall damage | calls its OWN method | yes | **no** |

`PlayerFootsteps` has its own fall arm (`:306-311`) and it plays the
`FallDamage` clip and nothing else. That is a real distinction in the
source, not an oversight to tidy away, and it is pinned as one.

**And the arrows owed everything.** `BowDamage:140-141` routes an enemy
arrow through the same `ApplyDamageToPlayer` a melee blow takes, so an
arrow owes the hit sound, the flash and the cry. `world.js` had the
sound only; the dungeon's arrow arm had **none of the three** and was
completely silent.

**`PlayArrowSound` is dead and stays unported.** `PlayerFootsteps.cs`
:366-372 defines it - *"Capture this message so we can play enemies'
arrow sounds on player"* - and `grep SendMessage("PlayArrowSound")`
over the whole tree returns nothing, while every sibling has a sender.
So an enemy arrow in DFU makes the **weapon** hit sound and no arrow
sound at all. The scout's finding had it as "the dungeon is silent
where the exterior plays a sound"; the truth is narrower and the fix
is the weapon family, not a clip nothing plays.

**Twenty mutants, twenty kills, zero equivalents** - after two rounds,
and the first round found more about the pins than about the code.

- the heavy/light fork was pinned on a **male** player, and
  `GetRaceGenderPainSound`'s male arm returns the race's Pain2 whatever
  the damage. So `heavyDamage: true` hardcoded, and heavyDamage read
  off *current* health, both sailed through. Pinned on a female now,
  where the table actually forks.
- "the blow cries" was `assert.ok(...some(line))`, and two hosts have
  **two** cry sites each now. Deleting the blow's line left the
  arrow's. Counted per file.
- `!(damage > 0)` -> `damage <= 0` was filed as an equivalent and is
  **not** one: they part company on a NaN. Pinned, and it is a kill.
- and the campaign *script* was wrong about one. Replacing the first
  `dice100(PAIN_VOICE_CHANCE, ...)` in `hostCombat.js` hits
  `enemyPainVoice`, which this file does not cover. **A MUTANT AIMED AT
  THE FIRST MATCH OF A SHAPE THAT APPEARS TWICE TESTS THE OTHER ONE.**

One more, and it cost the file: a mutation script that does
`open(path, 'w').write(build())` truncates the target the moment
`build()` throws, because the open happens first. `hostCombat.js` went
to zero bytes mid-campaign. It came back from the `.bak` the same
script had just made, but the lesson is cheap to keep: **build the
content, then open.**

**Twenty-six findings remain**, plus seven from the host-parity sweep;
the wave-38 scout's confirmed list is now closed out.


## Queue

THE Q4 CARVE (scouted 2026-08-21, sources sized): the remaining
slices, in dependency order.

- **Q4-i - THE MACRO ENGINE** (SHIPPED above): QuestMacroHelper.cs (381 -
  ExpandQuestMessage over the message token stream: the _symbol_/
  __symbol_/=symbol_/=qsymbol_ resource macros and the %-macro
  routing), QuestMCP.cs (294 - Quest's MacroDataSource: %n/%fn/%mn
  seeded by DFRandom off the quest UID, %kno, %qdt off the log
  step), the four resource ExpandMacro overrides (Person/Place/
  Item/Foe name-and-site answers + LastResourceReferenced), and the
  MacroHelper.cs subset the quest path routes through. Closes
  message.js's "macro expansion pends the macro slice" charter;
  corpus-gateable headless (expand EVERY corpus message with
  pending-safe fallbacks) + pinned expansions under the mock world.
  Everything visual downstream needs this first.
- **Q4-ii - THE OFFER FLOW** (SHIPPED above): DaggerfallQuestOfferWindow's
  offer/accept/decline message law, guildServiceFlow's FLAGGED Quests
  arm (SERVICE_DESTINATION), the TalkManager questor-click half over
  the machine's lastNPCClicked/questor tables, the
  QuestListsManager guild draw going live end to end.
- **Q4-iii - THE SCENE MOUNT** (SHIPPED above, RE-CARVED): the
  ENGINE half shipped headless - the behaviour law, the mount walk,
  the individual trio, the wave invalidations, two-phase TeleportPc,
  the placement ring math. The LIVE BRIDGE split out as Q4-v: the
  engine is machine LAW (pinnable in node, campaignable), the bridge
  is browser-host geometry (probe-verified) - fusing them would have
  shipped an unverified sprawl.
- **Q4-iv - JOURNAL + SAVE** (SHIPPED above): the quest save
  envelope whole, the journal's law half (the active-page walk +
  PlayerNotebook), EndQuest's notebook filing; the journal WINDOW
  geometry rides the UI arc, the behaviour v1 shape and
  oneTimeQuestsAccepted persistence ride Q4-v's wiring.
- **Q4-v - THE HOST BRIDGE** (SHIPPED above): the machine LIVE in the
  world host - the bridge module + the questOffer service arm + the
  interior mount + the save/init/transition wiring, node-pinned where
  it is law and RECORDED where it pends (the section lists both).

THE ARC'S REMAINDER (after Q4-v, all recorded in its SHIPPED
section): the LIVE PROBE PASS on a machine with ARENA2 (stand
geometry, the click ray, the offer window over real art - this
environment has no game data, so the browser half is build-verified
only); quest foes in interiors + the dungeon host's own mount over
createFoeGameObjects/tryPlaceFoe/hostCombat's enemy handle;
dungeon-mode popups; the talk seams (the talk arc's charter);
playVideo, the HUD faces panel, the disease seams, the QuestComplete
loot window; WhenPcEntersExits' interior-transition feed beyond the
polled rect. Each is a seam the law modules already speak - absent
members idle loudly, never silently.

## M-X - THE TABLE, WHOLE: MacroHelper's last 132 rows + the gate (2026-08-27)

The completion analysis' item three, closed at the TABLE level. Every
row of MacroHelper.cs now has its counterpart in questMacros.js, in
the C# handler's own shape - three kinds:

MCP CALL-THROUGHS, verbatim (`mcp.GetMacroDataSource().X()` as
call(mcp, 'x')): the attribute block (%str..%luc, %ark), the whole
biography %q block (Q1..Q12 with the a/b arms, thirty-six rows), the
spell-info block (%1am/%1bm/%2am/%2bm/%ach/%adr/%bch/%bdr/%clc/%cld/
%clm/%mpw), the bank reads (%ml, %r1..%r5), the home-province pair,
the summon pair (%dae/%dng), %gdd, %fon, the name pairs
(%bn/%fn2/%mn2/%imp) and %lev (GuildTitle without %pct's player-name
fallback). A source without the override answers the error ladder
([srcDataUnknown]) - DFU's own behavior - and the SOURCES land with
their arcs: the biography MCP, the spell-info MCP, the bank MCP.

PLAYER/WORLD GLOBALS off hooks: the date/time block on the machine's
nowSeconds clock (DayOfMonth ONE-based per :626, GetSuffix's
1st/21st law, MinTimeString's {0:00}:{1:00} padding, monthName/
dayName/birthSignName/SEASON_NAMES off gameDate's own tables), the
vitals (%spc/%spt, %enc = floor(str*1.5), %mad = floor(will/10)),
the four biography modifiers in C#'s "+0;-0;0" signed format, %ski's
first-primary-at-permanent-100-else-"BLANK", the pronoun quartet
plus %pg/%pg1 sharing PlayerPronoun, %pcl's parts[1] lastname,
%ltn's FOURTEEN legal-rep bands with C#'s unreachable "unknown" tail
kept, %ct's switch over the REAL LOCATION_TYPES ids (HomeWealthy is
a manor, HomePoor a shack) with the default falling to the enum
value's own string, %lp's Breton-or-Hammerfell, %cn2's
first-other-TownCity walk, %cbd's "[invalid]" outside-a-building
arm, and the talk/news block (%fa/%fae/%fe/%fea/%fnpc/%fpa/%fpc plus
%fx1/%fx2 over the new setIdFactions state and the lord reads) -
with C#'s OWN asymmetry kept: %fae speaks GetFactionNPCEnemy exactly
as %fe, %fea speaks GetFactionNPCAlly exactly as %fa. The talk-arc
getters answer the charter's null until that arc mounts them.

C#-NULL ROWS join NULL_HANDLERS ([unhandled], verbatim): %hol %hrg
%htwn %key2 %mit %on %pdg %plq %pnq %ptm %qot %vn %wpn beside the
six already there.

AND THE GATE. test/macrocoverage.test.js extracts MacroHelper.cs's
own `{ "%x", Handler }` table (ARENA2-posture skip without the
sparse clone) and asserts every row is handled, null-handled, or
RECORDED at the per-window expander that owns it - thirty-seven
tokens (itemInfo's weapon/armour/painting block, arrestFlow's court
block, townTalk's, talkMacros', guildServiceActions') each VERIFIED
present in its named home so the record cannot rot - and that no
port handler stands where C# has null. The gate found those
thirty-seven the analyst sweep had miscounted as present-in-table;
consolidating them into the one table is the recorded follow-up.

Wiring: machine hooks gain playerEntity and nowSeconds; questWorld
gains legalRepNow and currentLocationType (world.js answers both);
the machine deps gain the entity itself.

Pins: 5 in `test/macrocoverage.test.js` - the gate, the date/time
laws at their boundaries, the player globals with %ski's BLANK arm,
the fourteen bands and the %ct fallback, and the error shapes with
the news pair and the %fae/%fea asymmetry.

## Q5 - FOURTEEN GUARDS RETIRED (2026-08-27)

The pended-action list drops from twenty to SIX. Fourteen
GUARD_PATTERNS rows became real ActionTemplates in
`systems/quest/actions.js`, each verbatim against its Actions/*.cs:

- **WhenSkillLevel / WhenAttributeLevel** - always-live trigger
  conditions over `skillValue(entity, id)` and `liveStat(entity,
  key)` (STAT_KEYS_BY_ENUM maps C#'s Stats enum names onto the
  port's stat keys), inclusive `>=`, and the C# law that an unknown
  skill/attribute name SetCompletes and THROWS at parse.
- **SeasonCondition / WeatherCondition / ClimateCondition** -
  always-on triggers. Season reads `seasonValue()` off the classic
  calendar. Weather is EQUALITY against the questWorld's
  `currentWeatherKey()` - DFU folds WeatherType groups to seven
  names and the port's WEATHER_TYPES is exactly those seven, so the
  fold is the identity (RECORDED, not silent). Climate carries
  QUEST_CLIMATES (name -> 223..232) plus the CLIMATE_BASE_OF fold
  for `climate base desert|mountain|temperate|swamp`, read off
  `currentClimateIndex()` (world.js answers from maps.getClimateIndex
  at the travel pixel).
- **SetPlayerCrime** - the CRIMES enum name validated at parse
  (unknown THROWS), the VALUE fired through hooks.setPlayerCrime -
  world.js routes it into court.js's setCrimeCommitted, so V4's
  racial crime-suppression gate rides the same one setter.
- **PayMoney** - `pay N gold` counts COINS alone
  (getGoldPieces/deductGoldPieces), `pay N money` the whole purse
  (getGold/deductGold); covering starts the paid task, not-covering
  the otherwise task, and an uncovered pay deducts NOTHING.
- **JournalNote** - the message's tokens through world.addNote.
- **TrainPc** - quest success + the QuestComplete popup, the
  classic-MINUTE training stamp (floor(sec/60)), raiseTime
  3*3600, fatigue - DefaultFatigueLoss*180, and the tally
  Range(10,21) * SKILL_ADVANCEMENT_MULTIPLIER into tallySkill. DFU
  defers the payload to the popup's OnClose; the port folds it
  inline at fire (RECORDED - the popup is presentation here).
- **KillFoe** - foe.kill() (deathTrigger); a missing symbol
  SetCompletes and THROWS, verbatim.
- **UnrestrainFoe** - clearRestrained(), or WAITS on a missing foe
  (C# returns without completing). AND THE QUIRK, pinned loudly:
  DFU's Test() is unanchored (QuestAction.cs:142) and RestrainFoe
  registers before UnrestrainFoe (QuestMachine.cs:395 vs :426), so
  a parsed `unrestrain foe _x_` is EATEN by RestrainFoe and
  RESTRAINS in C# too. No shipped quest writes the line. The port
  keeps the registration order - quirk preserved, class reachable
  only directly (and by save shape), exactly as upstream.
- **RunQuest** - starts the child by name (hooks.startQuest ->
  scheduleQuestByName), tracks its uid across saves, then routes
  questComplete+questSuccess to the success task, anything else -
  an unservable name included, immediately - to the failure task.
- **SpawnCityGuards** - the immediate flag through
  hooks.spawnCityGuards; world.js spawns off the guard pool at the
  player's feet.
- **Enemies** - makehostile walks exteriorFoes + cityGuards setting
  hostility; clear removes them (hooks.makeEnemiesHostile /
  clearEnemies).

The SIX that stay pended each name their blocker in GUARD_PATTERNS:
CastEffectDo (effect-template registry lookup by key), WorldUpdate
(the world-variant system), ClickedFoe (no foe-click door),
ChangeFoeInfighting + ChangeFoeTeam (MobileTeams combat - the
completion analysis's item 5), PromptMulti (the multi-button prompt
window).

Wiring: machine hooks gain setPlayerCrime, getGoldPieces,
deductGoldPieces, raiseTime, spawnCityGuards, makeEnemiesHostile,
clearEnemies, getQuest-by-uid; questWorld gains currentWeatherKey
and currentClimateIndex; world.js mounts every door (the bridge ctx
passthroughs in scenes/questBridge.js).

Pins: 10 in `test/questactions5.test.js`, on the questremainder
harness - and the harness taught its own law twice: bare QBN lines
form the STARTUP task (named tasks never run untriggered), and the
first run of the foe pins exposed the shadowing quirk above.

## QG1 - THE LAST RETIRABLE GUARDS + THE READY-SPELL DOORS (2026-08-28)

The pended-action list drops from four to ONE. CastEffectDo, ClickedFoe
and PromptMulti became real ActionTemplates in `systems/quest/actions.js`,
each verbatim against its Actions/*.cs, and the machinery two of them
(and the already-shipped CastSpellDo) wait on went LIVE:

- **THE READY-SPELL DOORS**. machine.js has declared
  notifyNewReadySpell/notifyCastReadySpell and the two world reads
  (getClassicSpellEffects, spellHasMatchForClassicEffect) since the Q
  arc - and NOTHING production-side raised or answered them, so the
  three corpus quests that write `cast X spell do` (Banish_Daedra,
  Open, Sleep) completed their template at parse and the trigger was
  dead. Now: hostMagic raises onNewReadySpell in readySpell right
  after the assignment (EntityEffectManager.cs:348) and
  onCastReadySpell at all four release exits (self/touch/area/missile,
  before the ready clears - :391/:2085/:2130); world.js and
  dungeonContext's own engine route both into the bridge's machine
  (the standalone probes have no bridge and the chain no-ops); and
  questWorld answers getClassicSpellEffects off the G4 SPELLS.STD
  registry (spellRecordOfIndex) and spellHasMatchForClassicEffect as
  byte-folded classic-pair equality - the port's spells carry the
  (type, subType) pairs MakeClassicKey folds through byte casts
  (EntityEffect.cs:999-1002), so the compare folds to byte too. An
  ABORTED ready raises neither event, which is why the actions latch
  instead of polling (AUDIT 24's own lesson, kept).
- **CastEffectDo** - the CastSpellDo latch machinery (constructor
  subscription, cast clears, abort does not, complete unsubscribes
  deaf-forever) with TWO C# differences kept: a readied bundle that
  does not CONTAIN the effect KEEPS the latch (:69-77 has no clear on
  the fall-through - the sibling consumes one bundle per evaluation),
  and the compare is by effect-template KEY. The key vocabulary is
  DFU's own per-class literals ("Levitate",
  "ContinuousDamage-SpellPoints"), derived in ONE home -
  spellEffects.dfuEffectKeyOf: group name with spaces removed,
  -SubGroup (spaces removed) where one exists, byte-folded lookup.
- **ClickedFoe** - ClickedNpc "cut-and-pasted ... and made it work for
  foes" (the C# header's own note). The gold arm reads and spends
  GoldPieces - COINS, Q5's getGoldPieces/deductGoldPieces - and an
  uncovered click starts the otherwise-task, fires nothing and
  deducts nothing. AND THE QUIRK, pinned loudly: THE SAY FORMS ARE
  SAY-SHADOWED IN C# TOO - Test() is unanchored and Say registers at
  QuestMachine.cs:366 while ClickedFoe registers at :417, so a parsed
  `clicked foe _x_ say 1011` mints a SAY (ClickedNpc escapes only
  because trigger conditions register at the top, :351). The port
  keeps the registration order; the say arms are reachable by direct
  construction and save shape, exactly as upstream. THE CLICK DOOR:
  PlayerActivate.cs:325-339's quest-resource arm, wired - the
  activation ladder in world.js (exterior) and worldModes (dungeon)
  runs player/activate.pickQuestFoe FIRST (live foe carrying a
  questBehaviour, 0.45 half-width body + ai.height, DEFAULT
  activation distance, wall-occluded), skips Info mode, clicks
  through the behaviour's doClick, and DOES NOT consume - the C# arm
  has no return and the rest of the ladder still runs. The interior
  mode has no enemy pool (the Q4-v flag) and the standalone probes
  have no machine - no door needed, recorded.
- **PromptMulti** - 2-4 buttons over a quest message; the numbers are
  BUTTONS.RCI records (the C# casts to MessageBoxButtons UNCHECKED -
  the header's own example uses 24/25/28, past the named enum's last
  value 20), `:name` suffixes are commentary the pattern discards,
  the click routes by button VALUE down an else-if chain (first match
  wins on duplicates), SetComplete runs at SHOW, allowRearm false. A
  missing message id NREs in C# (:82 reads unguarded); the port takes
  Prompt's recorded no-box arm. The box is the machine's
  showPromptMulti hook -> the bridge -> world.js's showQuestBox with
  the new buttonsMulti contract on ServiceFlowWindow: arbitrary
  BUTTONS.RCI records drawn (the message-box layer already warms any
  record lazily), NO keys and NO cancel (AllowCancel false,
  ClickAnywhereToClose false, :87-88), the hit answers the record
  number.

The ONE guard left names its blocker in GUARD_PATTERNS: WorldUpdate
(the world-data variant system - no block/building variant swaps exist
in the port).

Pins: 15 in `test/questguards.test.js` on the Q5 harness (which taught
its startup-task lesson again - bare QBN lines form the startup task;
named tasks never run untriggered). Campaign: 20 mutants, 20 killed -
the ClickedFoe rearm mutant survived round one because the base
postTick clears every click anyway, and the pin that kills it is the
LAW's own shape: two tasks watching one foe in one tick,
first-come-first-serve.

## QV1 - THE QUEST VIDEO DOOR (2026-08-28)

PlayVideo's parse law shipped at Q2b and the machine's playVideo hook
has carried the name since Q4-v - into a console.warn saying the seam
"pends". TEN corpus quests write `play video N` (the main-quest ANIMs:
0003, 0005-0010, 0013-0015), so a shipped line dead-ended at a warn.
The world host's door is live: the infection lane's own player mount
(ui/videoPlayer - the DaggerfallVidPlayerWindow shape, owning the
frame loop for its lifetime), pushed OFF the tick's frame for the same
re-entrancy reason, with DFU's own flag - EndOnAnyKey = false
(PlayVideo.cs:78) - and Escape still skipping any video (AUDIT 26
F151's disjunct law). NEVER TRAPS: a missing or undecodable ANIM costs
the video and the quest rolls on - SetComplete already ran at the
push, exactly as in C#. One door serves every mode: the bridge ctx is
world.js's in interior and dungeon modes alike.

Pins: 3 in `test/questvideo.test.js` (the ten corpus names swept
through createNew byte-for-byte, the machine-to-hook flow with
complete-at-push, and the door's source law). Campaign: 5 mutants,
5 killed.

## FE1 - THE HUD ESCORTING FACES (2026-08-28)

AddFace/DropFace parsed since Q2b and their machine hooks rode the
bridge since Q4 - into a world ctx that mounted neither, so every
escort quest ran faceless. The panel is `ui/hudEscortFaces.js`, a
port of HUDEscortingNPCFaces.cs (EscortingNPCFacePanel) whole:

- **One panel, module-level** - DFU has one HUD and one
  EscortingNPCFacePanel on it; the state follows the damage-flash /
  blink-clock precedent, and `drawHud` (the one host-agnostic call)
  draws it on BOTH branches, because the large-HUD force-off block
  (DaggerfallHUD.cs:214-220) never names escortingFaces.
- **CreateFaceDetails verbatim**: Person carries quest UID, symbol
  (as its ORIGINAL string - FaceDetails is plain JSON for the
  envelope), race, gender, faceIndex; an Individual NPC reads
  FACTION.TXT's own `face` field (0..60 -> FACES.CIF, 61..502 ->
  TFAC00I0.RCI, both stretched into 48x48 panels); a Children-faction
  (514) Person portraits as a child - variant offset 0-or-2 plus the
  gender, "indexed 0-3", the pick a UnityEngine.Random draw riding
  the ENGINE-PRNG rule's injectable roll. A Foe is "always a Breton
  face for now" with Range(0, 10). The generic arm's race switch
  supports Redguard and defaults everything else to Breton (:207's
  own comment), gender picking the PaperDollHeads file; children read
  KIDS00I0.CIF.
- **Layout law** (:56-87): column at (8, 36), spaceY 40 or 50 when
  the panel is taller than 40, maxFaces 3 disabling the rest.
- **The quest-end sweep is a NEW machine seam**: tombstoneQuest
  raises `deps.onQuestEnded(quest)` LAST (QuestMachine.cs:1042-1048's
  own order - dispose, tombstone, SiteLink scrub, raise), the bridge
  fans it to ctx, and the panel drops every face of the ended quest -
  DFU's own "unlike Daggerfall will try to remove face when related
  quest ends, even if quest script forgets to drop face".
- **The envelope**: `escortingFaces` rides composeSessionState beside
  quest/talk/travelMap (SaveData_v1.escortingFaces,
  SaveLoadManager.cs:869), and the restore's null arm CLEARS
  (:1071-1079) - a pre-FE1 save loads with no stale portraits. Init
  at world boot clears too (the OnNewGame/OnStartLoad pair, :306-316).

QUIRK KEPT: DaggerfallHUD.cs:207 wires the ShowEscortingFaces setting
to the panel's `EnableBorder` - a flag nothing gives border textures -
so the setting does nothing and the faces are unconditional. RECORDED
DEPARTURE: DFU loads face textures synchronously and THROWS on a
missing one; the port is data-gated - async loads, a face draws from
the frame its art lands, a missing record costs that face (warned
once), never the session. The audit24 CTX_PENDING table lost its
addFace/dropFace rows - removing a row means mounting it.

Pins: 12 in `test/escortfaces.test.js`. Campaign: 13 mutants, 13
killed.

## RW1 - THE QUESTCOMPLETE LOOT WINDOW (2026-08-28)

The last of Q4-v's recorded quest seams with a real body behind it.
GivePc's offer arm has been complete on the ACTION side since Q2b-ii -
questSuccess, the QuestComplete popup, MakePermanent, the reoffer
release, then `hooks.offerReward` - but the world's hook was a FLAGGED
direct-add with a "You have been given" HUD line. It is GivePc.cs
:150-196's own flow now:

- **A real container**: the reward is a dropped-loot pile minted at
  the player ("CreateDroppedLootContainer(PlayerObject, ...)"), and
  the inventory opens over it as its REMOTE target - the player takes
  what they want, and a reward left untaken stays a pile at their
  feet, exactly as DFU's container persists.
- **The OnClose law** (:173, :189-196): the loot window opens when
  the QuestComplete box the action just raised CLOSES - a one-shot
  latch armed by offerReward and fired by the quest box's onClose;
  immediate when no box is up.
- **The mode that owns the ground mints**: `modes.mintRewardPile`
  routes the dungeon to its own droppedLoot
  (dungeonContext.offerRewardLoot -> the same three-way takeLoot door
  every pile rides), and answers undefined everywhere else so the
  world host mints - the same split the inventory's onDrop already
  rides. undefined and null are DISTINCT here: null means the mode
  owned the ground and could not mint (no feet yet, already warned),
  and folding it with ?? would drop an exterior pile inside a dungeon.
- The emptied container frees on window close (releaseEmptied - the
  drop arm's own law), and the Merchant container image is the pile's
  treasure billboard in this port's vocabulary.

Pins: 4 in `test/questreward.test.js`. Campaign: 8 mutants, 8 killed.
