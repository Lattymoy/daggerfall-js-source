# ALTERNATE STARTS (START0-START3, 2026-10-24)

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

**Status: START1 BUILT 2026-10-24** - the system and the Bay's start, its own pull request off main. **START2 BUILT
2026-10-24** - the provinces' starts past the Bay, on the TESA arc's branch (`03-World/Arena-Provinces.md`), all seven at
once as the owner chose, with the start-choice page, the commission in hand for a character born at no start, the writ
of passage a ship's master honors, and the sea lanes that sail a voyage from any port past the Bay to Daggerfall
(sections 6-10). Then (2026-10-24): "Yes please do that" - the rest built on a branch cut from TESA's, merged after it.
**START3 BUILT 2026-10-25** (the owner: "Fix the known gap") - a quest's place past the Bay on the player's map, the
compass and the journal (section 12). **AUDITED 2026-10-25** (the owner: "Audit this and ensure its perfect";
`01-Overview/audits/Audit-Starts.md`) - fifty-one findings in five lanes, every one fixed or answered (section 13).

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

`src/systems/starts/starts.js` is the registry, a leaf: `BAY_START_QUEST` (`_STARTIB`), `STARTS` (START2: the page's
eight, section 6), `START_QUESTS` (every start's quest - the eight and `HAND_START_QUEST`), `MAIN_QUEST_OPENER`
(`_BRISIEN`) and `isStartQuestName`. A start is a quest of DFO's own
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
- **The welcome tour's first page** (`systems/tutorialCatalogue.js` `welcome`) says it - START2: in words every start
  shares, since the tour is the same whichever the character chose: "Your story begins with the Emperor's sealed
  orders, your commission. Find them, and open them from your pack when you are ready. The main story begins when you
  do."

**Where the player starts elsewhere.** The new-game pane's "Where you wake up" (`Startup/StartInDungeon`, `StartCellX/Y`)
still moves the start as it did; the commission waits in the Hold all the same, the Hold on the travel map and named in
the journal, and DFU's waking is DFU's wherever it is read (it showed the cave to an outdoor start too).

## 4. The patch over `_BRISIEN`

`systems/quest/questPatches.js` `QUEST_PATCHES._BRISIEN`: the start-up's `say 1025` goes, as the pack reads the script
(the vendored file stays verbatim). No new character starts `_BRISIEN` at the cave now - a start's commission does, in
Daggerfall, days or months later, and the start has told the wreck. Message 1025 stays in the script, unread. A save
already holding `_BRISIEN` keeps the start-up it was saved with (`task.js` `restoreSaveData` restores the actions whole),
so nothing an old game showed changes.

AUDIT STARTS Q3: and the two places the script tells the wreck as the player's own go too - its journal's first entry
(1010, logged where `_BRISIEN` starts, in Daggerfall's streets now) and Lady Brisienna's first letter (1020), whose
"I heard about your accident at sea" is untrue of every start but the Bay's. Two more patches over DFU's text said them
without the wreck. Since OWN-WORDS2 (`06-Systems/Own-Words.md`) our own file `systems/quest/own/_BRISIEN.txt` says
them so ("I hear you have reached the Iliac Bay, safe and well"), and the patch keeps only the `say 1025`. A
translation pack's own `-LOC` words for the two are the pack's (L10N3c). Its Quests page (`mainQuest.json`) has no
cave's escape (Q2): `_BRISIEN` begins in Daggerfall's streets, where that objective read as done at its first look, the
herald's news of a cave the player was never in.

## 5. The hosts, online, saves

- **THE FOUR HOSTS.** `scenes/world.js` and `scenes/exterior.js` begin a new character through `questBridge.initAtGameStart`,
  which reads `GAME_START_QUESTS` - both wired, neither changed at START1 (START2: section 8). `scenes/worldModes.js` (interiors) and
  `scenes/dungeonContext.js` (the Hold itself) begin nobody: they mount the start's commission where every quest item is
  mounted (`quest/sceneMount.js` `addMarkerResourceObjects`) and hand its pile's click to the quest as every pile does.
  No host grew.
- **Online.** The start is each character's own: begun in the birth session as every new character's quests are
  (`world.js` realmBirth after `questInitAtGameStart` - START2: once the story has begun, section 8), refused to and from a party (`mainQuest`), and the commission's
  pile stands in the Hold's public room (`instancePlaces.js` `questMountsHere`: Privateer's Hold's five blocks are laid
  whole). HOLD-ONCE still keeps the public Hold to the start; a player who leaves without the commission goes back
  through the door's own instance ("Privateer's Hold is closed to the public. You may enter an instance of your own"),
  where the quest's things stand.
- **Saves.** A game begun before START1 holds `_BRISIEN` and no start, and goes on as it was: nothing begins a start for
  it, and its `_BRISIEN` keeps its start-up. A game begun now saves the start like any quest - its commission found or
  not, sealed or opened - and loads the same. AUDIT STARTS W5: a save from before the story began (made in the seconds
  a province's start waits on the land's trace and the world, or a page closed then) holds no start, no curse and no
  `_BRISIEN`; loaded, it is handed the commission and the curse beside it (`startsHost.js` restored, at both load doors -
  `world.js` `_questStarted = starts.restored()`), never left with no way into the story; a save from before the story
  was kept (`storyLegacy`) is left alone.
- **The open zone** (AUDIT STARTS W2). Online the Imperial Province is the open zone (`systems/wild/cyrodiilZone.js`,
  WW-C2) and every dungeon in it is sealed but the day's halls (`11-Multiplayer/Wild-Zone.md`): a start there would wake
  in a dungeon the character could never enter again once the realm's page reloads online. A character born online is
  not offered it - shut on the page, "the open zone online" (`startsHost.js` zoneShut, `page.why`); offline the province
  is no zone, and the start stands.
- **A birth's reload** (AUDIT STARTS W3). A birth online's first checkpoint is the character in their start's dungeon,
  and the page reloads into it online - where ONLINE-UNDERGROUND-LOAD1 wakes every load at the door but the Hold's, and
  the public room (laid at the world's size online) holds none of a quest's things. A load at a running province start's
  own dungeon, its commission still in it (`startsHost.js` resumesAt: the start's `_lair_` pixel, its `_found_` unset),
  stands inside through the quest's own entry (`instanceDoor.js` entryFor: its instance, whole) - both `world.js` doors
  ask it.

## 6. START2: the provinces' starts

The owner's ask was a start "within" every region; START1 gave the Iliac Bay - High Rock's and Hammerfell's, the Bay
being theirs - its own quest at Privateer's Hold. START2 gives each province past the Bay its own: a dungeon of the
province's own land near its capital, a quest in DFU's text form under section 2's contract, and the way back to
Daggerfall a player of that province takes. The registry (`starts.js` `STARTS`) holds the eight in the page's order -
the Bay's first, then the provinces past it in the picker's order (`world/tamriel/tamrielLand.js` PROVINCE_OF_ID) - each
with its quest, its province, the capital its dungeon is found near (`world/tamrielCapitals.js` CAPITALS), the races
whose homeland it is, the dungeons its story wants in their order, and its Quests-Places row's name.

| Start | Quest | Homeland of | The dungeon its story wants (first, then) | Its tie to the main story |
|---|---|---|---|---|
| The Iliac Bay | `_STARTIB` | Bretons, Redguards | Privateer's Hold (MAPS.BSA's) | the wreck; the Bay's own (section 3) |
| Skyrim | `_STARTSK` | Nords | a labyrinth of the vampires' haunts; a crypt; a keep of the haunts; a ruined desecrated temple | "The Underking sleeps. His heart does not." |
| Morrowind | `_STARTMW` | Dark Elves | a labyrinth of the mines; a keep of them; a cave | brass "For the Walking God. To the Iliac Bay." (Numidium) |
| The Imperial Province | `_STARTIC` | (no race's) | a labyrinth of the prisons; a keep of them | the Blades' test, an echo of Arena's own start; "The Emperor's own" |
| Black Marsh | `_STARTBM` | Argonians | any ruin | a Septim crate's straw pressed round something "no bigger than a fist", tagged "To Wayrest" (the Mantella) |
| Elsweyr | `_STARTEL` | Khajiit | a labyrinth of the human strongholds; a keep of them; a ruined castle | Dwemer brass "To the Queen of Sentinel, who pays in gold" (Numidium, from the buyer's side) |
| Valenwood | `_STARTVW` | Wood Elves | a labyrinth of the caves; a keep of them | half a letter, "...Septim, to Mynisera, Queen of Daggerfall..." (the Emperor's letter) |
| Sumurset Isle | `_STARTSU` | High Elves | a labyrinth of the laboratories; a keep, a ruin of them; a coven | "The Mantella is no jewel. It is a soul" |

Every one is the Emperor's commission, reached another way: a courier who carried it into the dungeon and never came
out, smugglers or bandits who took it with a courier's satchel, the Blades who left it at the heart of a prison as their
test, a scholar of the Mantella found dead beside it. A province's letter is the Bay's orders with the passage written
into it (section 10): "This letter is Our writ of passage. Any master in a harbor of the Empire will carry you to
Daggerfall at Our expense." The Bay's letter keeps its own "to be opened in the Iliac Bay and nowhere else".

**A character born at no start** - a family's heir at its seat (LEGACY1's birth, `?legacyborn`), the fixed city's bench
(`scenes/exterior.js`), a dev boot outside the classic start - is handed the commission at once: `_STARTHD`, "The
Emperor's Commission" in hand (`get item _commission_` - GetItem.cs: into the pack, no reward's window and no wait for a
town by day, which GivePc's two forms bring). START1 started the Bay's start for them too, and its shipwreck and its
commission in Privateer's Hold were nowhere they stood; START2 puts that right.

## 7. The start-choice page (`ui/startChoice.js`)

"Where does your story begin?" - the last question of making a character, put by the chargen door after the leveling
and the lineage questions (`systems/chargenSession.js` withLevelingChoice: a stage of the one overlay, answered once, its
answer riding the result as `startKey`). It is put by a host that can stand a start past the Bay (`startChoice`, the
world host's `starts.page`) once one is open there - the land past the Bay standing its lairs (`world.js` `_lairTemplates`):
one open start is no choice, and the fixed city's bench and the dungeon host never put it.

- **The eight starts as a list**, the race's homeland chosen first and tagged ("Your homeland"; `homelandStart` - the
  Bay's for the Bay's peoples and for a race no start names, the Imperial Province being no race's), and the chosen
  start's story beside it: where it begins and why. A start the host cannot stand is shut, with why, as a shut leveling
  system is: the cursor never rests on it and no key, press or hover picks it. Online that is the Imperial Province ("the
  open zone online", section 5: AUDIT STARTS W2 - the only shut start a player meets, since a host with the land past the
  Bay off puts no page); the page's own "The land past the Bay is off" is its word for any other.
- **A press answers for the start whose story it drew** (AUDIT STARTS U3): a press on another row selects it and the next
  frame tells its story; a second press, Begin here or Enter answers. A phone's tap is its hover and its press in one
  gesture, before any frame - it had answered for a start whose story the player never saw. A mouse's hover draws the
  story first, so its click answers as before. Digits 1 to 8 still answer at once (the hint names them).
- **The leveling question's contract** (`ui/levelingChoice.js` LevelingChoiceScreen): one answer through `answer`, the
  overlay's action names and the raw codes (up/down, Enter, 1 to 8), the pointer in native 320x200 units, a question torn
  down unanswered answering the cursor's start (the homeland's unless moved).
- **Two faces.** The classic face draws text over a dim (the NATIVE-WINDOW RULE - Daggerfall never asked this, so no
  native art is claimed): the title, the lead in three lines, the eight rows, then the chosen start's where-line and its
  story in four - each held to the 320x200 screen in FONT0003 by the pins. The Plus face
  (`ui/enhanced/enhancedStartChoice.js`) is the leveling question's shell: the list down the left, the story and Begin
  here on the right, stacked on a phone (`enhancedPlusStyle.js` `stc-*`).
- **Its words** are the text core's (`start.*`, drafted in-session for the thirteen whole languages, each province by the
  name the languages already give it - `rvn.errand.place.*`).

## 8. A province's start dungeon, and the world's start host

**The dungeon** (`systems/starts/startSite.js` startLairSites; `scenes/tamrielPlacesHost.js` startLairAt) is one of the
land's own - TESA8's lairs, which stand "in no quest" until now (`03-World/Arena-Provinces.md` TESA8) - never a place
made for the start: the province's capital is the story's landmark, so it is the nearest lair to its pixel
(`capitalPixel`) of each kind the story wants in turn, then any lair in reach. Only a lair that stands: on its cell's
site, in its own province, past the capital's doorstep (START_SITE_MIN, 3 pixels - past the Imperial City's span) and
within START_SITE_REACH (48 pixels, some 39 km), on no pixel a capital, a city or the countryside takes (the build stands
those first, `world.js` `_locationToBuild`), laid out to a plan of its own; a tie broken by the pixel, so every client
takes the same. And it must hold **a quest item's marker** for the commission (`quest/place.js`
dungeonItemMarkerCount, over its interior blocks as the quest layer sizes them - `scenes/questWorld.js` questSized, the
smaller-dungeon law's one door): a graveyard's five blocks are marker-free, and Solitude's nearest lairs are
graveyards. Measured on the freeware's trace at its fit (the node harness over the host's own module), each start's
dungeon stands within 35 pixels of its capital - the Haunt of Baringon 35 from Solitude, the Grulain Lode 26 from
Mournhold, the Fortress of Tibercles 32 from the Imperial City, the Ruins of Castle Caeseus 9 from Helstrom, Castle Zanai
16 from Torval, the Cavern of Jubon 8 from Falinesti, the Laboratory of Silinaire 16 from Alinor - each of the first kind
its story wants but the Imperial City's: since IC-RING stood the city in the middle of Lake Rumare's ring no labyrinth
that is a prison stands within reach of it, and the keep that is one, its second kind, is its start (it was the
Calilus Prison, 29 pixels from the city where it stood before). The game's own roll (its Bay land counted after the coast's dilation) may
stand another lair of the same kinds; the law and the kinds are what is held.

