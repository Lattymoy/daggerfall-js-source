# FIELD BUGS 2026-10-07b - the castle's towers stood on their floors, no climb at a journey's pace, the tutorial dungeon every character's own, the family's seat the player's to move

Four Discord threads of 2026-10-07, handed over as screenshots. From `#bug-reports`, Jacob, *"The two Daggerfall Castle
courtyard tower interiors are very bugged"*: *"Everything inside them seems to be shifted up several meters including
stairs, and there is open void in some spots."* From `#feature-feedback`: afjiz, *"Family Seat - Option to ..."*;
nObOdy, *"Lock privateer's hold."*; and Shabalako, *"Overworld Travel can be used to exploit climbing levelling"*, with
Sahh, of House R'is, under it. Every change below is pinned by tests that fail on the record's own code (39f728de), the
new pins mutation-checked (`tools/mutants/fb1007b.json`, 23 of 23 dead). The player's own ARENA2 was at hand (the
DFU-distributed freeware set, outside the tree): the towers were measured and drawn from it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "The two Daggerfall Castle courtyard tower interiors are very bugged. Everything inside them seems to be shifted up several meters including stairs, and there is open void in some spots" (Jacob) | the towers' room shells are ObjectType 5, which classic writes at the storey a model stands on, and DFU places centred on it - each storey half a shell under its furniture, lights and markers, the stair 3.2 m under its own; DFU carries it | TOWER-FLOORS |
| 2 | "when you want your family to be situated in a specific town, especially if your fresh from Privateer's Hold, you have to really rough it ... the option in the enhanced ui to reset your family seat to a town your currently in" (afjiz) | the seat is the first second the house stands on any town's map pixel - inns and trade have nothing to do with it - and nothing ever moved it | FAMILY-SEAT |
| 3 | "The first dungeon is a tutorial area. New players loading in in front of 50 players in a dead dungeon with no enemies ruins the magic" (nObOdy) | every character online in Privateer's Hold stood in one world room, `dungeon:m187853213` - its memory, its foes, its doors and its loot | HOLD-SOLO |
| 4 | "if you keep walking forward into a home can make your character climb and let go of the surface at an extremely fast rate, making levelling climbing a joke. An easy fix could be disabling climbing during overworld travel" (Shabalako); "would also reduce the mortality rate of travellers falling from mountains at 60x speed" (Sahh) | the travel's scale grows the motor's step: at x60 a step is a second, and every climb timer fell due every step or two | CLIMB-TRAVEL |

## TOWER-FLOORS (1)

`world/interiorLayout.js` FLOOR_MODEL_TYPE, STOREY, floorModelStoreysUnder, lowestY. The towers are `CUSTAA05.RMB`
(BLOCKS.BSA 60) records #0 and #1, Daggerfall's cell (5,6) in the classic layout and Beautiful Cities' alike (the mod
ships no CUSTAA05): exterior model 522, 17.9 m, a street door at its foot and a door to the castle's walls at 14 m; an
interior of 100 models - 69 room shells and stairs over five storeys, 31 pieces of furniture.

