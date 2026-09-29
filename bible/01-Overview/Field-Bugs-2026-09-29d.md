# FIELD BUGS 2026-09-29d - the book that changed its title, the skill that sold for less, the lintel over the water; and the roads, the armour and the map's key

From the Discord (#bug-reports and #suggestions), through Mac: six screenshots and no words, the rule for a batch like
it - every report root-caused on the real modules (and the real ARENA2 where the report lives in the data), the
port's own faults fixed and pinned, and what is Daggerfall's own said plainly, with what would change it left to Mac.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | books put up for sale show the wrong title; taken back they "duplicate" | Janome | DFU's SplitStack zeroes a book's id; the counters took a lot back with a push | fixed (BOOK-SPLIT) |
| 2 | "Water walking is still evil" - fell out of the map again | Cruor | a water walker's land-speed stride set on a doorway's lintel and out through the ceiling | fixed (WW-LID) |
| 3 | a higher Mercantile sells for less (3499 gold at 60, 2888 at 90) | ValenValarys | REALM P0.4's cap was half the SELLER's ask, which falls as the skill rises | fixed (MERC-RISE) |
| 4 | first-person journeys go straight through the forest; the Overworld follows roads | SylviaBun | First-Person Travel is Travel Options' own journey, which walks straight at a place | a second switch (TO-ROADS) |
| 5 | the pack should show total armour, and an item's stats against what is worn | SylviaBun (Althea's idea) | Daggerfall keeps no total: its armour is seven numbers, one a body part | the armour on the pack, and a wear's comparison (AC-COMPARE) |
| 6 | the enhanced map needs the classic map's filters and its colours | Jigglehimmer | the held map kept the classic filters' store but gave it no control, and inked every place in one pen | the key, and each place in its classic colour (MAP-KEY) |

## BOOK-SPLIT: a book split off a stack is that book (1)

**Reproduced first**, on the real enhanced counter: one of "A Tale of Kieran" x3 put on the counter through the
how-many field (DISC25-F) read "The First Scroll of Baan Dar", and taken back it was that book in the pack.

**Why - two faults.** SplitStack (ItemCollection.cs:261-272) mints `ItemBuilder.CreateItem(group, templateIndex)`,
which knows a group and a template and nothing else; A2 ported it faithfully. So the part split off lost the three
terms FindExistingStack reads as identity beside them (:708-713): a book's id - book 0, and the template's 2500 gold
instead of its own 300-800 file price, so a split book also sold for several times its worth - a potion's recipe (an
empty bottle) and a conjured stack's expiry (arrows that outlived their spell). DFU's own split does the same. And both
counters took a lot back with a `push`, where DFU's every click-back and ClearSelectedItems go through
ItemCollection.Transfer -> AddItem (:473-480), which merges a lot into its own stack - so what came back sat as a row of
its own beside the stack it left: the "duplicate".

**The fix.** `systems/inventory.js` `splitStack` keeps the three identity terms and the price and picture a book's id
and a potion's recipe set (`splitPricedByIdentity`); the rest is still the fresh mint - condition, material, variant,
flags, enchantments (Port-Ledger A). `ui/enhancedTrade.js` `move` and `ui/nativeTrade.js` `_move` are Transfer: out of
one list, AddItem into the other, a quest item to the front as DoTransferItem places it. AddItem gained
FindExistingStack's first term, `checkItem != item`. A2's and ROAD-Ar R5's pins flipped to the new law (R5's re-merge
now on a potion the producer mints). `test/fb0929d_booksplit.test.js` (4), `tools/mutants/fb0929d_booksplit.json` (11,
11 dead). `06-Systems/Systems-Arc.md` BOOK-SPLIT.

## WW-LID: a lift the body has no room for is never taken (2)

**Found by fuzzing, not guessed.** A water walker and a plain swimmer driven at random - float up and down, run,
strafe, at 12 to 60 frames a second - through all 32 flooded RDB blocks of the real BLOCKS.BSA, with a probe asking
whether the body's centre crossed a face in one frame. The first road out, W0000021.RDB: a flooded room with its
ceiling at 3.2 and, in its wall, a doorway whose lintel is at 2.8. A crouched swimmer (0.9 tall) floated to the
ceiling and swam at the doorway. Water walking moves a swimmer at the LAND speed (LevitateMotor.cs:116-122), so one
step carried its lower sphere under the lintel's floor-sloped underside before its head had met the lintel, PH1's
one-way floor set the body on it, and the head, over the room's ceiling now, was pushed out on top of that. A slower
swimmer's head meets the lintel first and is turned back - which is why only water walking did it: through the real
motor, 16 of 16 water walker runs went out through the ceiling and 0 of 16 swimmers. With that road shut the fuzz found
two more: a rib hung under the ceiling through the crouched body's waist (straddled, so PH1 lifted the body into the
ceiling - one of those a plain swimmer's), and the step ladder lifting the body onto such a rib.

