# AUDIT GALLEON-2 - the galleon read a second time, 2026-10-03

Mac: *"I want you to audit it"*, of the new galleon's branch (`ccr-eaf1b600-dqmxn1`, GALLEON, GALLEON-2 and AUDIT
GALLEON - `Audit-Galleon.md`) as it stood at 21:55 on 2026-10-02, with main merged in (#542-#544, among them #543's
PUPPET-GLIDE and SHIP-CLUTTER; the merge 57baee705, the suite green on it, 18626 of 18626). The first audit was
thorough - 70 pins, 211 mutants - so this one read for what it missed: six read-only lenses (the bake; her prefab,
pictures and loader; her rig; her deck and crew on EVERY hull; her guns, the sea and online, and how they compose with
#543; the tests and records), each finding reproduced on a probe before it was reported, every Major re-run by the
lead. 54 findings. Six fixers, each on files of its own in its own worktree, each pin red on the code as it stood;
their branches merged here. Each fix carries an `AUDIT GN2-<id>` comment.

The worst of it was not the galleon's own: three of the first audit's fixes broke things elsewhere. G6's 4.7 m draft
froze every hull-2 ship at every harbour berth; D-wall brought D1's level-jumping leash back on the Carrack and the
fallback hull; D7 turned the Carrack's shut cargo doors into a hole. And G2's shutter snap held in the test's frame
order, not the game's.

GALLEON-2 pins: `test/tooling/auditgalleon2_bake.test.js` (9), `auditgalleon2_prefab` (11), `auditgalleon2_rig` (4),
`auditgalleon2_deck` (6), `auditgalleon2_sea` (7), `auditgalleon2_guns` (8), and pins added to
`auditgalleon_rig` (RG7), `auditnav2_captains` (TS4) and `auditgalleon_guns` (G2, G3 and G5 strengthened).

## Fixed

### The harbour, the sea and the AI's sums

| ID | Sev | Finding | Fix |
|---|---|---|---|
| GN1 | Major | **Every hull-2 ship at a berth froze there (G6 incomplete).** SHIP-LIFE sounds a port's berths for the Carrack (3.2 m); G6 drew hull 2 at 4.7 m. Off Iliac Puddle No More's carved shelf (on by default) 4.7 m lies about 41 m out and the berths 16 m: 240 of 240 berths were land to her, and no way in from the mouth (0 of 120). On the real host, 240 s after their dwells, the merchant galleon and both navy cutters stood 0.0 m from their berths with no errand, where the old draft had them 150-364 m out on voyage and patrol. | `shipLife.js findHarbour` sounds each berth for the Carrack's footprint in the water of the deepest keel that berths (`BERTH_HULLS`, `deepestBerther`): 120 of 120 berths float, depart and arrive every hull; the hull-2 ships 113-520 m out after 240 s. Berths off a carved shelf now lie 40-52 m off the shore (16-28 before); fallen back to the mod's galleon, 16-40. Measured against tiered berths (the small hulls kept near the quay, a deep tier for hers): the same floats, at the cost of hull-aware berth choice in five places and the harbour roll - one sounding rule chosen. |
| PF6 | Nit | **Hull 2's draft did not switch with her (G4 incomplete)** - a fixed 4.7 kept the fallen-back galleon (keel 3.35) out of 3.4-4.7 m water she can sail. | The table moved to `shipLife.js` (`HULL_DRAFT`, `draftOf`): hull 2's draft `DRAFT_SPARE - hullBuild(2).keel`, read when asked - 4.70 for her, 3.41 fallen back. world.js's `NAVAL_DRAFT` gone. |
| PF2 | Minor | **The captains' sums kept hull 2's numbers across the switch (G4 incomplete).** LAY_MIN and HIT_SHARE are cached by hull number, and the comment said the builds were frozen: reckoned with her standing then fallen back, a fallen-back galleon kept her 11 m starboard dead zone on a sloop where her own is 26 (AUDIT NAV2 F24's fault back). | `setGalleonStanding` stamps the builds (`buildsStamp`); navalAI empties both caches when the stamp moves. No odds move while she stands. |
| RG3 | Minor | **Her rig's boxes tore canvas that was not there** - furled (all five stowed: still 7 boxes, a ball 1.73 m under a furled roll a hit) or shot away. | Each of her boxes names its sail; `rigBoxesOf` skips a box whose sail is hidden or stowed (all furled: 0 boxes). The mod's hulls' static boxes unchanged. |
| RG4 | Minor | **"Her highest sails gone first" was false for her** - the loss order read each sail NODE's height, and her jib's node stands at her origin, her gaff's at the boom's foot: at 0.4 of her canvas she lost her course, her lowest. | Sorted by the canvas's own height where a sail has a grid of bones (`canvasHeight`): main topsail, fore topsail, jib, gaff, fore course. The sloop's, galley's and Carrack's orders unchanged. |
| RG6 | Nit | **A sea ship's gaff and jib always bellied to starboard** (pre-existing, every hull - the posing's Wind never went negative). | Signed as Come Sail Away's `sailWind` signs them (`sailSide`): gaff, jib and lateen to the side the wind blows them. |
| TS4 | Major | **The galleon left a survivor in a recorded list**: AUDIT NAV2 F24's station-in-the-dead-zones record had died on main only through F25's duels, which her five guns no longer flip. | F24's own pin: with every gun reloading a galley opens the range inside her bow guns' dead zone on a low hull and closes it outside; the record dies by it. |
| DK5 | Nit | navalHost's D3 comment gave the Large Galley's 3829. | 5436, as measured. |

### Her guns and her online side

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PF1 | Minor | **G2 held in the test's frame order, not the game's.** world.js steps a boat's Animators (Come Sail Away's lateUpdate) before the sea's frame fires, so the shutter's Play queued at the shot landed a frame late: on a quick click each ball left a gun run out through a shutter at 0.0, 5.2, 11.9, 20.3 and 27.4 deg - G2's own fault, for one frame. | The shutter posed at once (`Animator.update(0)` after the Play); G2 and G3 re-pinned in world.js's order. |
| GN2 | Major | **Another player's galleon froze laid on my screen once she left her helm (G3 incomplete).** The gun deck stepped another player's boats from her helm list alone; her boat moored in my world dropped out of it and was never stepped again: her guns out mid-recoil and her shutters up until she took the helm again. | The gun deck steps every boat it laid or fired until it is at rest, in the helm list or not. |
| GN3 | Minor | **Her lay lapsed under a time scale.** PEER_LAY_S ran on the scaled sea clock while an unchanged word comes every 2 s of real time: at x5 a peer's laid battery flickered shut 195 of 360 frames. | Held on the real clock (the step over the time scale). |
| GN4 | Minor | **Another player's volley left her word's pose, not her drawn ports** - her shutters and guns ride the glided copy (#543's PUPPET-GLIDE), her balls and flash the raw word: under way the flash stood beside the port (median 0.26 m, worst 1.16; a port's half width 0.371). | Flown from her drawn root, set back by her way over the volley's age: each volley's first ball within 0.13 m of its port as drawn (was 0.51), median 0.07 (0.21); the ripple's later balls ride her word's way while the copy glides on hers (the worst 0.37). |
| GN5 | Nit | **The arc switched off left a laid galleon laid.** | The sea's `clear()` (the arc off, a transition) sets every gun deck at rest. |
| GN6 | Nit | navalShips.js said her gun deck at 1.085. | 1.0829, as her model measures it. |
| TS1 | Major | **Her port battery's side was unpinned** - every host test fired to starboard and `read()` answered the gun's distance unsigned: her port guns could stand on her starboard side, barrels inboard, unseen. | Her port battery's signed places pinned run in, run out and kicked back. |
| TS2 | Major | **A galleon at sea's gun deck was unpinned** - dropping a captain's run-out lay, her deck from the step, or a sea ship's kick each survived every test. | Her side laid and her shutters ordered open ahead of her broadside (1.9 s on both ships), each gun kicked back after its ball (to 3.21). Dropping her deck from the step is equivalent since GN2 (a laid ship settles on her own) - recorded so. |
| TS3 | Major | **G5's captain could not tell heel from none** - her heel at a shot (<= 3.66 deg in that duel, about 0.38 m at the muzzle) lay inside the pin's 0.6 m slack. | Heeled 8 deg and held to her heeled muzzle's height. |

### Her deck, on every hull

| ID | Sev | Finding | Fix |
|---|---|---|---|
| DK2 | Major | **D-wall brought D1's fault back on the Carrack and the fallback hull.** D-wall laid cells under piece 0's own higher floors as piece 0, so one piece holds two levels in a cell; the leash took a piece's floor at the body's height of the moment, and set the Carrack's walks 2-3 m between her main deck and forecastle (124 of 32904; 6 of 8 walks across her stair's top treads dropped into the room under it; 185 of 914 standing points under her forecastle lifted through it); the mod's galleon's 43 of 19880. | The leash measures off the floor the body last stood on (`keep`): its piece's floor within FLIGHT_JOIN of it, else that piece's nearest cell at that level, else its edge. None on any hull, never more than 0.57 m sideways; D1's cases at 0. |
| DK1 | Major | **D7 made the Carrack's shut cargo doors a hole** - 4 x 5 m mid her main deck, spawned shut: 600 of 1575 points on them read ashore (no Sail ho!, rest and journeys open), and a boarder at a player there was held 2.48 m off (melee 2.25). | The tops of her opening parts as they stand shut, with the inset's margin, baked beside her deck (`ajar`): standing aboard reads them and the leash lets a body stand on them - never her walk, spots or a landing (D7's walk stands). 0 ashore; the boarder reaches. |
| DK3 | Minor | **No boarder went through any door** - a door's walls are baked shut, so the new galleon's great cabin lay out of every boarder's reach (4.59 m off a player inside), as the Carrack's rooms did. | The floor a door's leaf alone walls joins `ajar`; a body pressed off it goes back to the room it came from. All twelve doorways (hers and the Carrack's five, both ways) passed. Taking the leaves out of the bake was measured and refused: her deck 838 -> 1141 cells, the Carrack's 511 -> 1328, her open deck another piece. Every deck byte-identical. |
| DK4 | Nit | "The mod's galleon's 750 when she stands in" was measured over the new galleon's extent. | 727 (690 before D-wall). |
| TS9 | Nit | A diagonal step over a flight, and `lineOnDeck` ignoring flights, went unpinned. | A flight climbed square; lineOnDeck over a flight. |
| TS5 | Minor | AUDIT WATCHKIT's re-aimed hatch record died by a ReferenceError, not its pin. | Re-aimed; it dies by assertion. |

