# AUDIT GALLEON - Mac's galleon read end to end, 2026-10-02

Mac: *"Audit this. It must be perfect"*, of the new galleon as the branch carried it at 886da9b19 - GALLEON (his model
for hull 2, fitted out: doors, hatches and shutters, the wheel, the rig, the guns out of her ports) and GALLEON-2 (his
updated model, every picture 64x64) (`03-World/Come-Sail-Away.md`, `03-World/Naval-Combat.md`; Port-Ledger A). Six
lenses read it against its own pages and against the mod's own galleon on the real runtime - the bake, the rig and her
pictures, her prefab and loader, her deck and crew, her guns, the tests that pin it all - with the head frozen.

Every finding below was re-run on its probe before it was fixed, and pinned by a test that fails on the code as it
stood: `test/tooling/auditgalleon_bake.test.js` (11), `auditgalleon_rig` (11), `auditgalleon_prefab` (18), `auditgalleon_deck`
(14), `auditgalleon_guns` (11) and `auditgalleon_sea` (5) - 70 pins. Mutation-proven:
`tools/mutants/auditgalleon_*.json`, 211 records, 210 dead and one recorded equivalent (G5's node between her root and
her MeshObject, at identity on every hull). Each fix in code carries an `AUDIT GN-<id>` comment (AUDIT GALLEON-2: P13's are tagged GN-NITS and GN-CROWSNEST; D6, P11, T5 and T7-T11 changed records, not code). Four fixers worked in parallel
on files of their own (the bake; the rig; the deck and crew; the prefab) and the lead took the guns, the sea and the
record; their branches were merged here.

## Fixed

### The guns

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 | Major | **The port side's shutters swung into her.** The shutter clip writes the node's whole turn, so the port lids' rest yaw of 180 went at the first frame: five boards stood shut set into her planking and swung open 1.6 m into her gun deck, over her guns. | Each side its own mesh (the port side's the starboard's mirrored) and its own clip (`galleon2/GunportPort`, swinging up outboard to port) - no node turn for a clip to write over. |
| G2 | Major | **A quick click fired through shut ports.** A release within about 1.2 s of starting to aim fired the broadside from guns still run in (0.7-1.0 m inside the port mouth) through shutters at 0-28 deg. | `fired` stands the gun out at its shot and snaps its shutter open (`Animator.Play` - a CrossFade to the state a transition already heads for is no change, as in Unity, so the port gained Play to cut it short). |
| G3 | Major | **Another player's galleon fired through shut ports.** Her lay never reached the other screens: her guns stood in and her shutters shut until each ball left. | My laid broadsides ride my word as `g` (a bit a side, SIDE_CODES' order; an older build ignores it); another player's galleon is laid from hers while her word is fresh (PEER_LAY_S, past FOES_FULL_MS); and G2's snap covers a word without it. |
| G4 | Minor | **Hull 2 fallen back kept the new galleon's numbers.** When her model will not load hull 2 is the mod's own galleon, but HULL_BUILDS[2] stayed hers: the guns fired from 0.24-1.29 m inside the old planking, berths and fires stood 2 m off. | `MOD_SMALL_SHIP_BUILD`, the mod's own Small Ship's build, answered for hull 2 while the pool says the new galleon does not stand (`setGalleonStanding`). |
| G5 | Minor | **Her balls left her upright root, not her ports.** At 8 deg of roll a ball stood 0.89 m off its port, under the sill on the high side. | Each muzzle stood through her MeshObject's heel - in the root's own frame, on the root as she fires: the fix's first cut read her drawn world matrix, a frame behind a captain's ship (a ball 2.26 m aft of its port in a half-second frame), and the cutter's duels with the sloop went six to two against the odds; found by the F25 duels and pinned. |
| G6 | Minor | **Her draft was the old guess.** The routing table drew hull 2 at 2.2 m over a keel 4.64 m down. | `NAVAL_DRAFT` 4.7 (AUDIT GALLEON-2 GN1/PF6: it froze every hull-2 ship at her berth, the berths sounded for the Carrack; the table is `shipLife.js` `draftOf` now, hull 2's read off the galleon that stands, and berths sounded for the deepest keel that berths). |
| G7 | Nit | **The gun deck clamped a long frame.** A 0.5 s frame (Come Sail Away's time scale) ran the guns 0.25 s: a captain's volley came with them 0.35 m short of the port. | The step is the clock's own. |
| G8 | Nit | **My look laid a battery that was reloading.** Its guns stood run out through a 9 s reload. | Laid only while `ready`. |
| G9 | Nit | **Her rig's boxes put her fore course over her roof** - all of it hangs under it, its clews in no box, and the jib's foot forward of her stem in none (about 7.5 m2 balls passed untouched), while the jib's box covered air. | R5 (her rig, below); the bible's description made true. |
| G10 | Nit | **What five guns moved, undocumented.** | `03-World/Naval-Combat.md` gives the AI's flips with their odds, measured at the merge-base and the head: a wary brig no longer takes a merchant carrack (1.10, was 1.32), so from level 5 her plunders are the merchant galleon alone; a wary corsair galley takes a merchant galleon (1.29, was 1.08), so from level 7 the 18% of plunders that draw her launch; a war galley outguns a brig (1.06, was 0.89): the brig runs, their duels seven to one (five to three); a crewed Large Galley of the player's outguns a wary brig (1.06); a crewless Carrack is her prize under 57% (63.5%); F25's own paragraph's odds. Patch notes' Balance. |
| G11 | Nit | **Stale comments.** | navalShips.js's header names hull 2's muzzles as hers; the gun deck's header true for both sides and other players. |

### The tests

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | Major | **F34's leash cases stood on one piece.** With her castle and flights joined into piece 0, every case stayed on it, and four records survived. | A great-cabin case (piece 1 under the castle). |
| T2 | Major | **Pins hollowed by the new hulls.** SHIP-LIFE A STALL's other-side and arrival laws went unreached (the new galleon's first detour clears its hulk); AUDIT NAV2's F62, F35, F48 and F41 (the castle roof a deck now, the Carrack's forecastle joined, a first leg's stray, a talk's stop on a man) each survived its own record. | The stall's other side and the arrival's eased sail pinned on their own (`auditgalleon_sea` T2), the records re-aimed at them; F62 on twelve hands, F35 on a plain deck, F48 and F41 re-pinned on scenarios the hulls reach, their records dead again. |
| T3 | Minor | **F21's bend went unpinned.** Its one kill was the F25 duels' by chance. | Past her range, reloading, she brings a runner at 0.45 of her pace inside her range within 20 s (a brig, a cutter, a sloop; three winds); the flat bend never does. |
| T4 | Minor | **Three runtime changes unpinned.** (a) a boarding's musters on her main level; (b) the pool's registration of her pictures and her glass's glow; (c) each of the four guards of a boarding's last leg. | All three pinned (`auditgalleon_deck` T4, `auditgalleon_sea`), (c) through a test seam (`__boardCourse`). |
| T5 | Minor | **Her sternway head to wind was unstated.** Under the defaults she goes astern 4.05 m/s in a 1.5 m/s wind - her gaff and jib aback (the square-sail assist stows her squares) - 46% of her 8.75 m/s full way; the mod's galleon lay at 0. | Stated in the patch notes and the bible; damping her fore-and-aft canvas aback would be a departure of the port's own - Mac's call. |
| T6 | Nit | **Stale in-irons text.** | Come-Sail-Away.md, Controls.md, comeSailAway.js and the helm test say her way AHEAD (sternway counts), the galleon's 6.4 s off the wind's eye, her gaff and staysail aback. |
| T7 | Nit | **"No sound boat" was false.** A Rowboat has no gun: any pirate's prize. | "No sound armed boat". |
| T8 | Nit | **Naval-Combat.md's F25 outcomes and deck counts, stale.** | Re-measured: the odds (G10), the decks after D-wall (Mac's galleon 838, her main deck 664; the Carrack 511; the Galley 4016). |
| T9 | Nit | **Testing.md rows for moved tests.** | nav_a_guns' five guns; navaudit_guns' Carrack; seapeace's hurt Small Ship. |
| T10 | Nit | **GALLEON's text superseded by GALLEON-2.** | Port-Ledger, Active-Arcs, Come-Sail-Away.md and Testing.md say the second export, twenty-three pictures, the scene's other stations. |
| T11 | Nit | **"(the rest as above)".** | The new galleon's own figures: 7.92 s to 95% of her way (27.72 s classic), struck to 2.5 m/s in 10.42 s (31.25), 40 deg off the wind's eye in 6.37 s (classic: about 30 deg in a minute, no way on). |

