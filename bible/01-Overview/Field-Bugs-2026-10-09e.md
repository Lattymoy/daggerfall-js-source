# FIELD BUGS 2026-10-09e - four Discord threads and the owner's map

Four threads from the Discord (a suggestion and three bug reports), handed over as screenshots, and the owner's own
words beside them: "Also increase the accuracy and fidelity of the tamerial ingame map. Its not properly traced".

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Mining veins" - "I mined about 200-300 veins of iron, but there were not a single vein of silver, gold, platinum or mithril in the mountains ... maybe Mountain area and MountainWoods area are bugged" (Boar) | the law: a vein on ground no three players had vouched for was held to tier 2, and the Mountain's table holds Iron alone at 1-2 | the cap raised to 3 for veins (UNWITNESSED-ORE) - the owner's to revert, below |
| 2 | "Missing quest location house - An Item On Loan" - "The residence I'm supposed to go to is either missing or under a hill", Guyunyyra Greenham of The Masterhouse Residence in Gentle Redeemer of Akatosh (Black Feather Meadowlark) | Beautiful Villages' `TEMPASD1` stands its House2 #6 inside two of the author's hills - AUDIT FB1005 T3's one walled door, carried as the pack's own | fixed (HILL-HOUSE) - not seen in the game, below |
| 3 | "Desktop client in-game map icons and text too small on high resolutions" - "For the record I'm using a 2k monitor" (Foofding) | the held map inked its names and glyphs in fixed paper pixels and its chrome in fixed CSS pixels, on a paper fitted to the screen | fixed (MAP-SCALE) - not proven on the reporter's monitor |
| 4 | "Could we have a setting to see our reputation with every guild/kingdoms?" - expelled from the Mages Guild, "I can't see how is my standing with them" (Faetasi) | the Standing page listed the player's memberships alone | done, off by default (EVERY-STANDING) |
| 5 | the owner: "increase the accuracy and fidelity of the tamerial ingame map. Its not properly traced" | the trace read the picker's borders as straits and the painting's dabs as lakes, fitted the Bay where the picture is never drawn, and inked the pixels' staircase | done (TAMRIEL4) - `03-World/Tamriel.md` |

## UNWITNESSED-ORE: a vein on unvouched ground holds Silver (1)

`06-Systems/Professions-Arc.md` section 6, UNWITNESSED-ORE. Not a bug - the law. The witnessed world (the same section)
holds a pixel no three accounts a week old have gathered on, with the same climate and region, to tier 2, so a modified
client's lie about a pixel nobody walks buys little. The Mountain's vein table holds Iron at tier 1 and nothing again
until Silver at 3; the Mountain Woods' holds Iron, Copper and Lead at 1-2 and Silver at 3. So every mountain pixel a
lone miner worked stood Iron alone, however many veins were mined - and one miner's harvests never confirm a pixel. The
dungeons' deep veins were already held to 3 on such ground.