**The fix: four laws in `player/collider.js`**, each held by its own case. S - the straddling law DISC28-G gave the
rising pass holds in the sideways pass: a surface is a floor to the lower sphere only below the head's centre. H - a
resolve never carries the head up through a face: a raised body's head path is asked, and a face across it refuses the
rise (the refusal says so, `out.refused`). B - a refused sideways pass is not taken: the body is stopped, not left
inside what refused it. L - a refused step-ladder rung is no headroom. A standing body's straddle band is empty, so
walking is unchanged; PH1's own cases stand and are pinned. `test/fb0929d_waterwalk.test.js` (6: every scene built in
the doorway's shape, never read off the block; the real block's step behind ARENA2), `tools/mutants/fb0929d_waterwalk.json`
(10, 10 dead). PH1's source pin and the two DISC28 `rising` mutants re-aimed to the renamed `straddle`.
The fuzz over all 32 flooded blocks, 1152 runs (6 spawns, 3 seeds, water walking and not, 20 seconds each): before,
10 bodies out through a face (7 water walking, 3 swimming; W0000012, W0000021, W0000024); after, none.
`03-World/Player-Arc.md` WW-LID.

## MERC-RISE: online, no skill lowers a sale (3)

**Reproduced to the gold.** A quality-5 counter, a lot costing 17397, Personality 100: P0.4's cap was 3499 at
Mercantile 60 and 2888 at 90 - the report's two offers.