**The quest's Place** names it by a site id of its own: `Place _lair_ permanent StartSiteSkyrim`, a Quests-Places row laid
as a mod lays one (`systems/starts/startPlaces.js`, `addIntoQuestTables`) whose p1 is the start's site id
(`starts.js` START_SITE_ID_BASE, 0x5a7000 and the start's place - past every MAPS.BSA LocationId and below the port's
own places' id lanes). `quest/place.js` `_setupFixedLocation` asks the world for the dungeon such an id names
(`world.startSiteOfId`, `scenes/questWorld.js`) and takes it as a dungeon site - its markers, its map id, its name for the
journal; one the world cannot name yet throws where DFU's unknown id throws, and the start is not begun. Everything
after - `reveal`, the markers' mounting, `pc at`, the respawn - reads the site by its map id and its name, as a lair's
local quest already did (AUDIT-TESA A2-1, `placeByName`). The held map's quest marks, the street compass and the
journal's find found a quest's place by MAPS.BSA's tables alone, and so found none past the Bay; START3 (section 12)
gives every site there its own pixel, and every face reads it.

**The world's start host** (`scenes/startsHost.js`, a module the host wires - HOST-SPLIT). A new game's boot stands the
classic start first (`world.js`'s U31 start cell, Privateer's Hold) with the character made over it, as it always has;
the page's answer comes with the made character (`questInitAtGameStart(r.startKey)`), and `starts.begin` is the host's
OnStartGame now:

- **the Bay's**: the character is where the boot put them, and `_STARTIB` starts there - or, born anywhere but the
  classic start (`?classic` off), `_STARTHD`;
- **a province's**: it waits on the land past the Bay's trace (`arenaTraced`, TESA2's wait: landed or never will, at
  most START_LAND_WAIT_MS), asks the quest layer for the start's dungeon (`questWorld.startSiteOfId` - the same answer its
  Place will get), moves the character into it as a quest's teleport moves them (`_respawnAtSite`; to its door when
  StartInDungeon is off), and only then starts the quests and the welcome tour - so the wake is read where it happens.
  Where none stands it says so ("No way to that province could be found. Your story begins in the Iliac Bay.") and the
  Bay's start is theirs: never a trap. AUDIT STARTS: the move is the quest layer's latched one (`questWorld.js`
  respawnLatched - W5: no load, save, journey or Recall lands while its dungeon builds); to the door it lands on the
  pixel's start marker, never the pixel's middle inside a model (W6); a move that failed may have left the player
  anywhere, so it hands the commission (`_STARTHD`), true wherever they stand (W4); a trace that never landed names no
  dungeon - one named on the authored shape stands no lair once it lands (Q6); a start its Place refused after all is no
  start, and the commission is handed over in its place (Q6); and a load that lands while the start is on its way is the
  game now (`machine.restores`, Q5) - nothing moved or begun over it.
