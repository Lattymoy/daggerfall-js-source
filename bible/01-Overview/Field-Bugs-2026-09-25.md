# FIELD BUGS 2026-09-25 — DISC25, seven from Discord and the dungeon map

Mac, with seven Discord screenshots: *"One of these screenshots mentions our
enhanced dungeon map and making comprehensive improvements to it"*.

1. *"hands on the enhanced map sprite go over the black bars in retro mode"*
   (kurkku: "1996 Fantasy ruined")
2. *"Guard the guild quest"* - "Can't be done online mobs never spawn for
   it" (Sir McMobdon); "They did for me, but I had to wait the entire
   duration of time that the quest mentions - fast forwarding by loitering
   isn't a possibility in online mode" (Malentor)
3. General chat, Sir McMobdon: "shows im in julianasos / But doesn't show on
   standings ... Assumed it was cause I wasn't apart of same guild I couldn't
   receive the quest / But I checked i am / In guild / Still cant get quest
   shared / And doesnt show in standings"
4. *"Cant send letters"* - "Game still takes input making u jump and move
   and close the letter if u hit f"
5. *"Stack Splitting"* (Satranath, crediting Starempire42) - "It doesn't
   appear possible to split stacks currently, either in inventory or in
   shops when making a purchase."
6. *"any chance for discord Game Activity/Rich Presence?"* (Starempire42)
7. Off-topic, on the dungeon map: tannim - "maybe a 2d map COULD work if you
   did the plane you are on + stairs going down and had the ability to press
   down to advance the plane displayed down a step (or up to go up) ... If no
   plane one step up, just show the ramp going up or down"; kurkku - "there's
   so many possible crossing paths in dungeons / clicking stairs to move up
   or down a level is good though"; tannim - "The cramped floors make it hard
   to see where anything is. I wonder if spreading the map out would help."

The pins are `test/disc25{a,b,d,e,f}*.test.js` (19), and the mutant set is
`tools/mutants/disc25.json` (64: 63 dead, 1 recorded equivalent). Twenty-one
older records the rewrite moved out from under (disc22g, disc23a, em2,
em34, retro1, auditretro1, survtiers3's cite) were re-aimed at the new text
for the same law and re-run: all dead but EM2-22, which was already
recorded equivalent.

---

## DISC25-A: the dungeon map, comprehensively (report 7)

**What a real dungeon showed.** The freeware data (tools/fetch-data.sh,
outside the tree) loaded through the real readers into the real sheet in
Chromium: Privateer's Hold derived THIRTEEN storeys. Daggerfall lays its
rooms on a 3.2 m grid and every step of it is a headroom apart
(`FLOOR_MIN_GAP` 3.0), so each "Floor" was a scatter of corridor ends - and
each corridor end was a WALL, because the stair that carried it on belonged
to the next storey and the plan's edge onto it was inked as rock. The strip
of thirteen ran down the paper's right edge and three rows sat under the
right gauntlet. The floor keys (PgUp/PgDn, the brackets) had been there since
EM3 and nothing on the paper said so. That is tannim's "cramped" and
kurkku's "crossing paths", on the map meant to answer them.

**A1 - a cell is on the storey its own surface is nearest.** `surfaceY`
reads a triangle's plane at the cell's centre (the corners' heights ride
`floorTriangles` now), and `floorOccupancy`'s `keep` sorts the cell by that
height. By centroid a long ramp - two great triangles - split along its
quad's diagonal and could skip a storey outright.

**A2 - the stairs are found.** `levelField` lays every walkable surface of
the level on the plan's grid once per level (packed by cell), and
`storeyLinks` records every meeting of two storeys' surfaces in the same or
the next cell within `STAIR_RISE` (two of the motor's `STEP_OFFSET` strides
and 0.2: a one-metre cell can step over a tread), from both sides, gathered
into one stair within `LINK_JOIN`. Privateer's Hold: 100 links, in 6 ms.

**A3 - storeys that never lie over one another share a sheet.** A FLOOR of
the map is a run of storeys, bottom first, none of which covers another past
`SHEET_OVERLAP` cells (`groupSheets`, greedy - the fewest sheets any
run-of-storeys cut makes, in the order a player climbs them). Two surfaces
in one cell within a stair's rise are the stair itself, not a stack. Real
counts: Privateer's Hold 13 -> 9, Castle Coppersley 14 -> 9, Wayrest 15 ->
11, the Crypts of Gharcen 8 -> 3, the Graves of Kingwing 7 -> 2, the Prison
of Tristynak 13 -> 6. Where the dungeon really stacks, it stays stacked.

**A4 - no wall across a stair.** splitEdges takes `pass`: an edge onto a
stair's far side on ANOTHER sheet is neither a wall nor an opening. Inside
one sheet both halves are floor and there is no edge at all.

**A5 - the stairs are drawn and taken.** Three treads across the way the
flight goes and a head pointing along it (`paintStairs`): onto another floor
in the wall's pen, named "up to Floor 3" / "down to Floor 1" (a name that
would land under a hand or on another name is left to the hover); inside a
floor in the soft pen, once, from its lower end, pointing up it. A press on
one onto another floor turns the page (kurkku), the view left where it is so
the stair's other end is under the pointer. North is up the paper.