**Why.** REALM P0.4 (Mac's vendor spread: "Online, a shop pays at most 50% of its own selling price") capped a sale at
half of the SELLER's own ask. CalculateTradePrice's buying arm (FormulaHelper.cs:1996-2001) asks less of a better
haggler, and online the cap binds for nearly every seller, so the payout fell as Mercantile and Personality rose
(2888/3499 is the two asks' own ratio).

**The fix.** `systems/shopStock.js` `calculateTradePrice`: the half is of the LEAST the counter asks for the piece - the
best haggler's ask, 100 in each (DFU's maximum) or the seller's own where a spell or a curse lifts it higher
(`ONLINE_SALE_REFERENCE_SKILL`). It is still at most half of what the counter asks anyone, so buying back never pays
(P0.4's law, whole), and it is a number of the counter and the piece. Under it Daggerfall's haggle stands and rises with
the skills. P0.4's pin flipped to the new law and its mutant re-aimed. `test/fb0929d_mercantile.test.js` (3),
`tools/mutants/fb0929d_mercantile.json` (6, 6 dead). `06-Systems/Realm-Arc.md` P0.4, Port-Ledger A's P0.4 row.

## TO-ROADS: First-Person Travel follows the roads, on a second switch (4)

SylviaBun: *"When traveling in first person, however, the travel route always just goes the straightest shot to your
destination running you through the forest etc. A way to toggle this behavior to match or not would be nice."*
Reproduced first on the host's own code: First-Person Travel (OW-TOGGLE) is Travel Options' own journey, its autopilot
aimed at the place from the first frame - the mod never routes to a named destination - and it is the original travel
option Mac asked back, so it stays so. A second key beside it, **First Person Travel Follows Roads**
(`GeneralOptions.FirstPersonTravelFollowsRoads`, off, on the tile, read live), makes a map pick the Overworld's own
route - the road joined first, round the peaks, its legs on the mod's autopilot (`scenes/world.js` `tvRoutesJourneys`)
- walked in first person, the view never raised. There is no second planner: the map's three doors hand the pick to
the Overworld's `travelViewRouteTo` / `travelViewWalkTo`, and the view's own doors still ask `tvOwnsJourneys`, so it
stays down. The map's Resume plans it again from where the traveller stands; a place the roads cannot reach is refused
in the Overworld's words, never walked straight or teleported; a leader's routed pick leads the party.
Main's Overworld Path switch (OW-PATH, Roads or Free) landed alongside: a first-person map pick, a spot and the map's Resume go by the roads whatever it says (`tvMapForcesRoads` - the key is named for the roads, and the switch is on the Overworld's bar), while the Overworld's own journeys keep it. `test/fb0929d_toroads.test.js` (7), `tools/mutants/fb0929d_toroads.json` (23: 21 dead, 2 equivalent - `!!travelOptions`
and `!!travelView`, which no caller reaches false). Four suites' pins and five mutant records re-aimed to the moved
lines, none loosened. `06-Systems/Travel-View.md` TO-ROADS, `06-Systems/Travel-Options.md`, Port-Ledger A's TO1 row.

## AC-COMPARE: the character's armour, and what a wear would change (5)

SylviaBun's suggestion, Althea's idea: the pack should say the character's total armour, and an item's card how it
compares with what is worn, green better and red worse. Daggerfall keeps no total - its armour is seven numbers, one a
body part, and a blow meets one of them (CalculateStruckBodyPart, then CalculateArmorToHit) - so the enhanced pack now
shows the seven where the classic doll does, each on the worn map's panel for its part, and one figure made of them: the
armour a blow meets on average, each part weighed by the struck-part table of the combat core in force
(FormulaHelper's 2/3/3/4/4/3/1 in 20, or the overhaul's own), on a plaque at the figure's head. The item card, hovered or
picked, says what the wear would replace (EquipItem's three arms - one export, `wearLeavers`, which `equipItem` itself now
runs), a weapon's damage against the one it replaces, the overall figure and every part it moves, now and after - and
what the card says is what the wear then does, pinned. An unidentified piece's affixes stay out of its comparison until
it is identified. No modifier key: the card is always the item's. The classic window is untouched.
`test/fb0929d_accompare.test.js` (5), `tools/mutants/fb0929d_accompare.json` (35, 35 dead).
`10-UI/Slots-Hotbar-Status.md` AC-COMPARE, Port-Ledger A.

## MAP-KEY: the sheet's key - the classic filters, and a dungeon in orange (6)

Jigglehimmer (#suggestions): *"Enhanced map needs filterable key like the default Daggerfall world map"* - on the held
map every place was the one brown pen, and a new dungeon's hollow triangle had to be hovered to be told from a
graveyard. The filters were never gone: MAP1 kept the classic window's live store under the sheet and gave it no
control. The key now stands on the map's foot: DFU's four filters as toggles, each pressing the classic window's own
flip (`flipTravelMapFilter`, FilterButtonClickHandler :1024-1045, which the classic button presses too) on that store,
so both maps always agree and the save carries it; beside each, a chip of every glyph it hides in the ink the sheet
lays it in. Each glyph is inked in its classic dot's hue walked toward the pen (EM7's law, `MARK_INK_MIX` 0.58, the
smallest walk that keeps every kind ink), read at runtime off the player's own FMAP_PAL.COL (no palette, the plain
pen; no colour of it is written anywhere in the port) - one hue per kind, because the ruin's classic dot is 10.9
(CIE76) from the graveyard's; inked, the labyrinth's orange stands 20.9 from the graveyard's red. The far band still
inks the cities alone, and the key dims the rest. `test/fb0929d_mapkey.test.js` (8), `tools/mutants/fb0929d_mapkey.json`
(39, 39 dead). Two cites into `travelMapWindow.js` that named the filter handler for the buffer flip (wrong before this
change) now name the flip. `10-UI/Held-Map-Arc.md` MAP-KEY, Port-Ledger A's HELD MAP row.

## Found on the way, not touched

- On a phone held upright with paperdoll art, the enhanced pack's worn map collapses its side columns to 0px (grid
  "0px 330px 0px") - seen in AC-COMPARE's browser probe with a stand-in doll; it predates this batch.
- `tools/heldMapProbe.mjs` fails six of its own checks on the base as well (its I/H-box checks look for the box
  ENH-NOTICE3 moved onto the notice panel); MAP-KEY was checked with a probe of its own instead.

## For Mac

- **MERC-RISE's price is flat for most sellers.** Your 50% and "no skill lowers a sale" together force it: the best
  haggler may be paid at most half of their own ask, the least any counter asks, and no one below them may be paid more
  than they are. So at the field's counter every seller now gets 2718 - less than both of the report's offers - and
  Mercantile and Personality raise an online sale only where Daggerfall's own offer sits under that cap (low skills at
  the dearest counters). The other lawful shape keeps the skill in it and pays everyone less: scale Daggerfall's offer
  so the best haggler lands exactly on half their ask (2283 at 60, 2609 at 90 there). Or raise the share. Say which.
- **TO-ROADS is a second switch, OFF by default,** and only does anything with First-Person Travel on. A single
  three-way choice (Overworld / first person straight / first person by road) may read better than two switches. A
  route the roads refuse is said and dropped - never the straight walk (that would be the report itself) - and a pick
  made indoors or under water is refused in the Overworld's words ("You can only survey the land from the open air.").
- **AC-COMPARE's "total" is the armour a blow meets on average** (the seven weighed by where blows land), because a
  blow meets one part; a plain mean or a sum of the seven are the other choices, and neither means anything in combat.
  Only the pack's own card compares (not the shop or trade cards yet), with no modifier key.
- **MAP-KEY, zoomed all the way out, draws the cities alone** (as before), so with Towns hidden that view is empty;
  dungeons show from mid zoom, graveyards, covens and homes close in. Should the far view draw whatever the filters
  leave? And a keep and a ruin share the labyrinth's orange - their own classic oranges, inked, sit too near the
  graveyard's red (the ruin's 7.3 from it). The key is always open (about 115px, lower left); the path filters (roads,
  tracks, rivers, streams) still have no control on the sheet.
- **BOOK-SPLIT departs from DFU** (Port-Ledger A): DFU's own split loses the same three terms. The counters' merge on
  the way back is DFU's law restored, not a departure.
