# FIELD BUGS 2026-10-02b - the rocks' record audited, the lifted sea kept at its source, the crew's words steadied

Mac: *"1. Audit this"* (FIELD BUGS 2026-10-02, `01-Overview/bugs/Field-Bugs-2026-10-02.md`) and *"5. Controls for the player
vessel are currently broken, including not being able to lower sails"* - asked, the keyboard, on a Large Galley and a
Carrack. Every finding was reproduced on the real modules first, pinned by tests that fail on the record's own code
(e2466e2bd), and mutation-proven.

| | Finding | What it was | Done |
|---|---|---|---|
| 1 | the record's SEA-SHOAL changed nothing | Deep Waters' real carve takes a cell only where its four corners stand at the ocean's height: of a sea World of Daggerfall's flatten lifted, it carved none (0 of 15,600 cells) - so every node read land still | struck; SEA-LEVEL |
| 2 | "Controls ... broken, including not being able to lower sails" | a ship on that lifted sea, or placed on a town's raised harbour tile, lay beached: her sails refused at every press ("Unable to raise sail. Boat is obstructed."), oars and helm dead | SEA-LEVEL, PLACE-AFLOAT |
| 3 | the hull's sweep was nine rays | a rock smaller than the gap between two met nothing at all | ROCK-FREE: the sphere swept |
| 4 | a part answered once, at its overlap | one model that is a shelf under her and a stack ahead answered the shelf; the host dropped it as "beneath" her, and she sailed 15.5 m into the stack | the KEEL LINE |
| 5 | an overlap counted twice | the second sweep refused only the zero point: a rock overlapping her side outweighed the rock ahead, and she slid 15.9 m into it | counted once |
| 6 | a boat unmoved since its bake held a hull | its turn null, it was read as static: its walls unmet round a sphere it closed | movers never hold |
| 7 | the sweep reached half a hull past her ends | a rock clear of her pushed her and refused her helm; the push answers the sum - two clear astern and one clear ahead, and she sailed 217 m on, through the one ahead | ROCK-REACH |
| 8 | the crew's words: talk merged, stacks turned over, off the top | two pairs at one yarn stood as one bubble, by nobody; a stack re-ordered by distance every frame swapped its bubbles, up to 247 px in a frame; a stack of six at scale 2 stood off a 540-line screen's top | CREW-SAY |

## SEA-LEVEL: the flatten keeps the sea (1, 2)