**A6 - the strip.** It stops above the right thumb, with a chevron row at the
end that has hidden floors (pressing it takes the next one); it marks the
floor you stand on (a caret after the word), the floor the way out is on (a
ring), and writes faint the floors nothing has been revealed on.

**A7 - the keys are said.** The sheet contract grows an optional `hint`
(beside `breathes`): the window's foot says "drag to pan · scroll to zoom ·
PgUp/PgDn floors · click a stair to take it · Esc to close" while the dungeon
is up, and the bay's line otherwise (`MAP_HINT`). The arrows still pan -
EM3's decision, kept.

**A8 - the hands are the thumbs.** `_handRects` reads the blob
`keyThumbPixels` kept (`thumbBox`) where the key has run, not the generous
zone it searched - the zone started well above the thumb and left the strip
three rows. Every sheet's words are kept out of the same, truer, rectangles.

**A9 - a note on a split level** is pinned at the storey whose revealed
surface is under the pointer, so it lands on the floor it was written on.

**Not done, and why.** tannim's "spreading the map out" is the 3D map's
cramp; the sheets are the 2D answer. A faint ghost of the floor below was
considered and left out: the stair marks say where the floors meet without
drawing two plans on one paper. What only Mac's eyes can settle is the
glyph's look on a real screen.

## DISC25-B: the held map inside the pillarbox (report 1)

DFU lays every window out in `DaggerfallUI.CustomScreenRect` while the retro
pillarbox is up - `new Rect(pillarWidth, 0, Screen.width - pillarWidth * 2,
Screen.height)` (ViewportChanger.cs:139-140). RETRO1 recorded that the port's
2D layer keeps the whole canvas, and the held map is a whole-window DOM root:
at 1920x1080 in 4:3 its painting ran from x 95 to 1825 over a pillarbox of
240 to 1680, and its top row and hint line sat on the bars. `retroScreenRect`
is CustomScreenRect, cut from the world rect's own pillar (`retroPillarWidth`,
one home for SetRetroAspectViewport's arithmetic); `_layout` insets the root
to it in the painted lane, so the painting, its ink, its thumbs, the top row
and the foot all fit the retro screen. The Morrowind arm's lane keeps the
canvas (AUDIT RETRO1 C2). Retro-Mode.md's departure and Ledger A's RETRO1 row
are NARROWED, not struck: the rest of the 2D layer still takes the canvas.

## DISC25-C: Guard the Guild online (report 2) - Mac's call