### Her rig

| ID | Sev | Finding | Fix |
|---|---|---|---|
| RG1 | Major | **Her running rope trailed its spars.** Each brace, course sheet and the mainsheet is a two-bone skinned rope baked on FixDeformations' tenth of a second with one end on a swinging spar: the drawn end stood 0.25 m off at 15 deg/s, 1.69 m at the auto-trim's 100, 4.30 m at 300, 4.99 m through a gybe. | Baked every frame - a `BakeCadence` on her rope renderers (`galleonRig.js` BAKE), read onto the holder by the walk; never while paused, and not again while its bones stand within 1 mm of their last bake. Every drawn end within 1.1 mm of its bone. The mod's holders verbatim. 48 us a frame while her spars move, 10 us otherwise. |
| RG2 | Minor | **A hidden sail's sheets stayed drawn** - the course's ending 4.4 m under its yard at share 0.40, the jib's over her bow at 0. | Each sheet under its own sail; the braces and mainsheet under her hull (their spars stay). |
| RG9 | Nit | **All sixteen of her holders baked on one frame** (277 us every tenth of a second). | Each canvas on its own timer (k/5 of the interval): her worst frame about 107 us swinging, 69 standing. The mod's boats on the C#'s one phase. |
| TS6 | Minor | Her sails' Left/Right poses went unpinned (four mutants: aback/full, port/starboard, the jib's halves). | Pinned against the mod's own Large Square, Large Gaff and Large Staysail through the Animator. |
| RG7 | Nit | PAST_AUTO named a pair that never clashes. | Removed: 19 names, 19 clashing. |
| RG8 | Nit | A comment's main topsail heights. | Its canvas 13.27-17.59 m, its box 13.27-17.82. |

