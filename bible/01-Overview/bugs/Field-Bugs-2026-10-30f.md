# FIELD BUGS 2026-10-30f - Prince Helseth's letter ran out on the road (TRIP-FROM-START, TRIP-PIXEL, TRIP-HOME)

A player's report on the Discord, handed over in a session: "Prince Helseth's Blackmail - Bugged quest. Starts
normally, If you fast travel to any location, or use overworld travel, you get the message below with the quest
ending." The journal read "This step of the main story ended before the story could go on." Read on main's
`a0c18be6a` with the freeware's data. The pins are `test/systems/quest/fb1030f_triphome.test.js`, the mutants
`tools/mutants/fb1030f_triphome.json` (15, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Prince Helseth's letter fails on any journey | `_1stparton_` measured its trip where level 4 found the player, not where Helseth starts it | TRIP-FROM-START |
| 2 | (found on the way) | A quest site past the Bay was measured to a pixel in the Bay | TRIP-PIXEL |
| 3 | (the owner, after: "Should we look at other quests") | Elysana's Robe never counted the way back to Elysana | TRIP-HOME |

## The letter's clock (TRIP-FROM-START)

FOUND. S0000999 starts S0000002 when level 4 is done, wherever the player is. `Place _castfort_ remote house1` is
drawn in the region the player stands in. `Clock _1stparton_ 00:00 0 flag 17 range 0 2` is 2.5 times the trip to the
quest's places (flag 16), measured from there at the parse, as `Clock.cs` SetResource does. Helseth starts it a day
later in Wayrest (`_S.03_`, the letter handed over).

Levelled in Daggerfall, Sentinel or Northmoor, 40 draws each at level 4: the clock was 2.5 to 7.2 days, and the travel
map's default trip from Wayrest there and back (cautious, inns, ships, on foot) 44 to 80 days. All 120 failed on
arrival. Online a journey is a raise, and no quest clock is charged for it (QCLOCK-WORLD), so the report is the
offline game's.

FIXED. A travel clock (flag 16, or the bit-0 hack) measures its trip again when `start timer` starts it, from where the
player stands, and keeps the longer (`systems/quest/clock.js` startTimer). The same 120 draws now arm 170 to 336 days
from Wayrest, and none fails. A clock is never made shorter than DFU's, and one that has run resumes its remainder. The
mark rides the save (`travelArm`); a save from before it reads flag 16. A measure that throws keeps the parse's number and
says so: the first push let it throw, and SHARE-REVEAL's world stub (no `maps`) lost N0B00Y17's start-up to it. Of the corpus's 211 travel clocks, 39 are
started by a later task; 170 start at the start-up, where the parse stood, and measure the same.

NOT CHANGED. The clock is still 2.5 times a cautious trip by cart, DFU's allowance. A cautious trip on foot there and
back is 2.67 times. Levelled in Wayrest at level 4, no draw outruns it; at level 8, 33 of 120 do. That is every travel
clock's allowance, and the owner's call (open).

## The way back to the quest-giver (TRIP-HOME)

FOUND. Twelve quests are started by another quest, so they begin wherever the player is, and have a remote place and a
clock. Elysana's Robe (S0000006) has Helseth's shape, but its `_queston_` starts on the Yes, where the offer found the
player, so TRIP-FROM-START measures the same. The way back to Elysana in Wayrest is not a quest place and was never
counted. Offered in Daggerfall, Sentinel or Solitude, 20 draws each: 2.5 to 10.5 days for 23 to 57 days of road. All 60
failed; offered in Wayrest, none.

FIXED. A deadline, as it starts, also counts the trip to the seat of each at-home individual the quest makes its
questor (`add X as questor`), the town named for its court's region, unless the player stands there
(`systems/quest/clock.js` questorSeats). The 60 draws now arm 128 to 323 days, and none fails. Offered in Wayrest, the
clock is DFU's. A delay counts no way back: S0000012's `_2palace_` brings the messenger when it ends. The parse never
counts it, because `add as questor` lines are tasks and are parsed after the clocks.

It can reach the deadlines of four quests: S0000002, S0000006, S0000007 (Cyndassa) and S0000013 (Queen Aubk-i).
S0000012's one travel clock is the delay. Medora's Balfiera has no town of its name, and no script makes a court past
the Bay its questor, so neither has a seat.

## A site past the Bay (TRIP-PIXEL)

FOUND. The measure read a site's pixel from its row's world coords. A site past the Bay keeps its own pixel
(`worldPixel`, START3), and its row's coords read a pixel in the Bay: levelled in Solitude, a manor under a day away
measured 149.6 days.

FIXED. `travelTimeSeconds` reads `worldPixel` first, and measures a site past the Bay that its name does not find. The
manor near Solitude is the 2.5-day floor. A Bay site is measured as DFU measures it.

EVERY PROVINCE. The pins hold Helseth's letter levelled in Daggerfall and in Wayrest beside Solitude, and Elysana's
Robe offered in Daggerfall and in Wayrest beside Solitude. THE FOUR HOSTS: none is
touched. The clock is the quest machine's, ticked the same under `world.js`, `exterior.js`, `worldModes.js` and
`dungeonContext.js`.