- **once a character**; a birth online waits on it (`starts.settled.then(realmBirth)`): the realm's first checkpoint is
  the character where their story begins, its quest running - the page reloads into that save.
- `?start=<key>` is the dev door for a headless character (`?class=`) - its boot's alone (AUDIT STARTS W8: an online
  page's, a birth's and a load's address and every front door's choice drop it, `onlineLane.js` BOOT_DOOR_KEYS,
  `legacy/places.js`, `main.js`).

The host's wiring is 17 logical lines: the host's construction, the page through the chargen door, the answer into
OnStartGame, the realm's wait, `startLairAt` into the quest layer's seam, and the writ at the passage. At the merge of
TESA's head (its ceiling at its own count, 36,202) they were paid for by a cut, not a raise: Come Sail Away's loops'
frame out to `scenes/csaAudio.js` (`01-Overview/Host-Split.md`, "START2's wiring"), `bootWorld` 36,202 -> 36,180; the
audit's fixes left it at 36,179 (the load doors' story check and the online wake's question the start host's).
`scenes/exterior.js` hands the commission (`initAtGameStart(HAND_START_QUEST)`). `scenes/worldModes.js` and
`scenes/dungeonContext.js` begin nobody; the province's dungeon mounts the commission as every quest item is mounted.

## 9. The quests

