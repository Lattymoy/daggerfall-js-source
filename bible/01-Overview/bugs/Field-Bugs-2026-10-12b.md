# FIELD BUGS 2026-10-12b - six threads from the bug-reports channel

Six Discord threads from 2026-10-12, handed over as screenshots. Read on the code as it stands at main's `f7388650`.
All six are changed here. Three of the six are reasoned from the code without the player's data (no ARENA2 here), and
each says what it could not see and what the reporter is asked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Unable to build in my yard." - "I am unable to build in about 50% of my yard. It says that it belongs to another property no matter what I do." (Trey) | HOME-LINE split the ground at the midline to EVERY building of the town pixel, a shop's or a temple's as much as a house's | fixed (YARD-LINE) |
| 2 | "Boulder/lodestone/moonstone still identical" - "Moonstone might be a slight shade darker but thats about it"; "an ebony vein ... a dark enough shade to where you can at least kinda tell" (SaberGGaming) | VEIN-WASH's washes spread a fifth to a half, multiplied into a lump that keeps its own hue; Lodestone kept DFU's colours, and a boulder's stone IS Lodestone's lump | fixed (VEIN-HUE) |
| 3 | "Grass renders through portals" (Skibbster) | the vortex is a concealed batch, drawn blended with no depth written, before the grass | fixed (GRASS-PORTAL) |
| 4 | "Decoration Issue - Decorations clipping" - "a lot of stuff just clips through walls, even with grid on and changing size" (BigOOF; a Mounted torch) | an ordinary piece set on a wall stood its origin ON the wall's point; the grid rounded world x and z | fixed (WALL-CLEAR) |
| 5 | "morrowind NPCs missing heads" (Ardebitis; Boistun, in iron) | a helm hides the head and hair before its own mesh binds; a helm that bound nothing left the neck | fixed (HEAD-HELD) |
| 6 | "Caravan I'm supposed to be guarding walk through the city walls" (DenzelTIP) | a road party is set down at a RADIUS from its town's middle; the walls stand on the grid's square edge | fixed (WALL-WAY) |

## YARD-LINE: the midline is a lot's holder's alone (1)

`src/scenes/homeYards.js` yardWhyNot `lines`, yardLineHolder, ownYardHere; `src/scenes/world.js` the home frame's
`type` and `faction`.

