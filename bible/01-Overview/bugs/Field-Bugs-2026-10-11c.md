# FIELD BUGS 2026-10-11c - "Somehow FPS is returned": the sea's mods in a crowded inland town

A Discord thread from bug-reports, handed over as a screenshot: "I've found the issue what cause significant fps drop at
town. So, i am in Chesterwark and it's seems very crowded ... I have them enabled and all other my graphics settings at
High. Now we will log in to online ... We got 70 at best. Now we leave the game, and going to turn off settings ... At
picture #6 we have reach my framerate cap and it feels stable after 1m of waiting ... TLDR: Disable World > The Sea and
Ships section (disable all mods in that section)."

| | Report | What it was | Done |
|---|---|---|---|
| 1 | frames fell in Chesterwark online with the World tab's "The sea & ships" on, and came back with it off | online the room holds three of the five on (`systems/online/onlineLane.js` `ONLINE_ROOM_MOD_KEYS`: Iliac Puddle No More, the Ocean Holes, Detailed Ships), so the switch that moved was Come Sail Away's (with the sea fight and the other players' boats it carries) and Warm Ashes' (a timer). Measured: with no boat owned the five cost nothing in that town; with boats owned, Come Sail Away found every boat's Animators by walking her whole tree on every frame - every boat the player had placed, wherever it lay, and every other player's boat - and its two HUDs made their keys' names ashore for windows that were not shown | fixed (SEA-TOWN) |

## How it was measured

The real game on the freeware ARENA2 (`tools/fetch-data.sh`), Chesterwark (region Daggerfall, a 7 x 6 city with no sea
within four map pixels), 15:00, through `tools/frameProbe.mjs`'s own windows (its census, its CPU profile by sample count,
its sampled heap; 30 frames each) from a session's scratch driver, offline - the online frame probe's bots say no boat's
word, and online only the boats would differ. Milliseconds of this container's CPU a frame (SwiftShader's), relative only;
"the frame" is the world host's JavaScript (`world.js` `frame`), "allocated" every byte a frame allocates.

| arm | the frame | Come Sail Away's update (`csaUpdate`) | allocated a frame |
|---|---|---|---|
| the five on, no boat owned | 12.88 | - | 1.15 MB |
| Come Sail Away off | 13.09 | - | 1.00 MB |
| the five off | 11.74 | - | 0.98 MB |
| the five on, 8 foes about, a rowboat standing on the town's pixel | 13.15 | 0.19 | 1.14 MB |
| five boats owned (one of each hull), moored three pixels off | 14.23 | 1.46 (`animate` 1.21) | 2.09 MB |
| the same, after SEA-TOWN | 13.36 | 0.18 | 1.04 MB |
| five boats owned, standing on the town's pixel | 18.39 | 2.78 (`animate` 2.13; the pool's frame 1.06, its draw 0.61) | 3.26 MB |
| the same, after SEA-TOWN | 15.37 | 1.25 (`animate` 0.68; the pool's frame 0.97, its draw 0.47) | 2.08 MB |

The first three arms differ by timer- and budget-driven work (the song player, the HUD's sweep, the snow's time-budgeted
blanket - Performance-Arena's own caveat) and by nothing of the sea's: its functions summed to about 0.3 ms in each, the
draws were the same to a call (1,166-1,167). The crowd arm put eight foes in Come Sail Away's enemy list beside a boat
owned - FixedUpdate's ray down each foe, the suspect read off the code, did not show in the profile. What did show grew
with the boats: `boatAnimators` (`systems/comeSailAway/comeSailAwayBoat.js`) was `[...walk()].flatMap(...)` over the boat's whole
tree, called by the runtime's `animate` for every boat in `AllBoats` - every boat the player has placed, active or put
away - and by the peers' pose for every other player's boat, every frame. A node bench over the vendored hulls (no GL):
34 us for the rowboat's 56 nodes, 158-167 us for the three hulls near 600, 421 us for the 1,228 of hull 1, a boat a
frame, more than the Animators' own steps it fed (13-175 us). The probe's heap: the walk's generators and the flatMap,
0.93 MB a frame for the five moored away.

## SEA-TOWN: a boat's Animators found once a tree shape (1)

`boatAnimators` keeps each tree's list while every tree's shape stands - `world/prefabNode.js` `prefabShapeStamp`, bumped
by every node hung (`setParent`, and so every instance built) and every component added, and by nothing else; the stamp
`world/prefabColliders.js` already keeps a tree's colliders by (AUDIT NAV1 #12). A tree's Animators change only with its
shape: the one place a runtime is attached is `importCustomGameobject`, as an instance is built and before it is hung
under its parent - and the rigs that push children or components directly (`world/ships/largeBoatRig.js`, `galleonRig.js`,
`carrackRig.js`, `shipKit.js`) build prefab TEMPLATES, before any instance. The same Animators in the same order, by
identity. In the live game the stamp stood (7,022 across the measured frames of every fleet arm), so the list is taken
once a boat. The draws did not move (1,130-1,132 a frame in every arm). The naval host already kept its ships' lists (`b.animators ??=`); it now reads the same kept list.

NOT CHANGED, ON PURPOSE: every boat is still asked every frame, standing or not. An Animator asked while its object is
inactive returns at its first test (`world/unityAnimator.js` `animatorUpdate`) - that ask is all it costs, and it is how
the Animator notes it was put away, so it starts over from its default state and parameters when she stands again (the
Port-Ledger's Come Sail Away row, (18): Unity's law, restated). Skipping a boat standing nowhere was the first draft here
and broke that; the pins now hold it the other way.

THE FOUR HOSTS: Come Sail Away's runtime and the peers' boats are `scenes/world.js`'s (`csaUpdate`, `csaPeersFrame`);
`scenes/worldModes.js` runs the same runtime through the world host's own `csaFrame` (a building's, a dungeon's frame),
so it is fixed with it; `scenes/dungeonContext.js` and `scenes/exterior.js` run no Come Sail Away.

## SEA-TOWN: the sea's HUDs ashore (1)

`world.js` `navalHud` made the plate's three key names (three walks of the bindings), the HUD's scale, its helm bar, its
vitals and quick rects and the classic compass box every frame, and `ui/naval/navalHud.js` `drawNavalHud` read none of them
with no ship near or the HUD covered - it reads its clock and takes the plate down. It is handed exactly those now. The
helm panel (`csaDrawHelmPanel`) made its free-mouse key's name and its cover's reads with no helm and nothing boarded, for
`ui/enhanced/enhancedHelm.js` `drawEnhancedHelm` to hide the panel unread; it is handed the empty state alone. About 25 KB a frame
of the CSA-on arm's garbage, and a few hundredths of a millisecond.

## What is left

Boats that STAND - the player's own on this pixel, other players' near, the sea's ships - still cost their pool's frame
(`scenes/comeSailAway/comeSailAwayPool.js` `frame`: the walk's records, the flats, the lanterns) and its draw (each mesh's key and the
still-batch's list made again a frame), PERF-SAILS1/2's and AUDIT NAV1 #13's ground, and their Animators' steps; the
measured share is in the last row above. Not touched here: it is a change to the still batch's pins and not this report's
town, which stands no boat. Online, the forced three (Iliac Puddle No More, the Ocean Holes, Detailed Ships) cost what the
"Come Sail Away off" row and the "five off" row differ by - within this probe's noise in an inland town.

Pinned by `test/systems/comeSailAway/fb1011c_seatown.test.js` (4); `tools/mutants/fb1011c_seatown.json` (8, all dead).