`src/systems/starts/quests/_START{SK,MW,IC,BM,EL,VW,SU}.txt` and `_STARTHD.txt`, each under section 2's contract (held by
start1_bay's contract test for every name in START_QUESTS: the letter and its watch, the Daggerfall gate, no clock, rows
in the classic box's width, one box a message, American spelling):

- **The start-up** places the commission at the dungeon's item marker, reveals the dungeon on the travel map, watches
  the letter and Daggerfall, files the journal (1010, naming the dungeon), and wakes the player (1020): what happened and
  why the orders are inside.
- **Found** (`clicked item`), 1022: the commission, still sealed, and beside it the start's tie to the main story (the
  table in section 6), then "When you break the seal is yours to choose."
- **Opened**, 1012: the orders (the Bay's in DFU's terms) and "His writ pays my passage on any ship bound there";
  Daggerfall revealed. In Daggerfall's streets, 1023 and `_BRISIEN`.
- **Rumors** of the province's own: the courier who asked the way, the dead who do not rest, the diggers who will not go
  back, the Temple who says the halls should stay sealed.
- **Sheets** (`questlines/sheets/mainQuest.json`): find (marked on the dungeon), open, make for Daggerfall (marked on the
  city); the in-hand start's open and make for Daggerfall.

## 10. The way to Daggerfall: the writ, and the sea lanes

