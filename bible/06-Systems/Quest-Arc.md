# Quests

The quest machine is Daggerfall Unity's Questing subsystem ported to JavaScript, running DFU's own quest scripts. The
player meets it at guild counters, social questors, the main story's letters, the journal and the places a quest sends
them. What the player sees of it (the journal's faces, the way to a quest's place, the guidance tiers) is its own page:
`06-Systems/Quest-Guide-Arc.md`.

## How it works

**The pack.** DFU ships quests as decompiled `.txt` sources, and so does this game: 265 quests and the quest tables are
vendored at `vendor/dfu-quests` (MIT, provenance in its README). The quest corpus needs no ARENA2 and no network.

**The parse layer** reads a quest into messages, resources and tasks: `table.js` (Table.cs), `symbol.js`, `message.js`
(Message.cs), `parser.js`, and the resource classes `place.js`, `person.js`, `item.js`, `foe.js` and `clock.js`.

**The machine** (`src/systems/quest/machine.js`, QuestMachine.cs) holds the live quests, the action registry
(`actions.js`) and the scheduled-start queue. Each tick it starts scheduled quests, updates the running ones, tombstones
the finished ones and expires tombstones after a game week. Macros expand through `questMacros.js` (MacroHelper's
table, whole).

**Offers** (`offerFlow.js`) draw a quest from the quest lists (`questLists.js`, QuestListsManager.cs over the vendored
QuestList tables) with DFU's membership, minimum-rank and reputation gates, put up the offer, and start or scrub the
quest on the answer.

**The scene mount** (`sceneMount.js`, GameObjectHelper's quest half) places a quest's people, items and foes as a
building, town or dungeon is laid out, and again when a quest assigns a resource to the place the player stands in.
`src/scenes/quest/questBridge.js` joins the machine to the world host: clicks, the journal, the save.

**Journal and save.** A quest's state saves inside the game's save and restores through the same envelope a party
share uses.

**Past the Bay.** A province's region (62..70) has no MAPS.BSA rows. The quest layer builds one from the province's
listed towns, its countryside places and its lairs nearest the questor (`src/scenes/quest/questProvinceSites.js`), so
a guild or questor past the Bay sends the player across their own province. Directions (`%di`), map reveals and
scrying read the same table.

## Rules

Every rule below is a departure from DFU, named for that reason.

- **Nearby quests** (on by default, a setting): a remote site is drawn from those within 10 map pixels of the player
  at level 1, plus 4 a level, never fewer than the nearest 3 (`src/systems/quest/questReach.js`). Off, every draw is
  DFU's region-wide one.
- **Quest clocks online** (Mac): a deadline (a clock whose end loses the quest or a reward) runs on played world time,
  and rest or fast travel does not spend it. A delay (a letter, "come back in three days") is cut to at most
  `ONLINE_DELAY_SECONDS` of the character's clock. Offline every clock is DFU's (`src/systems/quest/clock.js`,
  `src/systems/quest/questStamps.js`).
- **A trip deadline is measured when its clock starts**, from where the player stands, including the way back to an
  at-home questor (`clock.js` `startTimer`).
- **Every quest may be abandoned and reclaimed** (Mac). Abandon sets the quest aside whole (`machine.js`
  `shelveQuest`), and its clocks stop; Reclaim, in the pause window's Quests tab, brings it back as it was
  (`reclaimQuest`). The backbone, the opener, the curse and the start quests are never set aside (`PROTECTED_QUESTS`).
  The chronicle's Abandon button leaves out the main story (Dudey). An abandoned quest's item may be dropped, but never
  sold, and never one the quest made permanent.
- **Restart** throws a quest away and starts it again from its own script, choosing its remote sites afresh
  (`restartQuest`, `restartRefusal`). A failed main-story step whose story did not go on may be started again
  (`storyAgainRefusal`, `startStoryAgain`).
- **Repair active quests** (Mac, a setting): puts back the people, items, foes and map markers a running quest's own
  script placed and a fault took away, keeping progress (`src/systems/quest/questRepair.js`).
- **The main story's dungeons are no random quest's**: a remote dungeon draw never lands in one, and an old save's site
  that did is drawn again at load (`place.js` `_reseatStoryDungeon`).
- **The main quest's backbone is kept**: if S0000999 failed to start, it is started again (`src/systems/quest/mainSpine.js`
  `spineOwed`). A classic import is owed nothing.
- **A No that leads nowhere asks again** on the next click (`src/systems/quest/noAsksAgain.js`).
- **Guard the Guild online** (Mac): the watch window opens ten game minutes after the player arrives and stands a game
  hour (`src/systems/quest/onlineGuard.js` `ONLINE_GUARD_WINDOWS`).
- **Two Mages Guild quests wait for the standing their headers name** online (Mac): N0B10Y03 at 10, N0B20Y02 at 20
  (`src/systems/quest/onlineRepute.js`).
- **Quest sharing** is this game's own: a party member receives a full independent copy of the quest, run in their own
  world, with their own reward (`src/systems/quest/questShare.js`).
- **Patches over DFU's own quest text** live in one table (`src/systems/quest/questPatches.js` `QUEST_PATCHES`).
- Quest fixes need not match DFU where DFU is broken (the owner).

## Daggerfall Unity

The machine follows DFU's `Questing` namespace: `QuestMachine.cs`, `Quest.cs`, `Task.cs`, `Place.cs`
(`SelectRemoteTownSite`, `SelectRemoteDungeonSite`), `Person.cs`, `Item.cs`, `Foe.cs`, `Clock.cs`, `MacroHelper.cs`,
`QuestListsManager.cs`, and the windows `DaggerfallQuestOfferWindow.cs` and `DaggerfallQuestPopupWindow.cs`. Each
module names its DFU source in its header. The departures are the Rules above; offline, every rule that says "online"
is DFU's behaviour.

## Code and tests

- `src/systems/quest/` - the parser, the machine, resources, actions, macros, offers, scene mount and every departure
- `src/scenes/quest/questBridge.js` - the machine joined to the world host
- `src/scenes/quest/questProvinceSites.js` - a province's region for the quest layer
- `vendor/dfu-quests` - the quest sources and tables
- `test/systems/quest/questmachine.test.js`, `questactions.test.js`, `questmacros.test.js`, `questoffers.test.js`,
  `questscene.test.js`, `questsave.test.js` - the port, piece by piece
- `test/systems/quest/nearby_quests.test.js`, `rest8_questwaits.test.js`, `time3_quests.test.js` - reach and clocks
- `test/systems/quest/questshelf.test.js`, `questshelfmain.test.js`, `test/scenes/quest/questreset1.test.js`,
  `test/systems/quest/qrepair.test.js` - abandon, restart, repair
- `test/systems/quest/kvarhold.test.js`, `fb1026d_mainspine.test.js`, `fb1030f_triphome.test.js` - story dungeons,
  the backbone, trip deadlines
- `test/systems/quest/auditrelease_r25.test.js`, `bayleftb_quest.test.js` - quests past the Bay
