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
  removeFactionListener at dispose; TalkManager reads the map at
  Q4). activeFactionPersons walks NON-COMPLETE quests only -
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
mid-audit (commit f03f3dc):

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