### The bake

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Major | **Her sides were cut unlike each other, and unlike Blender.** Mac's side n-gons are not flat (up to 0.55 m out of plane where he drew the bow in), so the cut decides her shape and her shading - and the bake's ear clip (axis-drop, lowest index first) laid a 22 m wedge 65 deg off its face on her starboard side alone (a dark crease), the two sides 0.49 m apart. | `tools/fbxMesh.mjs blenderTessellate`: a float32 port of mesh_tessellate's projection and BLI_polyfill_calc (clip-even, sweep, the convex and tangential ear passes, the kd-tree point test, desperate mode; the quad flip; as Blender 5.1 holds it - its precomputed point test and its own kd-tree, AUDIT GALLEON-2 BK1: the first port was 5.0's, and cut her #2 and #34 otherwise) on the mesh's own corners in their own order, every polygon's cut refused by object and polygon unless it tiles the face exactly; the bake's own fills (`polyfill`, `slabFill`, `fillInside`) gone. Her sides 3.3 cm apart now. Her faces lit flat on their polygon's own normal, as Blender draws them (B1 lighting, below). |
| B2 | Minor | **A fin folded under her port stern quarter** - three faces of polygon 8 against its normal. | Gone with B1; the bake refuses a triangle wound against its face. |
| B3 | Minor | **The bake made points of its own.** `slabFill`'s 21 duplicate vertices, a zero-area triangle and a T-junction on the edge #76 shares with #77. | No vertex but the source's corners (hull 190 -> 168); eleven zero-area triangles remain, Blender 5.1.1's own (AUDIT GALLEON-2 BK1: the first port was 5.0's fill, and laid thirteen) on corners Mac drew on one line (the drawing drops them). |
| B4 | Nit | **The bake's comments called its fill Blender's.** | Rewritten for the port of Blender's tessellation. |
| B5 | Minor | **A re-export could bake wrong without a word.** | Refused by name: a mirroring transform, an unread rotation or scaling offset, an export's other axes, a part 2 cm out of the scene box it was read in. |
| B6 | Nit | **Her centreline was 38 µm to starboard.** | The hull object's own scene Y, 36.24673828125, refused otherwise; the exporter's -90.0000093 snapped to the quarter turn it is (`quarterTurn`, under 2.8 µm anywhere), so 283 mirror vertices on 20 parts bake to the same |x|. |
| B7 | Nit | **The bake's header and the bible said what it no longer did.** | The header, the JSON's `split` (332 of 401 polygons cut) and the bible's two model paragraphs made true. |