TESA-NO-FAST (the owner, 2026-10-13: "fast travel shouldnt be a thing since we use portal stones online or the player can
traverse using the overworld") stands: past the Bay a journey is walked or sailed, or a portal stone is opened. The roads
past the Bay meet the Bay's at TESA5's crossings, a long walk from any province's capital; Sumurset is an isle. So the
commission carries passage:

- **The writ** (`scenes/startsHost.js` writ; `scenes/naval/passageHost.js` `writ`; `03-World/Passage.md` "The writ"): an
  opened start's commission is the Crown's writ of passage to the city of Daggerfall. A friendly master at any harbor
  lists Daggerfall "- by writ", asks nothing of the purse ("The Emperor's writ of passage pays your fare."), and sails
  for nothing ("Her master reads the Emperor's writ and bows."). Daggerfall alone (the city, by its name and its region),
  while the start runs, once its seal is broken. The voyage is PASSAGE's own: sailed, never jumped. AUDIT STARTS: the
  seal is read by the task's name the machine files it under (Q1/V1 - a raw '_opened_' matched none, and no writ ever
  sailed); an ended start's is spent, though its tombstone keeps a week with the seal broken (V2); the Bay's letter, "to
  be opened in the Iliac Bay and nowhere else", carries none (V3, `starts.js` carriesWrit); and the row's words fit the
  classic list (U8: "- the Crown's writ" ran 189 FONT0003 pixels, off the picker's art).
- **The sea lanes** (`systems/travel/travelRoute.js` planSeaLanes; `06-Systems/Travel-View.md` "LONG-VOYAGE"). The box
  planner never leaves the map and its two ends, and a port past the Bay lies round a province from the Bay's: measured
  on the freeware, nineteen of TESA12's twenty-eight ports had no water way to Daggerfall inside that box - Winterhold's
  way is round all of High Rock (AUDIT STARTS P14: Solitude, this page's first example, is one of the nine the box
  routes). A booked voyage with an end past the Bay's table now sails the lanes: the water about each
  end flooded out to LANE_END_REACH (the narrows of a harbor's channel, an inner sea's), A* over a grid of LANE_CELL
  cells joined where a boat sails the straight run between them, the ends' box grown LANE_MARGIN, and the landfall the
  box planner's own at the port. Every one of the twenty-eight ports reaches Daggerfall, and Daggerfall every one of them
  (Solitude 1,757 pixels of sea, some 1,440 km; Vivec 3,492; Lilmoth 4,068), each planned in under a second on the
  freeware. AUDIT STARTS: any crossing from a helm with an end past the table takes the lanes first (V6), a lane the first
  box misses is asked over a wider one (V5), the landfall lands on dry ground beside a port the coast stands on water and
  reaches past a port beyond the table's row and column (V4 - six ports were no voyage from Daggerfall, each refusal a
  freeze of seconds), and a voyage the
  lanes cannot sail is said at once (V4); `06-Systems/Travel-View.md` "LONG-VOYAGE" has the law. A traveller ashore with a
  boat to hand never takes them.