It is not a spawn bug. N0B10Y03 is a Mages Guild quest whose thieves come
`daily from 00:00 to 03:00` while the player is in the guild hall. Online the
world clock is real time at twelve to one - a game day is two real hours - and
the in-game window is fifteen real minutes out of every two hours. The foes do
spawn in it (Malentor). What the report asks for is the fast-forward:
offline the player loiters to midnight; online a loiter paces the window's
own timer and moves no world time, which RESTX2 decided ("online, sleeping
is no longer a way to skip to tomorrow"). Letting an online loiter advance
the player's OWN quest time is possible (MAC-LVL1 already credits a rest's
minutes to the skill clock), but the quest's "midnight" would stop matching
the shared sky - so it waits on Mac. Eighteen quests use `daily from`.

What shipped: the Online pane said "the quest clocks stand still", false
since WORLD7 (quest clocks charge played time online). It says what the
shared clock does to an hour-gated quest instead.

## DISC25-D: a guild refusal names the guild (report 3)

The player is a Temple of Julianos member; "Guard the Guild" is the Mages
Guild's. QUEST1's gate refused them rightly and said only "not a member of
the guild this quest requires" - no use to someone who IS in a guild. The
gate carries the guild now (`guild: 'MagesGuild'`) and `shareRefusalText`
says "are not a member of the Mages Guild, which this quest requires."

**Not reproduced: "doesn't show on standings".** The Standing page's Guilds
block (GUILD-REP) lists every membership through `affiliations`, temples and
orders included - a Julianos member reads "Julianos, Novice". The Reputation
block above it lists the five social groups and never a guild. The one path
that hides a membership everywhere is the vampire book swap. A screenshot of
the page, or the save, would settle it. **Recorded, not fixed:** the share
gate never checks temple or knightly-order quests at all (a non-member
receives them), and checks no rank (`minReq`) for anyone - tightening it
changes who can receive what, which is a rule, not a bug fix.

## DISC25-E: a letter's keys are the letter's (report 4)

MAIL1's letter is written in the SOC3 social panel - real DOM fields in a
panel that is not a window in any host's slot. No overlay gate stood between
a letter and world.js's key ladder: every key joined the ring (W walked,
space jumped), and F is `SocialInteract`, which toggled the panel shut. The
panel stops its own fields' keys on its root now (the chat's rule; F5 and
F11 swallowed first, since the host that swallows them will not see them),
and world.js and exterior.js carry dungeon.js's KB1 typed-field gate, below
the browser swallow and above the ring. The four hosts: the interior host
routes through `routeKey`'s gate; the dungeon context has no keydown of its
own.

## DISC25-F: stacks split everywhere (report 5, credit Starempire42)

DFU splits in TransferItem (DaggerfallInventoryWindow.cs:1515-1539): a stack
short of its planned amount, or any stack under Control, pushes "Pick how
many items (max N)?" and only its answer moves (:1546-1559); the trade window
INHERITS it (DaggerfallTradeWindow.cs:31 - buying :842, selling :795, taking
back :803). The port had it on the classic pack alone (CM5). The law's one
home is `systems/itemTransfer.js` now (`HOW_MANY_ITEMS`, `SPLIT_INPUT_MAX`,
`parseSplitAmount` - int.TryParse's reading, so "3x" and "1e1" are no count -
and `splitRequired`). The classic counter pushes CM5's box, modal, for all
three arms. The enhanced pack's card and the enhanced counter's strip carry
the question as a field beside the button that moves the stack
(`ui/howManyField.js`, one constructor), seeded with the most that would
move, so pressing it unread is the popup's Return; a count the parse refuses
moves nothing and says the popup's question.

## DISC25-G: Discord Rich Presence (report 6) - not built

A browser page cannot reach the Discord client. The desktop app can, over
Discord's local IPC socket, but Rich Presence needs a Discord application
(its client id and its art keys) registered on Discord's developer portal -
Mac's to create. Nothing is shipped with a placeholder id.
