# FIELD BUGS 2026-10-29e - the phone's boot, the Starfall's master, the families' cap, the open sea and the boards

Five Discord reports and the owner's board change, handed over by the owner in a session. Read on main's `c1f7101c0`
with the freeware's data (`tools/fetch-data.sh`). The mutants are `tools/mutants/fb1029e_fieldbugs.json`.
(Written as page (b); #1431 took 29b and 29c and #1428 took 29d first, so this batch is (e).)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Game fails to load on mobile website client" - iPhone, Safari and Chrome: "undefined is not a constructor (evaluating 'new YKt({woods:Dt,woodsBytes:pt})')" | A top-level await (FIRST-VISIT, 2026-10-28) made the world's graph async; WebKit before Safari 27 resolves a second `import()` of one before it runs | WEBKIT-TLA |
| 2 | "Falling Star Elite Boss Softlock" - an Unquiet Elite Daedra Lord ran off, became a revenant, and the event stuck on its master | A world boss could wear the mark and run; a master gone with no body was still the master | STAR-MASTER-FLED |
| 3 | "Families (bloodline) max" - "I have no characters anymore and I still cannot make another bloodline", and "being able to remove old families" | Every Bloodline or Enduring birth founds a line, the realm holds 40, and nothing let one go | FAMILY-FORGET |
| 4 | "You (almost) literally cannot go to Sethrakul fights beyond the bay, sometimes" - "You get told you're going to the E-O instead", and "it takes forever to get to the fights that aren't near to the shore" | The crossing's waters covered the sea past the Bay's rows; a voyage was asked to cross on its way; the voyage planner's floods sailed a "Λ" | SEA-ROWS, SEA-TAUT |
| 5 | "Bounty Boards missing from Alinor and other settlements" | Daggerfall stands its board only in a city wall's blocks: no hamlet, no village and no capital past the Bay stood one | NOTICE-PANEL |
| 6 | The owner: "remove the notice board prop from all cities", for "a detailed drop down from the compass that shows the town name, guild control, prosperity and clickable notice board button" in "any settlement, city or town" | - | NOTICE-PANEL |

## The phone's boot (WEBKIT-TLA)

FOUND. The error names `new TerrainGenClient({ woods, woodsBytes })` in `bootWorld`. In the bundle the class is a
`var` of the world chunk, set by the chunk's body, and `bootWorld` is a hoisted function: it reads `undefined` only if
it runs before that body. It can only run from an `import()` that resolved, so one resolved before the chunk ran.
`firstVisitStore.js` read its generated pins with a top-level await, which makes every graph that imports it async,
and the front door imports the world twice - the menu's warm-up and Play. WebKit's own write-up says its old loader
resolves the second import of such a graph at once (WebKit bug 242740, fixed in Safari 27, which has not shipped).
Every browser on an iPhone is WebKit. Desktop Chromium was unaffected.

MEASURED. Of every chunk the build writes, only the store's and the two prototype pages' entries awaited at the top.
Playwright's WebKit 26.6 shows the old loader's order (three imports of an awaiting module resolve 1, 3, 2; Chromium 1,
2, 3) but did not throw on this machine, so the field's error was not reproduced here: the cause is read from the
bundle, the timeline (the await merged a day before the report) and WebKit's record.

FIXED. The store imports the pins and awaits nothing. Every install, build and dev load writes or serves them, so a
plain import always finds them. The dev server still works them out again for each page load: each page's HTML now
drops the pins module it served, in place of the store asking under a URL of the load's own
(`scripts/firstVisitPins.mjs`). `test/tree/toplevelawait.test.js` refuses a top-level await in any module another
imports - only a page's own entry may await.

## The Starfall's master (STAR-MASTER-FLED)

FOUND. "Falling Star" is the Starfall (`11-Multiplayer/Starfall.md`), and "Kill the X" its tracker's master line.
The master is stood an elite, and an elite of the street draws the Unquiet mark one time in four (`eliteFoes.js`
promoteEliteFoe). A marked foe breaks at 35% health on one roll in two and runs; out of reach it escapes - dead, no
body - and rises as a revenant (`exteriorFoes.js` escapeFoe). The star counts the master's fall only with a body, and
its re-stand (C4) ran only with no master in its slot, so the escaped one held the star at its master until dawn.

FIXED. A world boss is no revenant: `revenantCandidate`, the mark's gate, `isUnquiet` and `foeTitle` refuse
`entity.worldBoss`, so the master never runs, rises from no deed and wears no "Unquiet" (`06-Systems/Revenants.md`
section 51). And a master gone from the pool with no fall is no master: it is stood again whole, as C4 stands one that
never stood (`scenes/starfall/starfallHost.js` owner). Pinned through the real street pool
(`test/systems/revenant/auditunquiet.test.js`) and the host (`test/scenes/starfall/star5_host.test.js`).

## The families' bound (FAMILY-FORGET)

FOUND. The refusal is the account service's `too-many-lineages`: a founding past `LINEAGES_MAX` (40) lines
(`server-account/src/legacy.js` putLineage). Every Bloodline or Enduring birth founds a new line, and nothing let one
go - a delete, a death and "let the line end" all keep the row, and it counts. A one-life player who deleted each
character met the bound with no characters left. A Casual character founds no line, so the bound never refused one;
the report's "any gamemode" was not found in the code, and the message a Casual try showed would say what stopped it.

FIXED. `POST /v1/realm/lineage/forget` lets go a line no living realm character plays (acct220, `forgetLineage`; a fall
a Resurrect may still take back counts as living). Its fallen's tombstones stay, so no save loads past a death. The
Online page lists such lines under Old families, each with Forget, and the forget drops the device's copy too, so no
push founds it again. The bound's refusal says to forget one (`06-Systems/Legacy-Arc.md` section 9). Pinned by
`test/server/fb1029e_family_forget.test.js`.

## The serpent past the Bay (SEA-ROWS, SEA-TAUT)

FOUND. The box in the screenshot is the Eltheric crossing (`03-World/Eltheric-Ocean.md` ETHER-CROSSING): asked west of
x 230, 20 pixels or more from land, on every row. It was written for the Bay's world; since WW3 the sea south of the
Bay's rows is sailed. Measured on the freeware's world: 3 of 66 serpent sites past the Bay lay in those waters (off
Sunhold, Silinorin and Shimmerene), and 8 of 35 far lanes sailed through them. A Yes there sails three days to Veilhaven.

The slow voyages were the planner's (`06-Systems/Travel-View.md` LONG-VOYAGE). Its ends were flooded breadth first, a
diagonal counted as one step, so open water due east sailed as a "Λ": forty voyages between open waters past the Bay
sailed a median 1.105 of the straight line, p90 1.399. The player's other idea, the serpent kept to the Bay, would have
hidden both.

FIXED. The crossing's waters are the Bay's own rows alone, and it is never asked while a journey sails to a place it
chose: no serpent site and no far lane is in them now. The floods count a step's own length, and the sailed stretch is
pulled taut across open water (`seaTaut`): median 1.001, p90 1.004, no leg ashore on the kernel's ground (SEA-SQUARE's
pin). Pinned by `test/world/ethersea.test.js`, `test/systems/naval/auditcaptsea.test.js` and
`test/systems/travel/fb1029e_seataut.test.js`.

