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

## Queue

- **Q2 - THE MACHINE**: QuestMachine.cs tick (task Update loop with
  the primary/secondary always-on trigger law), the action registry
  (83 Actions/*.cs) consuming `pendingActionLines`, live Clocks
  (enable/stop/TriggerTask), global vars store, quest start/tombstone
  lifecycle, QuestListsManager over the vendored QuestList tables.
- **Q3 - WORLD BINDING**: Place SetupLocalSite/SetupRemoteSite/
  SetupFixedLocation against the port's world data, the Person
  Setup*NPC chain against FACTION.TXT, SiteLinks + QuestMarkers,
  Foe spawning through the host enemy seams, Clock travel time
  (2.5x cautious, the F-slice calculator).
- **Q4 - SURFACES**: the offer flow (guild questors + TalkManager
  rumours), the journal/log UI, quest items through the inventory,
  the quest save envelope.