### Her prefab, pictures and loader

| ID | Sev | Finding | Fix |
|---|---|---|---|
| PF3 | Minor | **Her pictures were painted at her first draw, not at load** - archive 38131 first asked by her first mesh or a sail bake: a 100-440 ms stall the first time a hull 2 came into view (the first audit's "48 ms at the preload" was not where it was spent). | The preload asks for her archive and cuts her glass's glow: 74-132 ms there; her first draws' longest stall 40-82 ms (her first sail bakes). |
| PF4 | Minor | **Her model was fetched a fetch late and built again by every world scene** - galleon.json asked only after the mod's five files answered (222 ms), then her prefab built synchronously (100-340 ms) in every loader. | Fetched beside the five (her failure never fails them); built once a process, keyed by her bake's sha256 and the same mod tree (a second world 0.8 ms); a pin that the cached prefab is never written by a boat's life. |
| PF5 | Nit | **In Retro Mode she was the only hull drawn mip-mapped** (her stand-ins uploaded as replacements). | Her archive is classic art to the pipeline (`markClassicArt`): capped as ARENA2's. |
| PF7 | Nit | **Her helm could not be taken from forward of the wheel** - the pedestal's collider stood out of the trigger's metre cube (1 in 6 from 150-210 deg). | The trigger 0.25 m forward of the hub, over wheel and pedestal: every bearing; P1's sight lines kept. |
| PF8 | Nit | **Both doors pivoted mid-leaf** - open, 2 cm into the jamb over their height; the castle leaf's foot 1.4 cm in her deck. | Hinged on the leaf's after face, the castle leaf on her deck: shut and open, nothing of hers crossed. |
| TS7, TS8, TS12 | Minor | "The glow is her glass exactly", built prisms facing out (119 caps) and two shading details went unpinned. | Pinned (the law was right): the glow pixel for pixel; every prism outward with the frustum's volume; a flipped triangle's corners; planarUv never mirrored. |
| TS10 | Nit | T4(b) held only as the first galleon pool in the process. | Independent of order. |
| PF9, BK6 | Nit | A comment named `withGalleon`, which never existed; `MeshBench.merge` had no caller (and turned normals wrongly). | The comment true; `merge` removed. |

### The bake

| ID | Sev | Finding | Fix |
|---|---|---|---|
| BK1 | Minor | **The fill was Blender 5.0's; Mac exported from 5.1.1.** 5.1 changed the fill (a precomputed point test; a kd-tree that tests its own point first and collapses on removal; an index cache), and cuts her hull's #2 and #34 otherwise - at most 1 mm apart, but B3's "thirteen zero-area triangles, Blender's own", two hand-made "Blender" answers in the test and the T-junction count were 5.0's. Compiled from Blender's own source: the port equal to 5.0.1 on all 2310 polygons, 10 differing from 5.1.1. | `tools/fbxMesh.mjs` ports 5.1.1's fill node for node: 0 of 2310 differing from compiled 5.1.1, 0 of 18,000 3D and ~496,000 2D fuzzed faces; eleven zero-area triangles; ten corners on edges; LID_FIT unmoved; re-baked by the tool (galleon.json sha256 fcf49550...). An export from any Blender but 5.1.x is refused by name. |
| BK2, BK3 | Nit | Two comments: coords_sign's rule written backwards; "an ARM build may contract" (5.1.1 builds with -ffp-contract=off everywhere). | True. |
| BK4 | Nit | `--fbx=X` recorded the default source; no `--out`, and the output relative to the working directory. | The source recorded as given; `--out`; from any directory. |
| BK5 | Nit | `round4` rounded half steps up on both signs (a mirror pair on a half step 0.1 mm apart). | Symmetric about zero; nothing in today's bake moves. |

## Decisions

- **Her gaff boom at head height (RG5)**: its underside 1.32-1.62 m over 113 main-deck cells, her course's foot 1.47 m - as the mod's own Large Boat booms stand 1.56-1.64 m over its deck. Kept: Mac's rig, the mod's measure.
- **Berths for the deepest keel (GN1)**: one sounding rule over tiered berths; off a carved shelf a coaster lies in the roads with the galleon.
- **A sea ship's square canvas stays full (RG6)**: signed as `sailWind` would, unbraced yards would lie aback whenever she is close-hauled under way.
- **A pack over archive 38131 (PF5)**: capped in Retro Mode with her own art; no pack knows that archive.
- **The deck does not know a part's state (DK1)**: a cover's open or shut is each boat's Animator; over an open hatchway a body stands within a step of the shut lid, then is set back at the edge (a dip of 0.2 m on hers, 0.4 on the Carrack).

## Not fixed

- **DK6**: 22 points on her starboard castle rail's cap read ashore - the cap lies between two cell centres. Sampling every unsampled up face would read thousands of open-air points aboard on every hull (her 6601, the Carrack's 4863).
- **The chain shot's lay height (`rigBand`)** still assumes set canvas: with RG3, a captain's chain at a furled ship flies where her canvas would hang.
- **The galleon walks ~330 bone nodes a frame** (150-200 us a galleon in the pool's walk) - measured by the rig fixer, outside this audit's fixes.
- **Five older survivors** in the naval lists (NAV-A-the-far-ship-first, NAV1-the-tacks-carry-dropped, NAV1-no-pay-off, NAV1-never-warped, NAV1G-no-bear-free) survive on main too - not the galleon's.

## Corrected in AUDIT GALLEON's record

G6 (the draft table is `shipLife.js` `draftOf` now), B3 and its decision (eleven zero-area triangles, Blender 5.1.1's), B1 (5.1's fill), the cost line (her pictures at the preload is now true: 74-132 ms, and her prefab's build 100-230 ms once a process), and the claim that each fix carries an `AUDIT GN-<id>` comment (P13's are tagged GN-NITS and GN-CROWSNEST; D6, P11, T5 and T7-T11 are records, not code).

## Mutants

`tools/mutants/auditgalleon2_{bake,prefab,rig,deck,sea,guns}.json`: 133 records - 27, 23, 18, 19, 27 and 19 - 132
dead and one recorded equivalent (the guns'). Every list a fix moved re-run and its records re-aimed by content
(among them `auditgalleon_{bake,deck,sea,guns,rig}`, `galleon`, `auditnav2_deck`, `auditnav2_captains`, `deckwalk`,
`auditwatchkit_crew`, `navaudit_helm`, `navaudit_online`, `auditretro1`): all dead, AUDIT NAV2 F24's survivor (TS4)
among them now.

## PIN MOVED

`auditgalleon_bake` (BK1: the two hand-made answers compiled 5.1.1's, B3 eleven; BK2's cross_poly_v2 as Blender sums
it); `galleon_model` HER HELM (PF7: the trigger forward of the hub); `auditretro1` A4's source pin (PF5);
`auditgalleon_sea` T4(b) (TS10: from a clean art door); `auditgalleon_guns` G6 (PF6: `draftOf`), G2 and G3 (PF1:
world.js's order) and G5 (TS3: heeled 8 deg); `auditgalleon_rig` R5/G9, `navaudit_guns` G12, `navaudit_helm` H12 and
`navaudit_online`'s canvas (RG3: each sets her sails before reading her boxes - stowed canvas has none now);
`auditnav2_deck` AUDIT GALLEON T1 (DK3: its cabin foe stood in her castle doorway, which a body passes now - moved
beside it, its law unchanged).

Not verified in a browser.