FOUND. The refusal is `YARD_ON_OTHER` ("That is another building's ground."), and of its two lines the midline is the
one that takes half a yard: HOME-LINE (FIELD BUGS 2026-10-11b, Mac: "Split at the midline") refuses any point nearer
another building's ground than the house's own. `others` is every frame of the town pixel but the house's - every RMB
building subrecord: shops, temples, taverns, guild halls. A shop's back wall across a garden within twelve metres took
the half of the yard nearer it, and the marked edge (still the lot's rectangle) never shows the line, so every try on
that half was refused. HOME-LINE's own record frames the rule as "the ground between two houses".

FIXED. `yardWhyNot` draws the line to `lines`, the ground of the buildings that hold a lot of their own
(`yardLineHolder`: a building that could be a home - onlineHomes.js homeCandidate, Daggerfall's houses and the house
for sale, never a faction's House2 - or one a home's record stands for, a guild hall's yard). `others` is still never
stood on. world.js stamps each frame with its building record's type and faction; a frame with none (the mill's
subrecord) holds no lot. Unpassed, `lines` is `others`, as HOME-LINE had it. THE FOUR HOSTS: the yards are world.js's
(yardHost); exterior.js stands no yard, and worldModes.js and dungeonContext.js have none outdoors.

NOT SEEN. Which building stands beside Trey's house - the town and the house are not in the thread. A neighbour that is
itself a house still splits the ground, by Mac's rule; if the refused half faces a house, this is the rule, and the
reporter is asked for the town and the house (the thread's own reply asks the same). Drawing the line on the lot's
marked edge is not done here. test/scenes/fb1012b_yardline.test.js (3); one pin moved (fb1009_yardfoot's source pin of the
frame, PIN MOVED).

## VEIN-HUE: a vein's wash is its colour, at full spread (2)

`src/scenes/mineHost.js` ORE_WASH, ORE_DYE; `src/scenes/gatherHost.js` `batch.dye`; `src/render/renderer.js` BB_FS
`uBatchDye`; `src/render/enhancedLighting.js` EL_BB_FS.

FOUND. VEIN-WASH (FIELD BUGS 2026-10-11d) gave each ore on a shared picture a wash, multiplied into the lit flat. A
multiply keeps the picture's own hue: over a near-grey lump a wash's colour is its own spread, and the washes spread a
fifth to a half (Moonstone 1.12 to 1.65). Over a lump with any hue of its own, a blue wash on a brown stone is a brown
stone a shade off (the reporter's "a slight shade darker"). Lodestone kept DFU's colours, and a boulder's loose stone IS
Lodestone's lump (record 66, unwashed) - the two were one picture. Ebony's wash darkens, which a multiply can do, and it
was the one the reporter could tell.

FIXED. Every wash is its hue at full spread (Moonstone 1.25 to 2.4, a pale blue; Copper a bright orange; Dwarven Scrap
brass; Orichalcum green; Mithril teal; Adamantium violet; Silver a bright cold white; Platinum pale gold; Ebony
near-black), and Lodestone wears one of its own, a rust red. A boulder's stone stays unwashed. And a washed vein's wash
is its COLOUR: its flats carry `dye` (ORE_DYE, 1), the gathering host sets it on the batch beside the wash (open ground
and dungeon), and the billboard pass sends it beside the wash (`uBatchDye`, reset with it, 0 for every other batch).
Both lanes take the lit flat's brightness before the wash and, dyed, show that brightness in the wash's hue (the
classic lane in display colour, the Enhanced Lighting lane in its linear light; the classic-shadows lane is the EL
lane's text). ARENA5's banners are washed and never dyed - a multiply as ever.

NOT CHANGED. The glow over every vein and the compass keep mining's one copper, VEIN-WASH's recorded choice ("they say
which profession, not which ore"). The glow lies additively over the node's own picture, so near a vein it pulls every
ore toward copper; tinting it per ore is Mac's call. NOT SEEN: record 66's own pixels (no ARENA2 here) - the dye is
chosen so the answer does not depend on them. test/render/fb1012b_veinhue.test.js (4); fb1011_veinwash's DFU-owner pin moved
(Lodestone washed, PIN MOVED).

## GRASS-PORTAL: the street's blended flats are drawn after the grass (3)

`src/render/renderer.js` billboardBlended, holdBlendedBillboards, holdBlended, drawHeld; `src/scenes/world.js` the frame.

FOUND. The violet vortex is COMPANION-PORTAL's (`scenes/portalFx.js`), stood by a Portal Stone (`scenes/portalGates.js`)
and by a companion's arrival. It is a concealed batch (`conceal` mode 3), so drawBillboards draws it in its blended
phase: depth tested, never written. It rides the street's live billboards, and the grass (`frameGrass`) is drawn ~250
lines later in the frame: at the vortex's pixels the depth buffer held the ground behind it, and every blade between
the portal and the field's far edge drew over it - the band across its middle. RAIN-OVER-GRASS is the same fault for
the rain.

FIXED. The frame takes the street's blended flats (a portal's vortex, a veiled foe, a ghost - the blended phase's own
test, `billboardBlended`, now the one law the phase asks too) out of its billboards in place (`renderer.holdBlended`,
after DW-F has flagged them) and draws them in a call of their own after the grass, the banners and the haze, before
what falls (`renderer.drawHeld`). Their shadows are recorded by that call - the records are replayed the next frame.
The held list is the renderer's, emptied by each hold and each draw (PERF-V8: the frame stood 249 bytes under its
budget - a frame local and two closures cost more than they saved; two calls fit). THE FOUR HOSTS: world.js alone draws grass;
exterior.js stands no portal and no grass, worldModes.js neither, and dungeonContext.js stands portals and no grass.
Not done: the static flats' spectral archives (`allBatches`), which a town does not stand. test/render/fb1012b_grassportal.test.js (3).

## WALL-CLEAR: a piece set on a wall stands in front of it (4)

`src/systems/decor/decorPlacer.js` pieceAt, reach, DECOR_WALL_GAP; `src/scenes/decor/decorTool.js` the flat ghosts' `flat`.

FOUND. The Mounted torch is catalogue flat 210.17, not a mount (DECOR2c's mounts are the owner's own weapons and
armour). Every non-mount piece read the surface's normal only to find a ceiling, and otherwise stood its origin on the
point the eye met: on a wall, half a model's box inside it, and a flat (which turns to the eye) half its width - the
more the bigger it was scaled. The grid then rounded world x and z, into the wall as often as out of it.

FIXED. A face within DECOR_HANG_NY of level is a wall: the grid snaps along it, never into it, and the piece stands out
from it by how far it reaches into it (a model by its box turned and scaled, a flat by half its scaled width - the
tool hands its three flat ghosts' sizes to the placer) and DECOR_WALL_GAP (2 cm). Floors and ceilings are as DECOR1d
and DECOR-SHELL had them. A flat stood off by half its width floats that far off the wall seen square on - a flat turns
to the eye, as Daggerfall's own do. Not done: a piece set on a floor against a wall is still not pushed out. Pieces
already placed keep their `pos`. test/systems/decor/fb1012b_wallclear.test.js (3); decor2c's "a thing that stands" pin moved (it
stands clear of the wall, PIN MOVED).

## HEAD-HELD: a helm that bound nothing gives back the head (5)

`src/combat/fpArm.js` bareHeadRows, buildTpBody.

FOUND. Only a helm hides an NPC's head (composeWornArmor: a helm's own head part, and the hair rule under the helm
slot). buildTpBody takes the hidden rows out of the skin (`shadowSkinRows`) before the helm's mesh is read or bound,
and a helm that then bound nothing - its mesh not in the archives, no shape its bone takes, a parse that threw - was a
note on a card an NPC never shows. The neck is never hidden: the nub above Boistun's collar. His fur-collared cuirass and
pauldrons are retail iron, a knight's roll (wardrobe.js: a helm at 0.3).

FIXED. After the assembly, `bareHeadRows`: when the head or hair was hidden and no piece of a worn add on the head's or
the hair's part bound, those rows are read and the body is assembled again with them - a bare head and a note, never
none ("every miss is a note and the skin stands"). Never the werewolf's. The player's body goes through the same door.

NOT SEEN. Which of the helm's misses this is (the BODY record's mesh, its shapes' names, the archive lookup) needs the
retail data. With the Morrowind body on, the player equipping an Iron Helm and opening the body card would name it;
the reporter is asked. test/combat/fb1012b_headheld.test.js (3).

## WALL-WAY: a road party is set down past its town's walls (6)

`src/systems/livingWorld/trips.js` townExit, wayTrims (every trip kind); `src/scenes/world.js` the town's `w` and `h`;
`src/systems/livingWorld/census.js` LwTown.

FOUND. A road party - an escorted caravan's merchant and sellswords among them - is walked along its way from `trim0`
to `len - trim1`, and the trim was `townTrim`, a radius: half the grid's side and half a block. A town's walls stand on
its grid's square edge, so a way leaving on a diagonal set the party down inside the walls (an 8 x 8 city: 18432 along
a 45-degree way is 13033 on each axis, its walls at 16384), and it walked out through the stone - and in through the
next town's. A long town's long axis the same (8 x 4: 14336 against 16384), and the 0.4 cap of a short way the same.
Nothing in the trips knows a wall or a gate; nothing on the road collides.

FIXED. Each end is trimmed where the way leaves its town's grid grown by half a block (`townExit` - the town's own `w`
and `h`, which world.js now writes beside `blocks`); along an axis a square town's is townTrim's own. The two are held to
0.4 of the way each only where they would meet. Every trip kind (the market, the hunt, the trip, the pilgrimage, the
dive) trims by `wayTrims`. A party now appears outside the walls, near a corner on a diagonal way, not at the gate:
meeting the in-town exit walk at the gate is a larger change, not done. test/systems/livingWorld/fb1012b_wallway.test.js (4);
test/lwRealTown.mjs's replay and lwwalls_city's pin of the town row moved (PIN MOVED).
