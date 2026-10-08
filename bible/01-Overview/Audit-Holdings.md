# AUDIT HOLDINGS - the Holdings tab, the Stable, the Fleet, refits, names, crew roles and the ports' quays, 2026-10-03

Mac: *"Audit this, ensure its perfection"*, of PR #549's HOLDINGS arc (`03-World/Holdings.md`, `0c7a5af50..835822a9b`
and the merge that carried it). Four lenses read it: the quays and the docking on the real host, hulls and colliders; the
Fleet on Come Sail Away's real runtime; the tab, the Stable and the crew roles (with the tab strip measured in Chromium);
and online, the saves, the docs and the tests' own honesty. Thirty-nine findings; every one re-run before it was fixed.

Each fix is pinned in `test/auditholdings.test.js` (22 pins) or in the pin it moved (each a `PIN MOVED` note -
`fleet.test.js`, `quays.test.js`, `crewroles.test.js`, `classicpages.test.js`, `csa_placing.test.js`,
`fb0929h_veinneed.test.js`, `nav_h_host.test.js`, `sealanes.test.js`, `decor2b.test.js`). Mutation-proven: `tools/mutants/auditholdings.json`
(80 mutants, all dead), and the mutants of every list a touched test kills run again over the fixed tree (below):
2,415 in 60 lists, every one dead or recorded once four pins were moved; three survive on `main` alike.

Not THE HOLDINGS ARC of the hubs, homes and guilds (`06-Systems/Online-Arc.md`): this arc is named for the pause menu's
Holdings tab (D4).

## The quays and the docking