## The boards (NOTICE-PANEL)

FOUND. A town's boards are Daggerfall's own model 41739, which RMBLayout stands alone so a press finds it. On the
freeware's BLOCKS.BSA only 4 of the 12 WALL kinds place one, at a walled city's gates, and no other kind does. So all
410 of the Bay's cities stood boards, and none of its 1,200 hamlets or 1,834 villages. Alinor is laid from district
kinds and blocks of its own, with no WALL block. BOUNTY1 made half a town's boards its bounty boards, so a place with no
board had neither board.

CHANGED, a departure from DFU (`01-Overview/Port-Ledger.md` section A). No board stands in any town. The town's panel
hangs under the compass while the player is in a city, hamlet or village - on its streets or in its buildings, never
below - and goes when they leave (`ui/hud/townPanel.js`, `scenes/townPanelHost.js`). It names the town; then its guild
control (a seat's own card, or its area's holder - none where no seat can hold the region); then its economy, prices
and reason (`townEconLaw.js` townPanelLinesOf). Under them stand the Notice Board, with its count of new notes, and the
Bounty Board. Offline, or before the service says the board is open, the Notice Board is DFU's rumour box. The panel
folds to the name, moves in the HUD editor, and stands aside for the journey bar, the helm and an arena bout.

KEPT. The boards' places, for the siege field's Market alone: every machine lays the same field, so a battle's banners
stand where they stood. REMOVED with the boards: the street's press and its plaque, the count over a board, the town
map's board mark, a seat's pennant and a Festival's banner over a board, and Gothway Garden's two boards (its Bounty
Board is on the panel). The bench stands no board and no panel (FLAGGED). Pinned by
`test/scenes/fb1029e_townpanel.test.js` and `test/systems/bulletinboard.test.js`.
