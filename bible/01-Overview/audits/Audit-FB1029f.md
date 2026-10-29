# AUDIT FB1029f - FIELD BUGS 2026-10-29f read cold, 2026-10-29

The owner: *"Audit everything"*, of PR #1421 at `9b646ceaa` - FIELD BUGS 2026-10-29f (`../bugs/Field-Bugs-2026-10-29f.md`):
WEBKIT-TLA, STAR-MASTER-FLED, FAMILY-FORGET, SEA-ROWS, SEA-TAUT and NOTICE-PANEL. Six cold lanes read the change
against its base `662b68634` in a frozen worktree, each given the files and the request, never a conclusion. Each
finding was reproduced with a probe on the real code and checked again here before it was fixed.

| Lane | Read | Found |
|---|---|---|
| TLA | the phone's boot: the bundle, the loader, the guard, WebKit itself | 5, and one out of lane |
| STAR | the Starfall's master: every way it leaves, every foe that may rise | 9 |
| FAMILY | the families' bound: the route, the races, the page | 11 |
| SEA | the crossing's waters and the taut voyage, over the whole world | 8 |
| PANEL | the town panel: the request phrase by phrase, every settlement, every skin | 14 |
| REMOVAL | the boards taken out: every builder, every reader, every record | 6 |

Each fix in code carries an `AUDIT FB1029f <id>` comment and a pin that fails on the code as it stood. Mutants:
`tools/mutants/audit_fb1029f_panel.json`, `_removal.json`, `_tla.json`, `_star.json`, `_sea.json` and `_family.json`, all dead.

## FAMILY - withdrawn, and FAMILY-REMOVE's last finding fixed

Main fixed the same report first (#1436 FAMILY-REMOVE, `../bugs/Field-Bugs-2026-10-29e.md` section 3). FAMILY-FORGET
was withdrawn at the merge of main: one route and one list. Read against FAMILY-REMOVE: F1 (a second remove of a gone
line) is main's own AUDIT FB1029e F3, the page taking `no-lineage` as removed. F5 (a waiting Succession offered for
removal) is main's choice, said on the card: "no heir of it can carry it on". **F3** held: a write whose read saw the
line and whose UPDATE lost it to a remove got `staleLine`'s null, and the route threw a 500. It answers `no-lineage`
now, F2's answer to a copy made from a gone line, and a founding founds (`server-account/src/legacy.js` putLineage,
acct225). Pinned by racing the remove into the UPDATE (`test/server/family_remove.test.js`); mutants
`tools/mutants/audit_fb1029f_family.json`.

## PANEL - the town panel

**P1 (blocking; TAMRIEL-WIDE).** Past the Bay the panel said no control and no prosperity in Alinor's harbour or in a
countryside village. The registry's rows read a capital's span as a square, leaving Alinor's and Torval's sea slices
out, and found a countryside place by id only once something asked its pixel. The rows lay every slice as the build
does (`world/pastBayRows.js`); a pixel provider registers its id's pixel (`worldPlaces.js` registerPixels, the
countryside's `countryPixelOfId`). Pinned on the producers' own ids.

