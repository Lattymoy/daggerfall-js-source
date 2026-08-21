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

## Queue

- **Q3-iv - THE REMAINDER SWEEP** (41 lines): WhenPcEntersExits (8,
  the p1=2 exterior-type trigger over location-rect state),
  WhenReputeWith (8, trivial over getReputation),
  WhenNpcIsAvailable (7), CurePcDisease (6) and MakePcDiseased (5)
  over the S18 disease seams, CastSpellDo (3), and the 4 'Action
  not found' lines recorded as DFU's own permanent floor.
- **Q4 also picks up**: the hot-place/hot-remove halves of
  AssignQuestResource (world.onResourceAssigned), TeleportPc's
  save-resume, the layout builders walking SiteLinks/QuestMarkers to
  stand resources in scenes.
- **Q4 - SURFACES**: the offer flow (guild questors + TalkManager
  rumours - the rumor/dialog-link/questor-message hooks now carry
  the data), the journal/log UI, the parchment popup/prompt windows,
  the HUD escorting-faces panel, quest items through the inventory,
  the quest save envelope.
