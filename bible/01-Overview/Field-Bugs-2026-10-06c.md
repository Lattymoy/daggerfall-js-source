# FIELD BUGS 2026-10-06c - the cat that meowed on every tick, and the guard that ended before the attack

Five Discord reports of 2026-10-06, read with the user's three patch files the same day (WAYPOINTS, PACE-DIALS and the
anti-flicker patch, recorded on their own page, `01-Overview/Waypoints-And-Pace.md`). Two were found in the code and
fixed at their roots; three need the reporter's data to see, and what was checked for each is written down below. No
ARENA2 was at hand and no reporter's save; nothing here was seen in a browser.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "NPC sound glitch of a rapid cat meow. This one is in Chesterwark, Daggerfall; doubtful it's the only one" (Flylighter, a video) | the plaque asked StaticNPC.DisplayName every frame, and DisplayName seeds DFRandom with the person's nameSeed: while the player looked at a townsperson, every draw after it was the same number, and the town animals' 16 Hz roll answered alike on every tick | CAT-MEOW |
| 2 | "So I picked up the quest, the three hours passed, the mage disappeared, but no enemies showed up, so now I can't complete it" (Aru) | N0B20Y02's three-hour guard read as a delay, and online a delay is cut to 24 minutes: the guard ended before the attack more often than not, and a guard who stepped out of the hall in those two real minutes had the attack cleared for good | GUARD-WINDOW |
| 3 | "Ceiling inside home is glitched" (Sir Xelah Helbbruk, a photograph of the screen) | not reproduced - what was checked is below | - |
| 4 | "Can't talk to the first guy in 'The Riddle' quest" - "he's there but not interactable" (kurkku) | not reproduced - what was checked is below | - |
| 5 | "This teleporter is inaccessible in my dungeon because of the shelves, the dungeon is a teleporter maze and there is no other exit to this room" (Lidemi) | not reproduced - what was checked is below | - |

## CAT-MEOW (1)

`ui/worldPlaque.js` (worldHoverFrame). The town animals bark on Daggerfall Unity's own law (`systems/animalAmbience.js`,
GameObjectHelper.AddAnimalAudioSource and PlayRandomlyIfPlayerNear, A4): every classic update - 16 a second - each
archive-201 animal within 19.2 m rolls `DFRandom.rand()` and plays its call on 100 or under, about once in twenty
seconds of standing near it. The roll is the classic stream, the one every DFRandom reader in the game shares.