### Her rig

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R1 | Major | **A set square sail's head stood off its yard** - 0.77 m on the course, 0.6 on the topsails, the belly at its head row; furled rolls 11-17 cm under their yards. | The belly from nothing at the head (`sin(0.8 pi v)`), the head row 2 cm off its yard along its taper, the roll seated on the yard. |
| R2 | Major | **The jib was set through the fore topsail and its yard, the forestay through the yard.** | The fore topsail's yard down to 16.0, the forestay from the fore masthead's fore corner (0.63 m over the yard), the jib's head 0.29 m over it and its clew forward (z 19.6): 0.17 m clear in the auto-trim's range. |
| R3 | Major | **The main stay ran through the set main topsail and cut its yard.** | Led from the main masthead under the nest to the fore mast's after face; the topsails' belly half the course's. |
| R4 | Minor | **Trimmed, every sail met rope** - the auto-trim's 30 deg put the course and its yard into the fore shrouds. | The shrouds' feet aft and closer, the braces and sheets re-led: inside the auto-trim's range nothing meets anything (32 pairs before), the least clearance 5 cm; the manual trim's extremes still cross in 19 named places (48 before), the gaff's sweep over the main shrouds the most - the mod's trim limits stand. |
| R5 | Minor | **Her rig's hit boxes stood still while her canvas swung** (with G9: 22-30 of 74 points of a topsail outside every box at 30 deg; the course under her roof, its clews and the jib's foot in no box). | A box on each boom, turned with it about the mast (`rigBoxesOf`), three askew along the jib: of 517,720 points of set canvas at every trim and wind, none outside a box (261,913 before), each box three quarters canvas; `rigBand` from her roof. |
| R6 | Minor | **The mainsheet ran into the castle's front wall.** | Belayed on her main deck at the castle's foot; nothing through the castle at any gaff angle. Its boom-end ring stands 34-85 deg off the rope (a two-bone rope to a fixed belay off the boom's axis cannot square it). |
| R7 | Minor | **Ropes ended in mid-air** - lifts over the masthead, the topsail lifts through the nest's floor, sheets and backstays off their rails. | 47 rope ends, none off its solid (15 before). |
| R9 | Nit | **The bobstay ran 1.10 m inside the bowsprit.** | From its underside to her stem. |
| R10 | Nit | **Small fit misses** - channels 3.1-3.5 cm off her side, chainplates hanging 0.33-0.40 m off her planking, 244 of 408 ratline ends off their shroud, the booms 6.5-6.9 cm off their masts' axes, a dead constant. | All on their solids; the masts' axes read off the bake (z -0.191, 8.772). The port main channel re-fitted at the merge to the re-cut hull (the old cut stood her port side 2.7 cm out). |
| R13 | Nit | **The canvas picture was upside down on the gaff and the jib.** | Every grid head row first. |
| R15 | Nit | **The rig's comments.** | Made true (a bone a grid point, six clips, one course). Her jib's 14 zero-area triangles at rest gone. |

### Her deck and crew

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Major | **The leash dropped boarders off her port flight into the great cabin.** It took the nearest live floor at any height from any piece: the deck grid's port well wall fell 3 mm inside a cell that held the cabin's node - 192 of 1275 points on the port flight's treads put a body on the cabin floor 3 m down; 364 of 5705 cabin points lifted one onto a tread. | A body's floor is its own piece's, from any height, else that piece's edge - never another piece's floor more than a step off: 0 and 0. |
| D2 | Minor | **Rail spots and the player's landing ignored her main level.** Raised rail spots stood on the port flight's treads and the castle roof (250 of 892), and a landing from her side came down on a tread or the roof (96 of 328); the Carrack's on her forecastle. | Her main deck's rail and a landing on her main level, across from where it came from: 0 and 0 on both hulls. |
| D3 | Minor | **A player on his own lower deck read as ashore.** Below the main level `under` read the feet's own 0.5 m cell: 891 of the galleon's 25197 standable points (the gun deck, the guns' tops, the masts' steps), the Carrack's 638, the Large Galley's 5436 - no Sail ho!, rest and journeys open. | The capsule's own reach below a step under her main deck: the galleon's 0, the Carrack's 8, the Galley's 1638 (all at her rowers' 6.4 m). |
| D4 | Minor | **The Carrack's lookout stood his watch on her forecastle**, 1462 s of every 1740 - her bow read over all her levels. | Her main deck's bow; he waits his turn when a hand is there. |
| D5 | Minor | **keepFlights could keep a way its piecing would not join** (a diagonal step; latent on every real hull). | Side steps only. |
| D6 | Minor | **Hull 2 fallen back kept the new galleon's numbers.** | G4. |
| D7 | Minor | **Her hatchways stayed deck with their covers open** - 44 cells at 6.378 over the holes; 208 of 552 crew walks crossed one, and the leash put a body that went down one back up. | A part that opens and shuts is no floor (`moves`): the galleon's 0 cells and 0 walks over them, the Carrack's 80 and 301 to 0; the crew's hatch post beside the fore hatchway. |
| D8 | Nit | **A downward face could be a flight's tread.** | Only up-facing faces. |
| D9 | Nit | **`spots` filtered and allocated before its cache** (130-170 µs a cached call). | The cache first: 0.1 µs. |
| D10 | Nit | **The deck's claims; idle hands up the flights** (332 s of 1740 off her main deck). | Decided a defect against crewLife's own law and fixed: an idle hand goes back down, a talk's place is on the main deck (212 s, the officers' talks); the claims made true. |
| D-wall | Major | **Her deck hung on how a face was cut.** A wall marked every cell its edges crossed with its whole triangle's height: Blender's cut of her castle front (B1) walled her port flight's tread at 8.28 under a face 6.87 m high there, and her castle roof and upper flight - 168 cells - were lost. | Each wall clipped to each cell, its own height there: the same deck over either cut (838 cells - her main deck 664, her castle 174 - one cell further out at her entry ports, where her side stands under her deck). Every hull diffed cell for cell, each move justified: the Carrack's main deck runs under her half-deck stairs and into the room under her forecastle (511), the Galley's tent 4016, the mod's galleon 750. What the exact walls laid bare, fixed with it: a floor to stand aboard on faces up (her bottom's underside read 1.03% of the points round her hull aboard; now none), the open deck one walk on every hull, a landing across from the boarder (LIVING CREW's), a talk's place never on a third man. The bake 0.6-3.5 ms dearer a hull. |

### Her prefab and her pictures

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | Major | **The helmsman stood in the great cabin.** Come Sail Away pins the capsule's centre to DrivePosition (every mod hull stands it 0.70-1.38 m over its deck); hers stood on the roof, so his feet were 0.9 m under it and his eye under the wheel's hub - 28 of 28 sight lines to her bow blocked. | DrivePosition half a capsule over the roof (11.918), his eye at 12.718; the wheel (hub 0.72 m up, tips 0.66) and binnacle (hood 1.30) lowered under the lowest line: none of the 28 blocked at any turn (the mod's galleon blocks none either). Let go, he stands on her roof. |
| P2 | Major | **Manropes stood up through the shut hatch covers**, 0.69 m high, and in the companions' colliders. | Each made fast to the hatchway's side 2 cm under the cover's foot. |
| P3 | Major | **The weighed anchor stood in her bow** - 205 of its 312 vertices inside her outer planking, 62 in her open interior; the let-go cable 83 of 106. | Both turned along her bow's 31 deg flare and stood outside her: none inside, the nearest 2 cm off. |
| P4 | Minor | **The board triggers reached into her gun deck**, 0.4-2 cm, and filled a port's throat: a look from inside stood the player on her main deck. | Their inner face on her outer planking (x 7.4): none of 13,500 looks from her gun deck meets one with her shutters shut. |
| P5 | Minor | **The stern lantern poles stood buried in her rail.** | On the rail's cap, their lanterns 0.84 m over it. |
| P6 | Minor | **The shut shutters stood off her side** - 2-12 cm, 47 cm at port 4's lower fore corner. | Each port's own fit (`LID_FIT`, measured off the bake by `tools/galleonLidFit.mjs`), hinged on her side at the lintel and bent at the knuckle: the worst edge gap 1.19 cm; her planking bites 2.29 cm into port 4's board at one corner, under a crease of the bake's own cut (pinned at 2.5 cm). |
| P7 | Minor | **Her stair wells and the cabin's casings wore the castle's outer livery.** | Her inner planking, face by face; the dead rule gone. |
| P8 | Minor | **The rudder pivoted 0.62 m inside her stern** and at 35 deg swung 0.355 m through her planking, its front open. | Cut at her sternpost and pivoted on it, closed in front: 1.18 cm clear at 35 deg. |
| P9 | Minor | **An open hatch cover stood in the gaff's sweep** (at -105, 2.5 m up). | Opened flat onto the deck (-178): the gaff 1.85 m clear, its canvas 1.45, every rope 0.2. |
| P10 | Minor | **A crouching body crawled out of a shut port.** | Each shutter a collider of its own plates, turning with it; none of its faces near level, so her deck bakes the same. |
| P11 | Minor | **Hull 2 fallen back kept her numbers.** | G4. |
| P12 | Minor | **The bed was sunk 0.262 m into the cabin floor.** | At the mod galleon's own 0.262 over the deck. |
| P13 | Nit | **The stove's pipe ended in mid-air; sky showed round the masthead through the crow's nest; MEASURED's unpinned values; false comments.** | The flue carried to 0.136 m under her deckhead (the mod's own gap); the masthead capped and the nest's floor given its underside; every MEASURED value pinned to the bake to 1 mm (gunDeckY 1.0829); the comments made true. |
| R8, R11 | Minor | **The ports' throats wore the shutter's picture** (17.5% iron straps), while record 16 was worn by nothing. | Record 16 repainted as seamless oxblood planks, worn by the throats alone at [2, 2]. |
| R12 | Nit | **The texel claims.** | Measured and made true. |
| R14 | Nit | **28 T-junctions at her ports and wells** where banded faces met unbanded ones. | Every face of a banded part cut at its slices: none on hull, castle, rail or parapet. |
| B1 (lighting) | Major | **A non-planar polygon's triangles shaded as creases.** | Each lit by its polygon's own normal: 38 of 401 polygons lie more than 1 cm out of plane, the worst 0.40 m. |


## Checked and sound

- **The walk.** Every name the mod's C# walk reads stands in her tree with its counts; her five sails classify three
  square, two small, two large, one gaff and one stay; every door and hatch carries its collider, Animator and
  DoorTrigger; the loader falls back with one warning and the build ships her model.
- **Her art.** Twenty-three records, each 64 x 64 and opaque, the same bytes in every process; the glow is her glass
  exactly; a loose `38131_<record>-0.png` overrides its record.
- **Her guns' paths.** Out and open, every ball clears her hull, lids and guns over the carriage's whole lay; the
  chasers clear her bowsprit, stays and anchor; the barrels drop clear of her rudder.
- **Her helm.** All ten Sailing clips at their thresholds, the wheel continuous about its axle, the rudder linear to 35
  deg; the Classic helm is the mod's.
- **The cost.** The gun deck 34 us a frame for eight galleons and eight carracks; her pictures 48 ms at the preload (AUDIT GALLEON-2 PF3: until then spent at her first draw; at the preload now, 74-132 ms, and her prefab built 100-230 ms once a process, PF4); her
  deck's exact walls 0.6-3.5 ms more a hull, once.

## Decisions

- **Her sternway (T5)**: as Come Sail Away's GetSailPower makes it - 4.05 m/s astern head to wind under the default
  assist - stated in the notes and the bible, not damped. Damping her fore-and-aft canvas aback would be a departure of
  the port's own: Mac's call.
- **Her glow under a pack (R15)**: a pack's picture over her stern windows glows by her own glass, as a pack's over a
  town's window glows by the classic picture's (`scenes/dataPipeline.js`'s window arm) - the port's one rule.
- **The exporter's quarter turns (B6)**: the hull's -90.0000093 is read as the -90 it is (`quarterTurn`, within 1 urad),
  so her mirror pairs bake mirrored; nothing moves more than 2.8 um.
- **Blender's own zero-area triangles (B3)**: eleven (Blender 5.1.1's - AUDIT GALLEON-2 BK1; thirteen under the first port's 5.0 fill), on corners Mac drew on one line (gunport sills and lintels, the
  port inner planking's fold) - kept, as Blender cuts them; the drawing drops them.
- **Her bed (P12)**: the mod's galleon's 0.262 over the deck (its trireme's 0.261) - the classic model's own bounds are
  not in the repo to check.
- **Idle hands (D10)**: up the flights 332 s of 1740 was against crewLife's own law - fixed, not recorded.

## Not fixed

- **Her rig at the manual trim's extremes**: 19 crossings, each named in `auditgalleon_rig`'s PAST_AUTO - the gaff swung
  45-90 deg through the main shrouds' sector (13 cm at most), the main topsail with the gaff and its halyard at 60-90;
  inside the auto-trim's 30 deg, none. The mod's trim limits stand. The mainsheet's ring at the boom's end stands 34-85
  deg off its rope (a two-bone rope to a belay off the boom's axis cannot square it).
- **Mac's mesh**: five hull faces stand apart from their mirrors where Blender cuts them on other diagonals (the stern
  quarter's 0.37 m at most) - as his scene shows them; the eleven zero-area triangles (AUDIT GALLEON-2 BK1); fifteen sub-millimetre
  asymmetries. Each is his to make planar or dissolve in Blender.
- **A board trigger through an open port**: from her gun deck a look out of an open port reaches the trigger alongside
  (1.30 m at the nearest) and stands the player on her main deck, as BoardBoat does anyone who presses it; out of that
  reach it would be out of a boat's alongside.
- **Port 4's shutter**: her planking bites 2.29 cm into its board at one corner, over a crease of the bake's own cut of
  her non-planar 24-gon (pinned at 2.5 cm).
- **The deck**: `path` walks one floor a cell, so most of the room under the Carrack's forecastle is the leash's, not a
  walk's; her lookout's post stands just inside the forecastle's edge (3.06 m clear); her crews may stand under her
  half-deck stairs; `nearest` and `clamp` keep the nearest cell of all (the landing alone comes across); the Large
  Galley reads 0.72% of her lower standable points ashore and 1.48% of the points round her hull aboard; a rail spot may
  stand on a flight's 0.29 m bottom tread.

## PIN MOVED

`nav_g_online` (the record's `laid`), `shiplife` A STALL (its other side pinned on its own), `galleon_model` HER HELM
(P1: half a capsule over the roof) and HER RIG (R5: each box reaching out of her hull's box, her canvas read in her mesh
object's frame), `auditgalleon_guns` G1 (P6: each shut board against her own side, port 4's foot falling in to 5.390),
`navaudit_guns` G12, `navaudit_helm` H4 and `navaudit_presentation`'s planks (R5: the roof rule every hull's but hers,
the crosshair on her main topsail's box, the ball through her canvas), `auditnav2_deck` F32, DECK-WALK THE REAL HULLS
and THE BAKES (D-wall's counts), `auditnav2_crew` F62, F35, F48 and F41, `auditnav2_deck` F34 (T1's cabin) and
`auditwatchkit_crew` WK-W8 (a window measured 1.30 and 1.55 s); at the merge with main, its own FIELD BUGS 2026-10-02
rock pins (`fb1002_rocks` ROCK-AWAY's rocks and the ledge, `fb1002b_rocks` HER KEEL) set by Mac's galleon's own box -
her ends 21.93 and -19.91, her keel 4.64 m down, where the mod's galleon's stood 19.88, -24.25 and 3.35 - each marked in
its own line with its law intact. Other lists' records re-aimed by content at the new text, all dead.

Not verified in a browser.