**P2.** The panel stood at farms, manors, lone taverns and temples (DFU's seven town types). It is a city's, hamlet's
or village's (`scenes/townPanelHost.js` PANEL_TOWN_TYPES). **P3.** The Notice Board's heartbeat was stamped by the
exterior frame alone; the panel's frame stamps it, indoors too. **P4.** The panel is seated at its making, the HUD
editor's preview, and clears its heading out of town. **P5.** The classic HUD toggle covers it. **P6, P13.** On the
classic skin it stands on the compass (`hud.js` classicCompassAnchor), off the popup text; on a phone the quest card
clears it by its height.

**P7.** A capital over several pixels is one town, its district a line. **P8.** The fold's read
back and the covering list are pinned. **P10.** The count of new notes is said in the player's language. **P14.** A
press lets go of the focus. **P9** (a city's castle is a dungeon, so no panel) and **P12** (Gothway's boards went with
every town's) are recorded. **P11** (the HUD is `aria-hidden`) is the HUD's own, unchanged.

## REMOVAL - the boards taken out

**R1.** A kept board place is the drawn model's own box and matrix, one reckoning (`scenes/pixelBuild.js`). **R3.** The
ledger's NOTICE1, BOUNTY1, TOWN-MARKS and SEAT1a rows, NOTICE1b (superseded), Bounty-Boards, Seats-Arc, the count tools'
verdicts and the code's comments say what stands now. **R4.** The name cone's and the PvP mask's board branches, dead,
are gone. **R6.** `ROAD_WEIGHT` lives in `world/city/cityNavigation.js` (gothwayBoards.js retired); the bench no longer
fetches the board's mesh; the solids sweep counts none. **R2.** The town packs' rooms
placed the board too (a tavern's, a temple's, a manor's, a gate's), and the owner's word is every city: none stands
indoors (`scenes/interiorContext.js`), its placement kept so a room's keys hold (`test/scenes/fb1029f_boardsindoors.test.js`).
**R5** is P2.

## TLA - the phone's boot

The lane installed the WebKit the repo's Playwright pins (26.0) and reproduced the field's error on the base build
through the real front door (4 of 6 desktop runs and an emulated iPhone 15); this PR's head booted 6 of 6.
**TLA-1.** The build refuses a chunk another imports that awaits at its top level (`scripts/noTopLevelAwait.mjs`); the
source guard reads `vendor/` and template-literal imports. **TLA-2, TLA-3, TLA-4.** The record names the reproduction
(`tools/webkitDoorProbe.mjs`), iOS 27 as the fix, and a worktree's pins step. **TLA-5.** The guard no longer leans on
the entries that await today. **Out of lane.** WebKit's ResizeObserver loop notice, an error event with no error
object, put CRASH over the game at the menu: `ui/crashText.js` isBenignWindowError.

## STAR - the Starfall's master

**F1.** A Wabbajack on the master left two masters: one is stood again only after a quiet `STAR_RESTAND_MS` with no
foe of its site standing (`masterLost`, staffBossLost's shape). **F2.** A master handed to a peer alive is the heir's
(`handedOn`): the star is given up and held again only `STAR_YIELD_MS` on. **F3, F4, F5.** One rule: an event's own foe
never rises - the Starfall's master, a staff event's boss and a rite's faithful, stamped `eventFoe` at the stand before
any promotion draws the mark (`unquietMark.js` isEventFoe), read by the gate, `isUnquiet`, `revenantCandidate` and
`foeTitle`. **F6.** A master stood again calls its circle afresh. **F7.** A fall has a body. **F8.** The joint revert is
pinned end to end. **F9.** The cards' comment names the Starfall's master.

## SEA - the crossing and the taut voyage

**F1 (blocking).** The SEA-ROWS guard read `travelOptions.isTravelActive` unguarded, and Travel Options is null when its
switch is off - the player's own, offline. Any helm threw in the frame loop and the game showed CRASH. The guard reads
no mod now: the host tells the gate the journey (`crossGate.offer(way, travelOptions)`), and the gate reads it null-safe.
**F3, F4.** The guard left the gate untold while a journey ran, so a stop mid-voyage asked and a refusal outlived the
journey. The gate is told the waters on every check; waters a journey sails into are the journey's, asked only where it
arrives (`travelOptions.js` `arrived`: a place, a spot or a pixel reached, never an Exit or a load).

**F2.** The taut pull ran as one block outside the plan's tally: a long voyage's last slice held the frame 67 to 147 ms.
It runs in the plan's slices now (`seaTautSteps`), its water typed arrays over the route's box: 5 to 30 ms, the plans
pixel for pixel the same. **F5 (TAMRIEL-WIDE).** The Bay's rows were a gameplay bound, not the Bay's data: the open
ocean past the Bay went unasked. The waters keep CROSS_SEA_PX from the sea the world sails on every row
(`createCrossSea`: every lane's way and the day's serpent ring); no lane, site or ring is in them, matched by brute
force at 42,105 points. **F6.** The "before" figures did not reproduce: 1.173, 1.364 and 1.403 now, in every place they
stood. **F7.** Stale comments and the ASKED paragraph made true. **F8** (diagonal steps nearer a headland, through
corners the `sails` law allows) is recorded.

**F9.** The way home lands where the last crossing out set sail, west of Sumurset too, and its words said "The Iliac
Bay, and home." The map names those waters the Eltheric Ocean, the crossing's name for the Veil's sea, so past the
Bay the words name no sea: "lie the gray waters you set out from", "You are back in the waters you set out from", and
"The open sea runs empty" for the way out (`etherCrossing.js` crossingRows, crossingWords). On the Bay's own map they
are as they were.

**Tooling.** `tools/mergeMain.mjs --sweep` renumbered both versions at every merge, and moved main's own pins past main
where the branch never bumped one. It renumbers a kind only when the branch bumped it past the merge base (`renumbered`).
**Main's scale records.** AUDIT-SCALE A3 and A5 survived: `0186_world_books.sql` makes 0091's indexes again, so they are
recorded equivalent.