A person's name is StaticNPC.DisplayName (`characters/staticNpc.js` staticNpcName): `srand(nameSeed)` and the name drawn
off it, which leaves the stream at a place fixed by that person. World Tooltips asks DisplayName once per new hit (it
keeps the last hit's text, `prevHit`, Modded_HUDTooltipWindow.cs:266-275); the port's plaque resolves its namers EVERY
frame (its caching law is on what would be painted, which needs the words first). So while the player looked at a
townsperson the stream restarted at that person's seed every frame, and every draw after the name was the same number
on every frame: the animal's roll on each tick came out alike. For about one person in three hundred that number is
100 or under, and beside such a person a cat meowed on every tick - sixteen times a second. Measured with the real
DisplayName and the real animal pass: seed 296, a Breton man (Tristastyr Moorton), leaves 38 as the next draw; ten
seconds looking at him beside a cat is 160 meows in 160 ticks, against none in the same ten seconds looking elsewhere.

THE FIX: a readout leaves the classic stream as it found it. worldHoverFrame takes the seed before the pick and the
namers and puts it back after them, whatever they drew or threw (a `finally` beside the containment's own catch). The
namers run exactly as before and name exactly as before - a click's DisplayName (the Info line, the talk door) still
seeds the stream, as DFU's does. Not reproduced: the mod's single reseed per new hit, which moves the stream once each
time the pointer meets a new person and is observable as nothing but a different random draw.

The four hosts: every host's plaque is this one function (world.js, exterior.js, worldModes.js and dungeonContext.js
all call worldHoverFrame), so all four are covered by the one door; none was edited.

`test/fb1006c_catmeow.test.js` (3, new) drives the real hover door with the real DisplayName and the real animal pass:
the plaque names the person and leaves the seed where it was; ten seconds of looking at Tristastyr beside a cat meows on
exactly the ticks it meows on without looking (none); a namer that seeds and then throws leaves the seed too.
`tools/mutants/fb1006c.json` (CAT-MEOW-the-plaque-keeps-the-seed, CAT-MEOW-the-seed-taken-after-the-namers).

## GUARD-WINDOW (2)

`systems/quest/clock.js` (ONLINE_DEADLINES). N0B20Y02, "Protect an Honored Mage" (a Mages Guild quest): `_S.12_`, three
hours, hides the sleeping mage when it ends, and the reward waits on it (`_questdone_`: `when _S.03_ and _S.12_ and not
_S.04_`). Meanwhile `until _S.12_ performed: pc at _magesguild_ set _S.01_`, and `_S.01_` is `create foe _F.00_ every 55
minutes 1 times with 100% success` - the three Nightblades, once, at a random point in their first 55 minutes (CreateFoe
backdates its first spawn a random distance into the interval). Offline that is Daggerfall's own guard: three hours in
the hall, the attack somewhere in the first hour.

REST8 (`06-Systems/Rest-Arc.md` section 8) reads every quest clock as a deadline or a delay, and online a delay's
remainder is cut to the short wait, ONLINE_DELAY_SECONDS - 24 minutes of the character's clock, about two real minutes.
Its reading called `_S.12_` a delay ("the trance ends", a reward after a wait), and AUDIT REST II's sweep kept that
verdict. But the three hours are the guard itself, a WINDOW TO ACT - REST8's own rule makes that a deadline - and the
attack's interval is longer than the cut: the mage was hidden before the Nightblades came more often than not (with no
backdate, the wave at 55 minutes and the guard over at 24). Worse, `pc at` CLEARS `_S.01_` on every tick the player is
not in the hall (PcAt.cs, verbatim), and once `_S.12_` is performed the `until` never runs again to set it: a guard who
stepped out during those two real minutes lost the attack for good, and the reward waits on three Nightblades killed.
That is the report: the mage gone, no enemies, the quest beyond finishing.

THE FIX: `_S.12_` is a deadline by hand (ONLINE_DEADLINES, the table REST8 keeps for the clocks its reading gets wrong):
online the guard keeps its three hours, charged as QCLOCK-WORLD charges every deadline - played time, never a rest or a
journey - so the attack, charged the same way, always comes inside it. Offline nothing changes. The split over the 399
vendored clocks is 272 deadlines and 127 delays. Swept for the same shape (a delay closing an `until ... performed` that
sends foes): N0B20Y02 is the only one; A0C01Y01's bodyguard timer is a deadline already.

NOT RECOVERED: a guard that already ended this way stays as it is. Once `_S.12_` is performed the `until` never runs
again, so nothing sets `_S.01_` and the Nightblades never come - as in Daggerfall Unity for a guard who is away from the
hall when the three hours end. The quest repair (`systems/quest/questRepair.js`) puts back placements alone and never
writes a task or a clock, which is why the reporter's repair did nothing; and the quest has no failing end (`_oneday_` is
read by nothing), so the entry stays in the journal. The fix is for every guard taken after it.

The four hosts: the quest clock is the machine's (`systems/quest/clock.js`), read by every host alike; none was edited.