- **The Imperial Province** stands no port (Anvil has no shore on the freeware's picture, TESA12): its way is the road
  west, or a portal stone.

The departures - the start page, the province's starts and their dungeons, the commission in hand, the writ, the lanes -
are Port-Ledger section A's (START2).

## 11. Pins

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
- START2: `test/systems/starts/start2_provinces.test.js` - the registry and its rows; the dungeon's law (its wants in
  order, the province, the doorstep, the reach, a taken pixel); the marker's weighing; every province's start played on
  the machine whole over a lair in no MAPS.BSA table (its Place through the world's start seam, the commission at its
  marker, the wake, the tie, the writ in the letter, the Daggerfall gate) and its sheet; a start whose site cannot be
  named not begun; the commission in hand; the start host (the Bay's and the hand's, the wait, the move before the
  quest, the door, the fallback said, the land off, once); the writ (its port, its seal) and at a harbor (listed, asked
  and booked for nothing); the page (its homeland, its shut starts, its keys and rows) and the chargen door (asked last,
  only by a host past the Bay, torn down to the homeland); the sea lanes over a synthetic sea; and, with ARENA2, every
  province's dungeon as the host picks it, a voyage to Daggerfall from all twenty-eight ports past the Bay, and the
  classic face in FONT0003; the hosts' wiring by source. `start1_bay.test.js`'s contract runs for the eight new quests
  too.
- `tools/mutants/start2.json` - 45 mutants, 45 dead (two first survived: a second guard on the Bay's site id, taken out; the
  dungeon's weighing, which the freeware's Skyrim now pins with a story that wants a graveyard first).
- Moved with it: `ql1_sheets.test.js` (249 -> 257), `auditworld34.test.js` (the quest layer's one sizing),
  `passagehost.test.js`, `realm3.test.js`, `orl1_leveling.test.js`, `mwarms_fps.test.js`, `tut1_tutorials.test.js`,
  `tesa8_lairs.test.js` and `tesa13_mapink.test.js` (the lair's clone its own function), `start1_bay.test.js` (the
  registry's nine, the welcome page's shared words).
- START3: `test/systems/starts/start3_pastbay_marks.test.js` - the pixel's law (the table's bound on every side, a Bay
  site none); a province's start played, its dungeon's site carrying its pixel through the save and the city of
  Daggerfall's DFU's SiteDetails; the one "on my map" law (the held sheet with its continent on, the classic windows and
  the continent's switch, MAPS.BSA never asked for a place it cannot hold, a Bay site asked as before); the lens (the
  site handed to the host, the pixel on `find`, the Bay's `find` DFU's); the marks (named, read over the continent's
  frame, the Bay's bound dropping them, both edges); the held map's press and the journal's find (picked, named, no
  journey, nothing without the continent); the wiring by source. With ARENA2, START2's own test holds every province's
  real start dungeon to its pixel, inside the continent's frame.