**Reproduced first** (`test/world/terrain/fb1002b_sealevel.test.js`: the sampler's own sea, World of Daggerfall's own flatten, Deep
Waters' own hole mask, Unity's SampleHeight, world.js's `csaTerrainOf` mounted, the runtime over the vendored hulls).
A headland at twice the sea's height with a site levelled on its corner lifted every probed point of the open sea to
34.229-34.523 m (a site 7 m over the sea: 34.053-34.112); the real mask carved 0 of its 15,600 sea cells; a Small Ship or
a Carrack there had all five nodes on land, and the sail key answered "Unable to raise sail. Boat is obstructed."

**Why.** LocationLoader's flatten lerps EVERY sample of the tile toward the site's mean, after the tiles are read: the
sea, 0.4 of a heightmap step from reading land, is lifted over Come Sail Away's 34 m line and over Deep Waters' carve
(34.019 m), its tiles still water. SEA-SHOAL read a carved seafloor there - and nothing was carved.

**The fix (a departure).** `world/worldOfDaggerfall/wodLocationLoader.js` `flattenForLocation`: a sample at the sampler's sea clamp
(SEA_SAMPLE) under the site's mean is left the sea past SEA_RAMP (2) samples of the site's rect; inside it the site's
ground is the mod's, and within SEA_RAMP the mod's own lerp, a ramp down to the water. Land is levelled as the mod
levels it. SEA-SHOAL's read in `csaTerrainOf` is reverted. After: the sea reads 33.994 m everywhere past the ramp, the
mask carves 15,543 of 15,600 cells, and both hulls raise sail at the key (End), sail, and strike at it again.

**PLACE-AFLOAT (a departure).** With Iliac Puddle No More on, PlaceBoatAtRayHit's terrain arm placed her on any water
TILE - a town's harbour basin stands at its ground's height, over the line, and she lay beached from her first frame.
Such a tile is refused with a word (PLACE_RAISED_TEXT, "This water stands above the sea - place her on the open
water."), no boat placed, the deed kept; at the sea's own height she is placed; the mod off, the tile alone decides.

**Said, not fixed.** A Carrack under the Classic Ship handling makes no way at all - the mod's own hull has no Cargo
modifier and divides by it (CSA-D, kept; HELM-WAY's Responsive helm, the default, gives her a hold). A boat saved where
the sea was lifted settles nowhere of itself: the pixel built again under her, BEACH-READ reads her afloat.

## ROCK-FREE audited (3-6)

**Reproduced first** (`test/systems/comeSailAway/fb1002b_rocks.test.js`: the real `Collider`, world.js's own `csaSphereCastAll` lifted, the
runtime over the vendored hulls; a Small Ship under sail). A 2 m boulder 4.2 m off her line mid-sweep answered nothing;
a shelf under her keel and a rock ahead built as ONE model took her 15.5 m into the rock; a rock along her starboard side
and one off her port bow took her 15.9 m into the second; a boat's hull unmoved since its bake (its turn null) closing
round her sweep's centre answered nothing.

**The fix.** `player/collider.js` `hullSweepAll` sweeps the sphere itself against every triangle the swept box reaches
(`sweepSphereTriangle`: an overlap where it starts at travel 0; else the face, its three edges as infinite lines kept on
the segment, its three corners - the earliest), each part's first contact its answer, an overlap's at the part's nearest
point to her centre. Nothing wholly under `keelY` is met; a static part holding her centre answers nothing, a mover's
never holds; the buckets in `skip` are not asked. The host hands on `opts.keelY` and passes her own buckets
(`scenes/world.js` `csaSphereCastAll`, the "beneath" rule gone), and marks an overlap `start`. CheckCollision
(`systems/comeSailAway/comeSailAway.js`) hands her keel line - her collider's box's foot under its centre, steady through the swell
where the box's lowest corner dips a metre - and herself; refuses `start` in the second sweep as it refuses the zero
point; and takes an overlap's push from her sweep's centre, so one straight under it, with no side, pushes nothing
(from her root, 2.2 m ahead of that centre, it pushed her on and refused her helm to starboard). `raycastHit`'s `pass`
went with the spokes. After: the boulder is met at the swept sphere's own travel, to the micrometre, as every one of
300 boxes and 400 single triangles (either winding) are against a closest-point bisection; the one-model rock holds her
off frame for frame as the rock alone; the side rock leaves her at most a frame's way into the one ahead.

## ROCK-REACH: each sweep reaches her own end (7)

**Reproduced first** (the same rig). Two rocks clear astern of her stern and one 6 m clear of her bow: the push answers
the CollisionVector, their sum, which leaned forward - she kept her way and sailed 217 m on, through the rock ahead
(4 m into it with a stronger wind). A rock half a hull clear of her bow refused her helm.

**Why.** CheckCollision sweeps from her collider's centre a whole length (the ends' spheres' span) each way: half a hull
past each end. Every rock there pushed her, refused her turns, and summed with the rest.

**The fix (a departure).** Each sweep reaches her own end (`vMagnitude(val)`, the C#'s `val4` halved). After: the three
rocks hold her off the one ahead exactly as it alone does; a rock clear of her refuses nothing. A per-contact response
was tried and left: with the sweep's reach, a rock at either end froze her for good - the stuck ship Mac reported.

## CREW-SAY audited (8)

**Reproduced first** (`test/systems/naval/fb1002b_crewsay.test.js`: the real crew life over five minutes, the HUD's layout and DOM).
Two pairs at one old yarn were laid as one bubble by no name (147 frame-groups in ten calm minutes); from the deck in
battle at scale 2 a bubble jumped 247 px in a frame as two hands' distances crossed; on a 960x540 screen at scale 2,
62 bubbles stood wholly off its top, 1,071 partly.

**The fix.** `ui/naval/navalHud.js` `layoutCrewLines`: only a line SUNG or SHOUTED by many is laid once; talk is keyed by its
speaker (`who`, world.js's per-hand key). With a memory (`crewSayMemory`, `drawCrewLines`' own) a stack stands in the
order its lines were first said - the nearest first among one frame's - and a bubble comes DOWN at CREW_SAY_EASE (160)
px a second, held where it stands while an older bubble bars its way, UP at once; a lifted bubble whose top would
stand over the screen's top is not drawn (one at its own head is). world.js hands the frame's dt (nought at a pause).
After, the same five-minute runs: no two bubbles meet; jumps of 10 px times the scale or more fell from 25-135 a run
to 4-22, each a stack re-formed as heads crossed; no lifted bubble off the top. The width estimate was measured against
Pixelify Sans' own advances and never under-reads (no real overlap in 12,000 frames); the ♪ falls to the stack's
monospace, accounted for.

## The pins and the mutants

`test/systems/comeSailAway/fb1002b_rocks.test.js` (8), `test/world/terrain/fb1002b_sealevel.test.js` (3), `test/systems/naval/fb1002b_crewsay.test.js` (3), each red on
e2466e2bd. `tools/mutants/fb1002b_rocks.json` (26), `fb1002b_sealevel.json` (8), `fb1002b_crewsay.json` (15) - all dead.
PINS MOVED, each by content: `fb1002_rocks` (its rocks inside her own length, its ledge under her keel, the keel line
for the "beneath" rule, `pass` gone), `fb1002_seaheld` (SEA-SHOAL struck; BEACH-READ's ground put right by the pixel
built again), `fb1002_crewsay` (merged only when sung or shouted), `csa_sailing` (the sweep's length her own end),
`livingcrew` (the heads 500 px down; navalCrewLines' dt), `perfcol1` (two module scratch Sets), `fb1001b_peerboats`
(the host lifted by its name). Records re-aimed by content, all dead: `csa_sailing.json`
CSA-D-collision-not-flattened, `fb1002_crewsay.json`'s seven on the layout and the world's line, `livingcrew.json`
SAY-every-line, SAY-never-hidden and WORLD-words-unwired, `wod2.json` the-lerp-forgets-the-plus-one. Dropped with the
code they aimed at: sixteen of `fb1002_rocks.json` (the spokes, `pass`, the "beneath" rule) and `fb1002_seaheld.json`
SHOAL-carve-unread. Not seen in a browser.