Classic writes ObjectType 5 at the height of the storey a model stands on. 1,250 of its 1,433 interior records are flat
floor planes (1000, 1100, 1300, 1500, 1700, 1800, 2700); every one of the 1,433 sits on a storey (YPos a multiple of
129). The other 183 are models centred on their own origin - the room shells 31024, 31031, 31025, 31000 and their kin,
the two-storey stair 31023, the hall 28703 - in seven records alone: the two towers (69 each), the castle's three
dungeon-door wings (#4-#6, 9 each, never entered as a room) and two shops (LIBRAM00 #7, BOOKAS00 #8, 9 each). Written as
ObjectType 13, every one of those models is put at its centre with its lowest vertex on a storey, in every one of its
uses - 31024 at -63 6,108 times, at -192 1,221 times; 31023 at -128; 28703 at -159. DFU places a type-5 model like any
model (DaggerfallInterior.cs:433-436), centred on the record's height, so each stood half its height under its storey:

- a tower storey's furniture 1.58 m over the floor the player walks, its markers and lights with it - the lanterns, two
  metres over the storey, hung over the room's ceiling, and the room was dark;
- the stair 3.2 m under its own storey, 1.6 m lower than the shells around it: its treads began 1.3 m under the floor
  and stopped 1.9 m short of the next - the open void at the stairwells;
- the room's door at -0.45, the street's at 1.18.

DFU carries the towers broken (the DFWorkshop thread "CUSTAA05.RMB - Restored Tower Buildings' Interior"; a mod fixed
them by hand with the world data editor). Now an ObjectType 5 model stands on its lowest vertex at its storey, as DFU
stands a prop on its lowest vertex at its height: the towers' floors are 0, 3.225, 6.45, 9.675 and 12.9, the furniture
5 cm over each, every marker on one, a stair from each storey but the top up through the next, the room's two doors
where the tower's are (1.13 against the street door's 1.18; 14.03 against the wall door's 14.08). The planes do not move
(2700's two by the 0.1 mm its lowest vertex lies under its plane). One model is written a storey over the convention:
the hall 28703, whose floor stands exactly a storey (129) over the foot of its stair shaft, is written in the two shops
at its floor's storey - where the ladder's top and two enter markers are - so it stands a storey lower
(`floorModelStoreysUnder`, a repair table as DaggerfallInterior.IsBadInteriorModel is one). Across every RMB block the
law moves exactly those 183 placements and 2700's two; both vendored town packs write ObjectType 5 for floor planes
alone (341 and 742), which do not move.

VOID-ENTRY's classic voids (`01-Overview/Field-Bugs-2026-10-04d.md`) were 18: two were the shops' second doors, whose
rooms stood half a shell under the street - they land at their own doors now, and the count is 16, every one a check
marker over nothing in the desert blocks (`test/fb1004d_voidentry.test.js` re-pinned; Port-Ledger's VOID-ENTRY row,
Beautiful-Towns and enterExit.js's note narrowed).

All four hosts: the world host's and the one-location exterior's buildings are built by worldModes.js
(buildInteriorContext, the one caller of layoutInterior beside the standalone `?interior` scene); dungeonContext.js lays
out no building. Seen in the standalone scene (`?interior=CUSTAA05.RMB:0`, headless Chromium on SwiftShader) from the
landing at the street door, before and after: a dark room with a table and a barrel at chest height, then the ground
storey lit and furnished on its floor. NOT WALKED through the castle's own door in the live game.

## FAMILY-SEAT (2)

`scenes/legacyHost.js` familySeatHere, moveFamilySeat, LEGACY_TEXT seatMoved and seatNowhere; `systems/legacy/family.js`
readFamily; `systems/legacy/store.js` mergeFacts; `ui/familyPages.js` drawHousePage; `scenes/world.js` the family
provider. What the report believed - inns, trade - never claimed the seat: the host's tick notes it the first second
the house stands on a town's map pixel (its streets or a building of it, never a dungeon under it), and a map pixel is
far wider than a town's walls - a road past one, a journey's crossing. Nothing ever moved it.

Now the House page (the Family tab, the enhanced pause screen) offers the town the one played stands in, when it is not
the seat already and no Succession waits: `Make <town> the family seat` - the first press says what it does ("The
house's heirs will be born in <town>, and its fallen laid to rest there"), the second moves it, as a switch is armed. The
heirs are born there, the fallen laid to rest there, the house's news told there (the seat's map id comes with it), and
a house without a home of its own lives there - all read live. The house keeps its name: a house named for its first
seat stays that house. Only the player moves it; the first town is noted as ever.

A moved seat carries when (`seat.at`, the wall clock), and the later move stands in every merge - the store's, the
realm line's, the save's against the store's. They kept the newer copy by rev's own seat, so a stale tab's or another
device's write carried the old seat back over a move. A seat neither copy moved merges as it always did.

## HOLD-SOLO (3)

`scenes/worldModes.js` roomIdentity (`solo`) and PH1's respawn; `scenes/world.js` the key block; `systems/startDungeon.js`
(new: isStartCell, isStartDungeon). Every dungeon's room is keyed by its map id, so every character in Privateer's Hold
stood in one world room: the others' bodies, the room's memory (the dead stay dead, the doors stay open), its
simulation, its acts and its loot, and a trade from anyone in the room. The tutorial dungeon - the location on the
classic start's own cell, read off the configured Startup.StartCellX/Y as the classic start, D-ONLINE2 and PH1 read it -
keys no room now, and the frame's `!key` arm leaves the room it was in (AUDIT ONLINE D4). Every shared lane asks
`isWorldRoom` of the room it is in, so they go quiet with it, and the dungeon is the character's own save's, as offline.
The World, Region, Party and Guild chats ride the hub and keep talking; the street outside is the shared world again.
Of every location in the world, the start cell holds one - Daggerfall's Privateer's Hold, map id 187853213 (MAPS.BSA
read through the port's own reader). The relay is untouched: an older client still joins the old room, with other older
clients alone. Asked of the report and not done: a party cannot take the tutorial together.

## CLIMB-TRAVEL (4)

`player/motor.js` (`travelling`), `player/climbing.js` (the abort ladder), `scenes/world.js` (the motor's
`travelling: () => wildTravelling()`; TV-WASD's `onFoot`). The time scale grows the motor's fixed step, never its count:
at x60 a step is a second of game time, and every climb timer - the classic climb's 0.77 s start and 0.82 s checks, the
free climb's start and its wall tally - fell due every step or two. Measured on the world host's own motor (motorStats,
climbingDeps, parkourDeps; Climbing 40; two real seconds walking into a wall too tall to top): at walking pace one hold
and one or two Climbing rolls; at x60 eight to ten holds, 59 rolls (the classic climb) or 94 (the free climb), and six
or seven falls of more than five metres - the report's climb and let go, and the reply's travellers falling.

Now, while a journey runs or the keys travel under the view (the world host's `wildTravelling`, WILD-ALERT's "fast
traveller"), neither climb takes a wall: the motor's `travelling` stands beside levitation and the saddle - in the
classic climb's abort ladder and the free climb's `unheld` - so there is no walk-in start, no jump's grab, no lower and no
mantle, and a hold a journey finds lets go. The keys' travel walks at walking pace while the hands hold a wall, so the
keys never put a climber to a journey's pace. Off the journey the climb is the climb it was. The four hosts: world.js
wired (its one motor - worldModes.js drives it indoors); exterior.js builds its own motor and has no travel;
dungeonContext.js builds no motor.

## Pins

- `test/fb1007b_towerfloors.test.js` (4; three gated on ARENA2): the law on the layout's own input shape; the towers'
  five storeys, furniture, markers, stairs and doors; the shops' storeys and the hall; the whole corpus's moved set.
- `test/fb1007b_familyseat.test.js` (4): the host's move, refusals and store; every merge; the House page's two
  presses; the world host's provider.
- `test/fb1007b_holdsolo.test.js` (4; one gated on ARENA2): the start cell, a custom one too; roomIdentity and the key
  block executed from their source; the world's one location on the start cell.
- `test/fb1007b_climbtravel.test.js` (4): the report measured and the law, both lanes, on the world host's motor; the
  climb off the journey; a hold let go; the host's wiring.
- Re-pinned: `test/fb1004d_voidentry.test.js` (classic voids 16, the two shops' doors off the list).