`test/fb1006c_guardwindow.test.js` (2, new) runs the real script: the guard reads as a deadline online, with no short
wait and its three hours; ticked on the played clock with the latest the attack can come, the three Nightblades are made
before the mage is hidden, online and off (red before the fix: online, no wave at all before the guard ended).
`test/rest8_questwaits.test.js` (the table's keys, the split 272/127, the guard's kind), `test/auditrest2_quests.test.js`
(the sweep's verdict, overturned with the reason) and `test/auditrestparty_quests.test.js` (D4: every hand-table entry a
deadline through the quest's success, the guard among them) moved with it. `tools/mutants/fb1006c.json`
(GUARD-WINDOW-the-guard-a-wait).

## Not reproduced (3, 4, 5)

**The ceiling (3).** The photograph is of a monitor: a house's walls and part of a plank ceiling, the rest of the
ceiling dark. An interior's clear colour is black (`render/renderer.js` INTERIOR_CLEAR), and a phone photographs a
monitor's black as that dark blue, so the dark is no sky: ceiling geometry is not drawn there. A building is drawn whole
- its merged static batch and every unmerged placement, with no view cull (worldModes.js's interior frame) - so nothing
culls a ceiling. The one way the port itself takes a piece out of a room is BASE-HIDE: in a room its owner may furnish
(an online home, or the player's own house or ship) every PROP-typed placement (`world/interiorLayout.js`
PROP_MODEL_TYPE, DaggerfallInterior's propModelType 3) is its own draw, and the owner may take any of them out, the
whole room at once included (`scenes/decorBase.js`, `net/decorLaw.js` decorBaseModelKey: a key names its placement AND
its model, so it can never name another layout's piece). If an interior lays a ceiling tile as a prop - the town mods'
interiors lay floor and ceiling tiles of their own as plugs (`01-Overview/Field-Bugs-2026-10-05.md`, a cellar's stair
shut with a floor tile 1000 over its ceiling 2000) - then clearing that room's furniture takes the tile with it. Whether
any does can only be read off the player's data. Wanted from the reporter: the town and the house, whether it is an
online home, and whether its Built in list was ever cleared.

**The Riddle (4).** A0C01Y03's first step is `toting _flowers_ and _spouse_ clicked saying 1011`: the spouse speaks only
when clicked while the Yellow Flowers the questgiver handed over are carried. Without them the click is registered and
rearmed and nothing is said - TotingItemAndClickedNpc.CheckTrigger, verbatim - and a quest person's stand shows no
plaque at all (World Tooltips names a quest ITEM alone), so he reads as "not interactable" in Daggerfall Unity too.
Checked, against DFU's own source: StaticNPCClick returns after DoClick for every quest person (no talk window), and the
port's click (worldModes.js clickQuestFlat) does the same; the real script run through the machine gives the flowers as
a quest item (its UID and symbol) and fires `_S.02_` on the click when they are carried, and the world host's
carriesQuestItem reads exactly those; quest items never stack (`systems/inventory.js` isStackable,
DaggerfallUnityItem.IsStackable); the Materials Bag never takes one (`systems/materialsBag.js` materialKeyOfItem); Climates
& Calories never rots a plant ingredient (`systems/survival/food.js` isFood); the item's quest fields survive a save
(`systems/itemFields.js`). No port-only way to lose the flowers or the click was found. Wanted: whether the Yellow
Flowers were in the pack when he was clicked.

**The teleporter (5).** The screenshot shows a flooded dungeon room, two bookshelves against the far wall and a red
panel standing behind and above them - the shape of the "red brick" teleporter flats (FLAT-RELAY,
`01-Overview/Field-Bugs-2026-10-05c.md`, made a walked-into flat teleport fire). Checked: DFU gives an action flat a box
collider sized to its billboard (RDBLayout.cs AddAction), and the port brackets the billboard the same way, its width
deep (dungeonContext.js registerFlatAction); a teleport flat walked into fires since FLAT-RELAY. Whether the shelves
stand in front of the teleporter in Daggerfall's own block, and how Daggerfall Unity reaches it there, is the block's
data. Wanted: the dungeon's name (or the save) to read the block.

## Records

`01-Overview/Active-Arcs.md` (this page's line), `06-Systems/Rest-Arc.md` and `06-Systems/Online-Time-Arc.md` (the split
272 and 127, GUARD-WINDOW's record lines), `01-Overview/Audit-Timefree.md` (the count's history), `09-Testing/Testing.md`
(two files, five tests; REST8's row moved with the split), `tools/mutants/fb1006c.json` (3, all dead).

## Not verified here

- Nothing was played or rendered. CAT-MEOW is measured on the real DisplayName and animal pass in node, not heard in
  Chesterwark; the animals there and the person beside them were not identified from the video.
- GUARD-WINDOW is the script and the clocks ticked in node, not a guard stood online; the Nightblades' placement in the
  hall is the host's, unchanged.
- The three reports above are not reproduced, and nothing was changed for them.
