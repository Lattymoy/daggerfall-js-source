# ALTERNATE STARTS (START0-START1, 2026-10-24)

The owner, 2026-10-24: "So one thing we can develop that will fit in is the new alternate start system. Each new region
will each have their own unique starting quest/dungeon within that region (Daggerfall being hammerfells. Which also
needs a new quest). Each of these quests should tie into the main story seamlessly but allow for the main quest to be
started on the player's watch."

Asked three things, the owner answered:

| Asked | The owner's answer |
|---|---|
| The Bay's start: Privateer's Hold as it is, or a new start dungeon? | "Keep privateers hold, give it a new quest" |
| How does the main quest begin on the player's watch? | "A letter they open" |
| Build the regions one at a time, or all at once? | "All at once" |

Then: "Can we not just build this as its own PR" and "Stop asking questions and build this and dont come back until its
perfect, no exceptions. No band aids and no half assed work".

**Status: START1 BUILT 2026-10-24** - the system and the Bay's start, its own pull request off main. The provinces' starts
past the Bay wait on the regions past the Bay reaching main (the TESA arc's branch, `03-World/Arena-Provinces.md`) and on
the ship passage that brings a player from them to the Bay (section 6). Built all at once there, as the owner chose.

## 1. What Daggerfall Unity does (the reference)

- **The start.** `StartGameBehaviour.cs:445-447` starts `_TUTOR__` and `_BRISIEN` on a new character, then the
  InitAtGameStart list. The port's `scenes/quest/questBridge.js` `GAME_START_QUESTS` carried the same pair; TUT1 put
  `S0000977` (the curse `_TUTOR__`'s close started) in the tutorial's place (Port-Ledger A, TUT1).
- **`_BRISIEN`** (`vendor/dfu-quests/Quests/_BRISIEN.txt`, the main quest's opener). Its start-up says 1025, the classic
  waking ("You wake and look around the room ... Once free of the cave, you can begin the Emperor's quest"), files 1010
  and sets `_exitstarter_` while the player stands in Privateer's Hold. Its `until _exitstarter_ performed:` block is a
  PersistUntil task, which runs its actions at least once before it reads its target (`Task.cs:257-262`: "starting player
  outside of PH in classic using Z.CFG cheat will cause main quest to start as normal") - so on the first tick, in the
  Hold or out of it, it starts `S0000999` (the main quest's driver) and `_invitepc_`, Lady Brisienna's 7-14 days, and
  takes 1010 down again. Then her letter (in town, by day), her month (`_remindpc_`, 30 days), her fortnight
  (`_pcfailed_`, 14 days) and `stopMainQuest`, the letter that ends the main quest for good.
- **So the story is on a clock from the first second**, and a player who spends the first two months exploring the Bay
  is reported to the Emperor as a traitor. The port runs this verbatim (`systems/quest/task.js`, the PersistUntil arm).

## 2. The system: a start, its commission, and Daggerfall

`src/systems/starts/starts.js` is the registry, a leaf: `BAY_START_QUEST` (`_STARTIB`), `START_QUESTS` (every start's
quest; START1 ships the Bay's), `MAIN_QUEST_OPENER` (`_BRISIEN`) and `isStartQuestName`. A start is a quest of DFO's own
in DFU's text form, under `src/systems/starts/quests/`, read by the same parser and run by the same machine
(`scenes/quest/questData.js` reads the folder beside DFU's pack and the mods'; `test/qlSources.mjs` is its node twin).
Every start keeps one contract, held for each name in `START_QUESTS` by `test/systems/starts/start1_bay.test.js`:

1. **It ends with THE COMMISSION** - the Emperor's sealed orders, a quest letter (`Item _commission_ letter used N`),
   whose `used do` sets `_opened_`. The watch stands in the start-up (`_commission_ used do _opened_`), so however the
   letter reached the pack, its use is heard.
2. **Opening it is the player's own act, at any time.** Nothing of the main quest runs before it: no `_BRISIEN`, no
   `S0000999`, no clock. A start runs no clock at all.
3. **Opened, it orders the player to the city of Daggerfall**, and there - `when _opened_ and _incity_`, where `_incity_`
   is `pc at _daggerfall_` over `Place _daggerfall_ permanent DaggerfallCity1`, the place `S0000977` watches - it starts
   `_BRISIEN` and ends. `_BRISIEN` then runs as DFU wrote it, from the city of Daggerfall: its remote tavern
   (`Place _dirtypit_ remote tavern`) is drawn in the region of Daggerfall as DFU's start draws it from Privateer's Hold,
   so her letter's "_dirtypit_ in __dirtypit_ of Daggerfall" is true wherever the seal was broken, and the parse runs in
   the world host's own region - never at sea or past the Bay, where a remote tavern has nowhere to stand.

Why Daggerfall and not "at once": the letter is the player's word that the story may begin, and the city is the story's
first door - DFU's own words send the player there ("en route to Daggerfall", "the Emperor's agent in the court of
Daggerfall"). A player who opens the commission in the Hold, as most will, walks to Daggerfall as DFU's classic start
walks them. The same gate serves every start: a province's commission, opened in Skyrim, starts nothing until the
player stands in Daggerfall's streets (section 6), so no start needs an opener of its own and `_BRISIEN` stays one
quest.

**The commission is the main quest's own.** `quest/questLists.js` `isMainQuestName` reads a start's name (the
chronicle's main rail; the share gates' `mainQuest` refusal - the letter is the character's, never a party's);
`quest/machine.js` `PROTECTED_QUESTS` holds `START_QUESTS` (never error-terminated, set aside or restarted - the main
quest waits on it); `questlines/qlFamilies.js` files the starts with the main quest's sheets (`UNLISTED_FAMILY.MainQuest`);
and `questlines/qlLayer.js` pops no Questlines page for a start, as for the other quests a new character is begun on.

## 3. The Bay's start: `_STARTIB`, "The Emperor's Commission"

`src/systems/starts/quests/_STARTIB.txt`, started on a new character in `_BRISIEN`'s place
(`questBridge.js:"export const GAME_START_QUESTS = Object.freeze(['S0000977', BAY_START_QUEST]);"`).

- **The wake.** DFU's own 1025, its last sentence left out (1020), then the port's (1021): the oilskin case that held
  the Emperor's sealed commission - "the orders you were charged to open only once you reached the Iliac Bay" - was
  torn from the player in the water; if the tide gave it back, it lies in the cave. Journal 1010: DFU's own "Before
  landing in Daggerfall, a sudden storm capsized the ship. I barely made it into this cave", and the case, and the Hold
  by name (`__hold_`) - revealed on the travel map (`reveal _hold_`), wherever the start stood the player.
- **The commission** stands at Privateer's Hold's one quest item marker (`place item _commission_ at _hold_`, `Place
  _hold_ permanent PirateerHold1`): S0000999.RDB's 199.18 at (1428, -1824, 1699), 45 m up in the cave above the way
  out, where a new character stands (the start is entered at the Hold's enter marker - `worldModes.js` startInDungeon's
  DE1). A player who walks out at once leaves it there, and the compass and the Quests page point back to it. Taken from its pile (`clicked item`, every door's click since WHERE-ROBES,
  `item/itemTransfer.js` `sendQuestItemClick`), it pops 1022 ("The commission is inside, dry, its seal unbroken ... When
  you break it is yours to choose") and files 1011.
- **Opened** from the pack (the Use a player gives any letter - `systems/useItem.js`'s quest-item arm sets the watched
  letter's `useClicked`, then shows its words), it reads 1030, the Emperor's orders, in DFU's own terms (1010's): lay the
  shade of King Lysandus to rest, learn what became of the letter to the Queen of Daggerfall, speak of it to no one,
  make for the city of Daggerfall and burn the letter on arrival, where an agent of his will find you. Its last line,
  "Uriel Septim VII", names it in the pack ("Letter: Uriel Septim VII" - ItemHelper's signoff, `quest/questMacros.js`
  `expandLetterSignoff`). The journal's 1012 says the same; Daggerfall is revealed on the travel map.
- **In Daggerfall's streets**: `start quest _BRISIEN`, then `end quest saying 1023` ("You have reached Daggerfall, as the
  Emperor's orders bade you, and as they also bade you, you burn them. His agent here will find you"). The letter leaves
  the pack with its quest (Item.dispose), as the orders said it would.
- **A `say` ends its task's tick** (Quest.cs's QuestBreak, `quest.js` `showMessagePopup`'s `immediate`), so each task's
  popup is its last word: the placement and the two watches stand before the wake's pages.
- **Rumors** while it runs: a ship gone down in that storm, "Magically created, many are saying" (`_BRISIEN`'s own), the
  privateers picking the wreck clean.
- **The sheet** (`questlines/sheets/mainQuest.json`): find the commission (marked on the Hold), open it when ready (once
  held), make for the city of Daggerfall (once read; marked on the city); the outcome, "You reached Daggerfall under the
  Emperor's orders. His agent there will send for you." `_BRISIEN`'s sheet gains the days between: "Wait for the
  Emperor's agent in Daggerfall to send for you", done at her letter.
- **The welcome tour's first page** (`systems/tutorialCatalogue.js` `welcome`) says it: "The sealed commission you
  carried may have washed in here too. Find it, then the way out. The main story begins when you open it."

**Where the player starts elsewhere.** The new-game pane's "Where you wake up" (`Startup/StartInDungeon`, `StartCellX/Y`)
still moves the start as it did; the commission waits in the Hold all the same, the Hold on the travel map and named in
the journal, and DFU's waking is DFU's wherever it is read (it showed the cave to an outdoor start too).

## 4. The patch over `_BRISIEN`

`systems/quest/questPatches.js` `QUEST_PATCHES._BRISIEN`: the start-up's `say 1025` goes, as the pack reads the script
(the vendored file stays verbatim). No new character starts `_BRISIEN` at the cave now - a start's commission does, in
Daggerfall, days or months later, and the start has told the wreck. Message 1025 stays in the script, unread. A save
already holding `_BRISIEN` keeps the start-up it was saved with (`task.js` `restoreSaveData` restores the actions whole),
so nothing an old game showed changes.

## 5. The hosts, online, saves

- **THE FOUR HOSTS.** `scenes/world.js` and `scenes/exterior.js` begin a new character through `questBridge.initAtGameStart`,
  which reads `GAME_START_QUESTS` - both wired, neither changed. `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` (the Hold itself) begin nobody: they mount the start's commission where every quest item is
  mounted (`quest/sceneMount.js` `addMarkerResourceObjects`) and hand its pile's click to the quest as every pile does.
  No host grew.
- **Online.** The start is each character's own: begun in the birth session as every new character's quests are
  (`world.js` realmBirth after `questInitAtGameStart`), refused to and from a party (`mainQuest`), and the commission's
  pile stands in the Hold's public room (`instancePlaces.js` `questMountsHere`: Privateer's Hold's five blocks are laid
  whole). HOLD-ONCE still keeps the public Hold to the start; a player who leaves without the commission goes back
  through the door's own instance ("Privateer's Hold is closed to the public. You may enter an instance of your own"),
  where the quest's things stand.
- **Saves.** A game begun before START1 holds `_BRISIEN` and no start, and goes on as it was: nothing begins a start for
  it, and its `_BRISIEN` keeps its start-up. A game begun now saves the start like any quest - its commission found or
  not, sealed or opened - and loads the same.

## 6. Next: the provinces (START2, with the regions past the Bay)

The design as drafted with the owner (2026-10-24), for when the TESA arc's regions are on main:

- **The start-choice page**: "Where does your story begin?" - the Iliac Bay (Privateer's Hold) and one start per province
  past the Bay, the player's race's homeland pre-selected. It ships with the second start: one row is no choice, and the
  boot enters the start dungeon before character creation ends (`world.js`'s classic start), which a province's start
  must change (the page decides where the player wakes, so it answers before the boot enters anything).
- **The ship passage** from a province's port to the Bay (TESA6's ports): the commission carries a writ of passage. A
  dependency, built first.
- **Seven quests and seven start dungeons**, each under this page's contract (section 2) - the commission, no clock, the
  Daggerfall gate - written in Daggerfall's voice and read against the lore as TESA-LORE read the capitals:

| Region | Start dungeon | Premise | Tie to the main quest |
|---|---|---|---|
| Skyrim | A Nord barrow near Solitude | A Jarl's thane hires you to reseal a barrow where the dead have woken; at its heart an empty tomb carved for "the Underking's shield-brother" | The Underking |
| Morrowind | A Dwemer ruin near Mournhold | The Temple sends you into a ruin that has started to hum; brass parts catalogued for "the Walking God" | Numidium |
| Imperial Province | The old cells under the Imperial City | The Blades test recruits in the disused prison under the Palace, an echo of Arena's own start | The commission from White-Gold itself |
| Black Marsh | A drowned ruin near Helstrom | Smugglers have taken a Septim-sealed crate into the marsh | A relic travelling quietly toward the Bay |
| Elsweyr | A ruin on the caravan road near Torval | A caravan's guards vanished at a ruin; a cart of Dwemer brass bound for Sentinel | Numidium, from the buyer's side |
| Valenwood | A hollow under the roots near Falinesti | A Blades courier went missing; found dying, with half a letter | Lysandus's letter |
| Sumurset Isle | A ruin near Alinor | A scholar of the Mantella hires you to recover her notes, then is found dead | The Mantella |

## 7. Pins

- `test/systems/starts/start1_bay.test.js` - the registry and the bridge's list; the contract, for every start (its rows
  in the classic box's width, and every message in one box - DFU's quest box closes on the line past its 22,
  `quest.js` chunkMessageTokens, and the commission's first draft, at 24 rows, left its signature alone in a second
  in the real game); the Bay
  played on the machine whole over a synthetic region (`test/fb1004dTowns.mjs`): the wake, the commission at the Hold's
  item marker, 120 days in the Hold and in Daggerfall starting nothing, found, opened, the wilds starting nothing,
  Daggerfall's streets starting `_BRISIEN` (no 1025) and `S0000999` and ending the start with its letter; opened in the
  city at once; the sheet at each step; a save mid-start; an old save; the patch; the welcome page; and, where ARENA2 is
  present, the game's own data - Privateer's Hold's one item marker, the city of Daggerfall, and Lady Brisienna's tavern
  drawn in the region of Daggerfall.
- `tools/mutants/start1.json` - 25 mutants, 25 dead.
- `tools/start1Probe.mjs` - the Bay's start in the real game (section 3's walk, photographed).
- Moved with it: `ql1_sheets.test.js` (the scope 248 -> 249), `audit24_questseams.test.js`, `tut1_tutorials.test.js`,
  `ql2_journal.test.js`, `enhancedPause.test.js`, `tools/mutants/ql2_ui.json` (AUDIT-QL-UI-13's line).