| ID | Sev | Finding | Fix |
|---|---|---|---|
| Q1 | Bug | **The gangway went through her hull on every hull but the Rowboat.** Its head was laid 0.5 m outboard of her innermost main-deck rail cell (3.3 m off the Carrack's centreline, her side 7.5 m out): the plank met her side 2.4 m up a 6.5 m plank at 2.73 m (her deck 3.64), the Small Ship's at 4.8 of 7.4 m, the galley's at 8.65 of 10.5, the Large Boat's through her gunwale. | The gangway runs SQUARE to her side at her waist (`quays.js` `gangwayFoot`): its head where GANGWAY_SIDE says, measured off her own colliders - a ship's at her main deck's entry port just off her side, a boat's on her gunwale; a ship's foot on the quay's deck in from its face as far as a climb of GANGWAY_SLOPE (30 degrees) asks, never nearer the face than GANGWAY_CLEAR (over the kerb and the bollard) nor the back than GANGWAY_BACK; a boat's on the kerb's outer edge, the plank down over the water onto her gunwale. Ashore is past its foot, never under it; the cargo keeps off its lane (GANGWAY_LANE). Re-run: the first fix (a plank run diagonally along her) cleared its middle and clipped her side with its inboard edge by up to 0.4 m; the pin casts every edge, both faces and both ropes against her colliders and the quay's real collider on all four hulls that dock. |
| Q2 | Bug | **A Large Galley docked at a quay sized for a Carrack** - 93 m against a 58 m quay and berths 65-72 m apart: 7.5 m into the next berth's Carrack on a straight shore, 13.7 m in a bay, through the next quay's whole depth. | No quay takes a galley (DOCK_REFUSED): `dockFor` never warps her in and `freeBerth` gives her no berth (summoned, she is placed by the click), as the sea's own galleys never moor. |
| Q3 | Bug | **The quays' lanterns put out the town's nearest.** Handed in as the player's extras (first, never cut), they took up to 6 of the 16 classic slots at night within 120 m and the renderer dropped the town's farthest - the AUDIT PRE-MERGE 0928 R2 law the boats' lanterns already keep. | Scene lights in the boats' own selection (`csaLit`), in the lanterns' hours alone. |
| Q4 | Risk | **The gangway took presses meant for her.** It answered before her helm, hold and door (no ray test - distance and a 60-degree facing), and the "ashore" reach (4 m from its head) covered all of a Rowboat's and a Large Boat's deck: facing the quay at her cargo box, Activate stepped you ashore. | It yields when Come Sail Away's own trigger wins the ray (`activate`/`takesActivate` `boatTrigger`, the world's `_race.boatWins`); ashore only within GANGWAY_ASHORE (1.5 m) of her rail cell by it; the look within GANGWAY_FACING (cos 0.7) of square. |
| Q5 | Risk | **A ship of the sea could moor into a ship made fast.** Online, `putOff` rewrote the errand on a copy of a ship another player stands (never stepped, never sent); alone, the warp starts 25 m out while `berthFree` saw a boat only within 18 m, and an `arrive` never looked at its berth again. | An arriving ship looks at her berth again each step (`stepErrand`'s arrive, `berthFree`'s `except` so she never sees herself): taken, another free berth, else out to sea; the berth my ship is warped in to is taken from the warp's first step. |
| Q6 | Risk | **Two clients could plan different quays** - one off a coarse LOD pixel (planned once, never again), or off a different Deep Waters setting. | A quay is planned off full-detail ground alone (the world's `groundAt` NaN on a coarser stride - laid again later); the harbour sounded once its ground is built (O1). Deep Waters stays each player's own: recorded (O1). |
| Q7 | Risk | **Every quay was a mover's collider bucket** - never filed in the broadphase, so every ray and sweep asked each one, and its translation closure built an array each time (6-12 buckets wherever a harbour was known). | A still bucket, baked where its berth lies on the sea's top, stood again after a recentre (`offsetAll`, after the naval host's). |
| Q8 | Risk | **The Fleet forgot where a ship lay made fast.** `dockPorts` said "nowhere" for every shown boat not made fast - and harbours are forgotten at every door and jump, so a ship at Sentinel read "Afloat". | "Nowhere" only where it is known: a known harbour's mouth within HARBOUR_STAND of her, or she under way. Summoned, or placed anew, her old port is cleared (the docking says hers). |
| Q9 | Nit | The gangway's mesh never freed, and left pending for good if it would not build; a quay whose mesh would not build never laid again; the warp and the gangway's word kept across a cleared sea; the word said again each time the look swung back; a jetty run JETTY_LAND into a wall; a gangway over the water while its quay was still being laid; an unnamed port's quay read "Afloat" from afar. | Each fixed: freed with the quays and made again; laid again QUAY_RETRY_S later; forgotten with the sea; said once a coming, whatever the look; a bank more than two steps over the deck met at its face; none onto a quay not laid (`quayLaid`); "Made fast at a quay". `standing()` stays - the pool's readout, as the farms' is. Faces resting on the deck reading their underside as solid in `insideSolid`: negligible, recorded. |

## The Fleet

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | Bug | **A ship could be stood twice - and sold for her worth again and again.** Picked up, her title stayed in the book; her parts anywhere but the pack (sold, chested, dropped) read "Laid up" and Summon stood her from the title, and the parts placed stood a second boat of her number (`dup.mjs`: `[600, 600]`). Selling the parts paid her worth each round (a Small Ship 100,000). | Picked up, her title leaves the book with her: her parts ARE her (sold, she is sold); placed, her title is made again. Parts whose boat already stands are refused (`StartPlacing` says so; `LaunchFromParts` stands none). |
| F2 | Bug | **A summoned small boat's title was minted into the book before the click** - a click on land, a jump, a placing already under way left it there while she stood (and with the sea fight off every summon took this road); a deed placed from the pack before the page swept it left its title behind. | Placed from a deed of the moment in its own list, never the book; the sweep never takes the deed a placing holds. |
| F3 | Bug | **A Large Boat's rig reverted.** Her record kept the variant she was first known in: sent away and summoned, she came back in it. | The record (and her title) follow her rig as she stands - each sweep, and as she is sent away. |
| F4 | Risk | **The bank's claim lifted with the loan unpaid**: read by the due date her purchase set, which borrowing more puts later and the Empire calling the debt in sets to now. | Owed while her region's bank is owed anything; cleared for good once the Fleet sees it owed nothing (`settleCredit`), so a later loan there is no claim of hers. |
| F5 | Bug | **A boat bought as parts on credit carried no claim** (a Rowboat off the shelf is parts; the bank lends on them). | Stamped at the counter as a deed is (`creditShip`). Gone with SHIP-CREDIT (2026-10-08): no boat is bought on credit now; a save's claim is kept. |
| F6 | Risk | **A boat called out of a dungeon's water stayed hidden** outdoors (`inside` kept). | Shown outdoors. |
| F7 | Nit | **A hand-made save**: one number twice entered two titles; a variant no hull has threw from the page's click; any worth; a port's name with control characters (with S3). | One record a number, a variant her hull has, her worth within [0, SHIP_VALUE_MAX], a port's name printable (a line break a space), FLEET_MAX (256) records. |
| F8 | Nit | A failed claim left a hidden record saved for ever; the Fleet's port reach was `IsNearPort`'s default, not the setting's; a deed off the keyed shelf still went to the pack. | The record forgotten with the title (`forgetShip`); the setting's PortLocationSearchRange; to the book. Send away's port is the one nearest the player (the patch notes say so). |

## The tab, the Stable and the crew roles

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Bug | **Two notes written mid-line in FRAME_ROLES turned 18 selectors into comment** - the Companions page's slots, faces and chips, the HUD's quick chips, the status tiles, the trade column, the Features search lost the kit's dress (and the `panel` line's since `3f8b47047`: the cards). | Each note on a line of its own; the pin reads every selector the source names. |
| C2 | Bug | **With no Lookout named, her Bosun kept the bow** on every Small Ship and Carrack (their dealt rosters have none) - and never stood at his mainmast. | A hand with no post keeps her bow, else the one whose post matters least (LOOKOUT_YIELD: a Gunner, her Cook, her Carpenter, her Bosun) - never a First Mate made from her hands while another will do; no roles at all, her first hand past her captain, as ever. |
| C3 | Bug | **A Bard offered the Lookout** answered "her Lookout now" and wandered: her bow is never a Bard's (`canLook`). | Refused ("leads her songs - he keeps no lookout"), and his list leaves it off. |
| C4 | Bug | **Four tabs were cut under ~720 px** (the strip never wrapped and its host clips: at 360 px Quests and System half gone). | Tighter under 900 px and 660 px (the diamonds dropped), wrapped as a last resort - measured in Chromium, one row from 320 to 1280 px. |
| C5 | Bug | **A horse never named, renamed with nothing,** answered "You do not own a horse." | "Your horse keeps no name - give him one." |
| C6 | Nit | An empty Holdings rail (the standalone dungeon) drew the Stable: "You own no horse and no wagon". | "Nothing here to hold". |
| C7 | Nit | The first gather's toast said the Professions key opens the Stores page (it lands on Professions). | "the pause menu's Holdings > Stores". |
| C8 | Nit | A Gunner past her guns stood on the first Gunner's spot; a holder gone (ashore, fallen) still held his place; two stale notes. | Beside a gun; the next stands at the post; the notes. |

## Online, the saves, the docs and the tests

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | Bug | The duplicate ship. | F1. |
| D1 | Bug | A Rowboat bought on credit refitted while its loan stood. | F5. |
| O1 | Risk | **A harbour was sounded off whatever was built.** A pixel not built reads as land, and the harbour is sounded once a visit: two players arriving by different roads found different berths, and stood different quays. And Iliac Puddle's Deep Waters (each player's setting) changes the water it is sounded off. | Sounded only once every pixel its scan reads is built (the world's `ready`). Deep Waters stays each player's own - recorded in `03-World/Holdings.md`: two players with it set differently see different quays. |
| O2 | Nit | Crew roles are the owner's alone (not on the word): another player sees her hands walk where they will. | Recorded. |
| S2 | Risk | A save made now, loaded in an older build, drops the Fleet slot: a laid-up ship is gone and a placed one cannot be picked up - against the notes' "a save made now also loads correctly in an older version". | Said in the patch notes. |
| S3 | Nit | The restore let a hostile save through. | F7. |
| D2 | Doc | "Every act and refusal" - half the refusals were never asserted. | Pinned (D2, T2). |
| D3 | Doc | "Packed (her parts in the pack)" - parts elsewhere read Laid up (S1's hole). | Her parts are her (F1). |
| D4 | Doc | Two arcs named HOLDINGS. | Said on the page and in the arcs' rows. |
| D5 | Nit | The Port Ledger credited `scenes/exterior.js` with the Fleet's save; it registers no slot. | The world host's. |
| D6 | Nit | The notes: "24 letters" (printable characters), "shows over her" (the hover plaque), "the nearest port" (the nearest the player). | Said so. |
| T1 | Test | The Guns refit was pinned by source text alone. | A ball of hers fired on the real host takes its share more. |
| T2 | Test | Send away's test promised refusals it never asserted, and ended in dead code. | Asserted. |
| T3 | Test | Two moved pins (`peerlight1`, `wb2_gate`) made the quays' lights optional and could not fail. | Back to their own text - the lanterns left the extras (Q3). |
| T4 | Test | The crew-roles bar read the constant under test (`POST_SHARE * 0.6`). | A fixed bar (0.6; measured 0.73-0.78). |
| T5 | Test | Lines no mutant or pin held: the restore's sanitation, `deedInPack` reading the book, the wire's name cap, the warp's hostile check, `boatAtBerth`'s peers, the world's `dockedPort`. | Each a mutant; a peer's boat at a berth and a hostile near the warp pinned. |

## The mutants

`tools/mutants/auditholdings.json` - 80 records, a fix's every line and the T5 gaps. The first run killed 74; six lived,
each because its pin reached the fix by another road, and each is pinned at its own now:

- **AH-F3-sent-away-in-her-old-rig** - the page's sweep had already read her rig before Send away; the pin picks her rig
  again with the page open and sends her away with no sweep between.
- **AH-F4-the-claim-never-settled** - `settleCredit` was pinned called by hand; the pin settles it through the page's
  own sweep (owed, kept; owed nothing, cleared).
- **AH-T1-every-boat-refitted-alike** - the second boat's refit was asked of a ball from the first; the pin fires from a
  second boat of mine with her own refit.
- **AH-Q4-ashore-from-the-whole-deck**, **AH-Q4-a-look-along-her** - the pins stood and looked by GANGWAY_ASHORE and
  GANGWAY_FACING themselves, so a mutated constant moved its own bar; literal distances and angles now (1.3 m and
  1.8 m inboard, 42 and 50 degrees), the constants pinned beside them.
- **AH-C7-the-stores-key-misnamed** - its record named a test that never read the line; `classicpages.test.js` does.

Re-run: 6 dead.

The older records the fixes moved, re-aimed by content (each its law, at the line as it now reads), and run again: 26
dead - `auditbay.json` BAY-A7-lying-ship-unread, `auditpr478.json` ASLH-B7-null-kept, `auditwatchkit_crew.json`
WK-W1-first-man-first (her captain's skip in the new fallback), `classicpages.json` CLASSICPAGES-where-line-no-key,
`decor2b.json` DECOR2b-the-keyed-list-carrying-furniture, `holdings.json` FLEET-loan-due-unread (the due date's law is
gone with F4; the record holds the one it carried - a later loan is no claim of hers - at `settleCredit`),
FLEET-loan-total-unread and CR-every-list-a-bard, `ows2.json` OWS2-launch-deed, `quays.json`'s twelve (the jetty, the
cargo, the bucket's re-standing, the Fleet's word, the gangway's foot, look, reach, press and landing, the away line,
the lanterns' hours), `sealanes.json` FEED-harbour-unnamed, `shipclaim.json` SC-claim-deed-kept-on-failure,
`shippack.json` SHPK-deed-kept, and `survtiers3.json`'s two cites.

**The lists a touched test kills** - 60 lists, 2,415 mutants, run over the merged head (`c663d7a9e`, main's Arena merge
in): 2,394 dead, 14 equivalent as recorded, seven survived.

- **Four were this branch's** - each pin could no longer reach its law, and each is moved (`PIN MOVED`); re-run, 4 dead:
  - **DEED-PORT-the-host-never-hands-it** (`fb0929h_deedport.test.js`) - the pin matched any
    `nearestPort: () => csaNearestPort(),`, and the Fleet host's deps carry the same call; it reads Come Sail Away's own
    line by its note now.
  - **QUAY-piles-on-the-bank** (`quays.test.js`) - the jetty's piles were read over the 3 m bank, which Q9 meets at its
    face; read over the 2 m bank the jetty runs JETTY_LAND onto.
  - **QUAY-host-berth-free-of-mine** (`quays.test.js`) - every pin of a boat of mine lying at a berth had warped her in,
    and the warp's berth is taken by the warp itself (Q5); a boat placed there, never warped, keeps the roll off it.
  - **SC-berth-kept** (`shipclaim.test.js`) - a claimed prize lies at her berth as a boat of mine, which keeps the roll
    off it whatever the departed law says; she sails off it before the harbour stands again.
- **Three survive on `main` alike** (`ee3788396`, run there): `CSAL-pad-bare-dpad`, `VEIN-NEED-press-keeps-nothing`, and
  `NAV-B-her-colours-struck` (AUDIT TOUGHER-SHIPS found it on its base too). Not this change's - RECORDED for their own
  slices.