A vein on unconfirmed ground is held to `UNCONFIRMED_VEIN_TIER` (3) now - the dungeon's cap, one constant for both
(`net/nodeLaw.js` vein, dungeonVein, and the Court's writ table, which asks what the ground stands). Silver stands
beside the Mountain's Iron and the Mountain Woods' three - no other climate's table holds a tier-3 metal, so no other
ground moves; Gold, Platinum, Mithril and a region's own ore still wait on the witnesses, and the herbs and the trees
keep tier 2. The Mining page says so in a line (`ui/profPages.js` `MINING_GROUND_LINE`). The service's law moved with
it: acct102. THE OWNER'S CALL: this widens what an unvouched pixel yields by one tier, for veins alone; the witnessed
world's threat (a lie about a pixel nobody walks) now buys Silver. Reverting is the constant and the service's version.
Pinned by `test/fb1009e_unwitnessedore.test.js` (4, a Silver vein mined through the service at tier 3's XP);
`test/prof2_law.test.js`'s unconfirmed pins and sixteen acct pins moved (PIN MOVED);
`tools/mutants/fb1009e_unwitnessedore.json` (4, all dead); `tools/mutants/prof2.json`'s PROF2-6 and PROF2-10 re-aimed by
content.

## HILL-HOUSE: the house stood out of the hills (2)

`03-World/Beautiful-Towns.md`, "The port's curation: a house the hills bury". The Gentle Redeemer of Akatosh (Wayrest,
location 578) is a temple Beautiful Villages lays as its `TEMPASD1`: the temple and eleven House2. Its House2 #6 (model
159) stands at (2816, 2176) inside two of the author's hills (52458 and 52713) - 10.5-11.2 m of the pack's meshes over
its door. AUDIT FB1005 T3 measured it, the one walled door of both packs' 10,000-odd, and carried it as the pack's own
until a quest seated someone there: a House2 is a house a quest seats its person in (Person.cs AssignHomeTown), so An
Item On Loan sent the player to a house nobody can see or enter, and the town map lettered its name over the hill. DFU
with the pack buries it too.

The house is moved, not the hill. `world/curatedPlacements.js` holds one row: that record of that block, served by
Beautiful Villages, stood at the block's nearest clear ground at the author's facing - (3808, 2176), 24.8 m east -
measured by `tools/curatedPlacements.mjs` (its footprint 1.5 m clear of every piece, hill and flat and of the block's
edge; its door and the 4 m before it clear). It applies where a block becomes the port's
(`formats/worldDataReplacement.js` getDFBlockReplacementData, both paths), beside the temple summoners, once for every
consumer. The RECORD is kept, so DFU's building key - (block x << 16) + (block y << 8) + record - is the same house's: a
quest made before this stands its person in the same house, now where the player can reach it. The automap's cells are
stamped with the house's type at its new footprint. A later pack that moves the house itself keeps its own: a row
applies only to a record that stands where the row found it. Port-Ledger A, HILL-HOUSE.

NOT SEEN IN THE GAME: the row is measured on the player's data here (the ARENA2-gated pin) and the block is pinned as
the door mints it, but nobody has walked to the house in a running game. A peer on an older build sees the house in the
hill. Pinned by `test/fb1009e_hillhouse.test.js` (5, one gated on ARENA2); `tools/mutants/fb1009e_hillhouse.json` (7,
all dead); `test/wd3_standins.test.js` says the raw pack still walls it; `tools/mutants/qa2_audit.json`'s
QA2A-pinned-curation and `qa2_summoners.json`'s QA2-summoner-door-unasked re-aimed by content.

## MAP-SCALE: the held map's text and icons grow with the screen (3)

`10-UI/Held-Map-Arc.md` MAP-SCALE. The held map fits its paper to the screen and inked its names, glyphs and marks in
fixed paper pixels, its chrome (the foot, the key, the cards, the find box, the tip) in fixed CSS pixels: at 1440p the
paper grew by a third and nothing on it did. `ui/mapScale.js` mapUiScale is the map's scale - Auto is the screen's
height over 1080 to the twentieth, held to 1-2 (1 at 1080p and under, so a phone and a laptop are as they were; 1.35 at
the report's 2560 x 1440; 2 at 4K), or the player's own choice (0.75-2) on the Interface tab's Maps row, "Map text and
icons" (prefs `mapScale`). The window (`ui/heldMap.js` `_layout`) inks on the fitted paper over the scale at full device
resolution - the same drawing, larger, never blurred - and the pointer, the hover card and the hands lane come back over
it; the chrome is zoomed by it (`--hm-ui`, `ui/enhancedStyle.js`), each of its viewport-relative bounds divided by it so
a zoomed card never runs off the screen. Read at every layout, so a change takes the next frame.

NOT PROVEN ON THE REPORTER'S MONITOR: rendered here at 2560 x 1440 and 1920 x 1080 in Chromium (the 1440p frame the
1080p one, larger), not on a 2k desktop in the desktop client. The dungeon's 3D map and the classic skin's map are
untouched. Pinned by `test/fb1009e_mapscale.test.js` (3, every held-map rule's viewport bound swept) and
`test/heldmap.test.js` MAP-SCALE (the window at 1440p and at a fixed choice); `test/fb0929d_mapkey.test.js`'s bound
moved (PIN MOVED); `tools/mutants/fb1009e_mapscale.json` (10, all dead).

## EVERY-STANDING: every organization's standing, a setting (4)

`10-UI/UI-Arc.md` EVERY-STANDING. The enhanced pause menu's Standing page showed the social groups, the law and the
guilds the player BELONGS to (`systems/affiliations.js`, DFU's ShowAffiliationsDialog). An expelled member's guild is no
membership, so the one number the way back in reads was nowhere on the screen. The reporter asked for it as a setting,
"since with many temples and knight orders, some people could feel the menu bloated": the Interface tab's Character
sheet row, "Every faction's standing" (prefs `standingAll`, off by default - the page as it was). On, the page lists
every organization's reputation from the live faction store under its divider (`systems/factionStanding.js`
standingGroups): the four guilds, the eight temples by the god their membership reads, the ten knightly orders, the
kingdoms (FACTION.TXT's Province type - every region's ruler and the Empire, 45; no Random Ruler), the fourteen covens,
the nine vampire clans and the sixteen Daedric Princes. A membership is under Guilds already, with its rank, and is not
listed twice. Nothing here changes a reputation. The classic skin's character sheet is untouched. Port-Ledger A,
EVERY-STANDING. Pinned by `test/fb1009e_everystanding.test.js` (3, one gated on ARENA2's FACTION.TXT);
`tools/mutants/fb1009e_everystanding.json` (7, all dead); `tools/mutants/guildrep.json`'s
GUILD-REP-the-page-draws-no-guilds re-aimed by content.

## TAMRIEL4: the continent, traced properly (5)

`03-World/Tamriel.md` TAMRIEL4 is the record. Four faults, each a reading of the picture rather than the picture: the
picker's one-pixel borders read as a 15 km strait down every border (209 pixels, land of their provinces now); the
painting's dabs of blue read as ninety-odd tiny lakes (a hole under 6 pixels is land; six waters stand); the Bay fitted
where the picture is never drawn (the seam first now: 190 of the Bay's 192 edge cells agree, the edge pixels disagreeing
231 where they were 516); and the coast inked as the pixels' staircase, the lore map's rivers running out to sea (the
land's contour smoothed within half a picture pixel, the borders' ends on the coast, no lore river on the trace). The
picture is 320 x 200: the continent's coast is the picture's to 15 km however it is drawn. Pinned by
`test/tamriel4.test.js` (9, one gated on ARENA2); `tools/mutants/tamriel4.json` (14, all dead).