- `tools/mutants/start3.json` - 17 mutants, 17 dead.
- Moved and not said at the time (AUDIT STARTS P15): START1 moved `fb1017b_shamtrail.test.js` and
  `l10n4_hardcoded.test.js` (the questPatches.js ratchet, 7 -> 9); START2 moved `audit28_smallerdungeons.test.js`,
  `instances3_door.test.js` and `audit_tesa.test.js`.
- AUDIT STARTS: `test/systems/starts/auditstarts.test.js` - section 13's pins (24 tests; with ARENA2, Daggerfall to and
  from every port and the classic rows in every drafted language); `tools/mutants/auditstarts.json` (section 13). Moved
  with it: `start2_provinces.test.js` (the writ played on the machine, the start host's W4/W6/Q5/Q6, the page's press, the
  writ's row), `start1_bay.test.js` (`_BRISIEN`'s sheet and patches, the welcome page), `start3_pastbay_marks.test.js`
  (the pick's two new fields; Skyrim's region index 64, U12), `hostceiling.test.js` and `tools/mutants/hostsplit.json`
  (36,180 -> 36,179).
- Moved with it: `guide5_marks.test.js` (the mark's own name; the host's reader), `audit_guide.test.js`,
  `guide4_tracker.test.js` and `guide2_wayThere.test.js` (the host's questions hand the site on); mutant records re-aimed
  by content in `audit_guide.json`, `guide2.json`, `guide4.json` and `guide5.json`.

## 12. START3: a quest's place past the Bay on the player's map

The owner, 2026-10-25: "Fix the known gap" (section 8's). DFU finds a quest's place on the travel map by its NAME - the
region by name, the place in that region's name lookup, the MAPS.BSA row's longitude and latitude
(`DaggerfallTravelMapWindow.CanFindPlace`, `GotoPlace`) - and every face here did the same: the held map's diamonds and
the street compass (GUIDE5, `scenes/world.js` questPixel), the tracker's "on your map" and the journal's find-place box
(`ui/travel/travelMapWindow.js` canFindPlace), the pause tab's "show on map" and the held map's goto
(`ui/heldMap.js` `_consumeGotoPlace`). MAPS.BSA holds no place off the Bay's table, so none of them could see a site
past the Bay - a province's start dungeon, an Arena town's guild job, any place TESA stands.

- **The site keeps its pixel** (`systems/quest/place.js` siteWorldPixel). A site built off a location whose row stands
  off the Bay's table (`world/tamriel/tamrielFrame.js` inBay: the 1000 x 500) carries `worldPixel`, the pixel that row's
  longitude and latitude name - the very numbers TESA's clones write (`synthesizeLairLocation`, `synthesizeArenaLocation`,
  the countryside's, the capitals'). All five of Place's site builders stamp it (the remote dungeon, the remote
  exterior, the fixed location, the local building, the place the player stands in); the re-seats spread the site they
  are handed. A Bay site carries none: its SiteDetails are DFU's, field for field, and a save of one is unchanged. The
  field rides the save and a quest's share whole (`structuredClone`; `questShare.js` keeps a site's every field).
- **On the player's map** (`canFindPlace`, its new `site`): a site past the Bay is on the player's map exactly where the
  map they open shows the land past the Bay - the held sheet with its continent on (`ui/map/mapSkin.js` pastBayOnMap:
  heldMapChosen and tamrielMapOn), which draws every place there with no discovery check (TESA13's recorded departure).
  The classic window's region pages are the Bay's alone, so there it is not, and the tracker says so as it says it of
  any place the map does not hold. MAPS.BSA is never asked for a place it cannot hold. Every host question hands the
  site on (the five `canFindPlace` doors in `world.js`, through the host's one memo; the classic journal's find; the
  lens).
- **The lens** (`ui/quest/questLens.js` entryTarget): asks with the site, and a site past the Bay's `find` carries its
  pixel. The host's one reader (`questPixel`) takes it first - the held map's diamonds, the street compass and the
  travel view's marks all read through it; a Bay site's `find` is DFU's and is read by name as before.
- **The marks' bound** (`ui/quest/questMarks.js` readQuestMarks, its `frame`): while the sheet shows the continent, a
  mark is read over the continent's frame (`tamrielFrameInBay`, WW2's gate rings' own bound), else over the Bay's. A
  mark keeps its place's own name (`placeName`).
- **The press and the find** (`ui/heldMap.js` `_pastBayPick`): a press on a diamond past the Bay, and the journal's find
  of a site there, pick the quest's place: its pixel and its name, no MAPS.BSA record under it (`pastBay`). Since
  TRAVEL-EVERYWHERE (2026-10-28, `03-World/Arena-Provinces.md`) it is a place by the quest's naming, as a Bay quest's is:
  its journey on the travel map, a portal's end on the teleport map (AUDIT STARTS U1/U2 had withheld both under
  TESA-NO-FAST, now retired); on the zone map, whose card is down, a place inside the zone is the zone's own journey, as
  a hall's is (U4, PVPJOURNEY). The find glides to it first. A sheet without the continent picks nothing.
- **The lens past the Bay** (AUDIT STARTS U5): AUDIT GUIDE W2's "a player cannot stand in a place their map lacks" does
  not hold past the Bay - a start's dungeon stands off the classic map's table and off a map with the continent put
  away - so a site with its own pixel is "(you are here)" by its name, DFU's own gate; and a site past the Bay off the
  player's map says "Beyond the Iliac Bay, past the edge of your map." where the Bay's "Not on your map yet. Ask around
  for directions." promised what the Bay's map never gives.

Not a DFU member: Port-Ledger section A (START3). THE FOUR HOSTS: `scenes/world.js` hands the site on in its five
questions and reads the site's pixel first (no logical line added: `bootWorld` stayed 36,180); `scenes/worldModes.js` and
`scenes/dungeonContext.js` hand the street's question on as they did; `scenes/exterior.js` asks none.

## 13. AUDIT STARTS (2026-10-25)

The owner: "Audit this and ensure its perfect". Five cold lanes over a frozen head (`01-Overview/audits/Audit-Starts.md`
has every finding, its fix and its pin): 51 reported, 45 defects. What the sections above now say because of it:

- **The writ sails** (section 10): read by the task's name the machine files it under, spent when the start ends, never
  the Bay's letter's, and its row fits the classic list. It had never sailed: the pin built a quest's tasks by hand.
- **Online** (section 5): the Imperial Province's start is shut to a character born online (the open zone); a birth's
  reload into its start dungeon stands inside, through the quest's own instance.
- **The start host** (section 8): the move latched, the door on its start marker, the commission in hand after a failed
  move or a refused start, no dungeon asked before the trace lands, a load mid-start the game's own; a save from before
  the story began handed its way in; `?start=` its boot's alone.
- **`_BRISIEN`** (section 4): no cave's escape on its page, and neither its journal nor Lady Brisienna's letter tells
  the wreck as every player's.
- **The page** (section 7): a press answers for the start whose story it drew - a phone's tap selects first.
- **The map** (section 12): a quest's place past the Bay a place's journey and a portal's end (TRAVEL-EVERYWHERE), the
  zone's own journey on the zone map; "(you are here)" past the Bay whatever map the player keeps.
- **The voyages** (section 10; `Travel-View.md` LONG-VOYAGE): Daggerfall to every port and back, the landfall on dry
  ground beside a port the coast stands on water and past an off-table port's row and column, the wide box, any helm's
  crossing lanes-first, and a
  voyage the lanes cannot sail said at once - each plan under a second.
- **The words**: the welcome page true of every start (U9, `10-UI/Tutorials.md`), French's ship bare (U6), Bulgarian's
  names in Latin (U7).

`test/systems/starts/auditstarts.test.js` (24 tests), `tools/mutants/auditstarts.json` (61 records).
