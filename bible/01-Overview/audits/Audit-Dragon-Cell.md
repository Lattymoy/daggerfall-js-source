# AUDIT DRAGON-CELL - the dragon told near its cell, and the found places in the Find box, 2026-10-31

The owner: *"Audit"*, of the two slices that answered a Discord report and a DM: FIND-FOUND (a found place past the Bay
in the Find box, `10-UI/Held-Map-Arc.md`) and DRAGON-CELL (a dragon's omen told only near its cell,
`11-Multiplayer/Dwarven-Dragon.md` section 2). Three lanes read them cold, the repo read-only and their proof scripts in a
scratch directory: the law and the relay (A), the client (B), and the Find box with the records and the pins (C). Two
lanes found the worst one apart: a told omen's seed ran back to its watch's, and so to every other dragon of the watch.
Every finding was re-read against the tree before it was fixed, and no fix began until all three lanes had reported.

Pinned in `test/net/dragon/dragoncellaudit.test.js` (9) and `test/ui/findfound.test.js` (one more, 5). Mutation-proven:
`tools/mutants/dragoncellaudit.json`, 18, all dead. Relay world298, never deployed, re-hashed in place.

Severity: **bug** a wrong thing a player sees or can do; **risk** one under a condition; **doc** the record says what is
not so; **test-gap** a law no pin reads; **nit** a cost or a word. A finding two lanes made is listed once, with both.

## D - the dragon

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| D1 | A1, C1 | bug | **A told omen's seed ran back to its watch's.** Each omen's seed was `gateHash(watchSeed, w, 100 + i)`, and every step of gateHash undoes (an xor, an odd multiply, an xorshift): four guesses gave the watch's seed, then every omen's cell, landing and look. A quiet omen's seed was told too, so standing near any omen was enough. | Each omen's seed is its own HMAC of the relay's secret (`dragonSeed.js` dragonOmenSeeds, `dragon-omen:<watch>:<omen>`). A quiet omen is told null, as a far one is. |
| D2 | A2, C2 | bug | **An `in` told a socket anywhere which cell held a dragon.** It read the omen before the cover check: `gone` for an empty cell, silence and a junk strike for the dragon's, at eight frames a second. | The cover first, then the pose within `DRAGON_ADMIT_R`, then the omen: one answer whether a dragon stands there or none. |
| D3 | A3 | risk | **The cover check binds a socket, not a player.** A client may open far cell rooms with forged poses; some 9,800 rooms sweep the frame. | A socket is told only after `DRAGON_TELL_DWELL_MS` (20 s) in its room, so a sweep waits that in each. Still open: many sockets at once sweep in minutes. Put to the owner: an account's budget of cells told on the hub, or a pose judge in the cell rooms. |
| D4 | A4 | risk | **Up to four dragons a watch, one reward.** The account service keys a kill by watch and account (`dragon_kills`, migration 0194), the hub keeps one receipt a watch, so a second kill in one watch is "claimed": no hoard, no tame roll. | Not changed: re-keying by omen is a migration and a receipt's new shape. Recorded in section 2, and put to the owner. |
| D5 | A5, B1, C5 | bug | **A client told one omen never asked again that watch**, so a player who travelled to another omen's cell was never told it. | Asked again once the player stands outside the told omen's reach. |
| D6 | A6, A7, B2, B7, C3 | bug | **A battle was told null** (AUDIT DRAGON-HIDDEN B1 undone: a battle's pose is on its map frame), and the client kept a null against its pixel for good - the one it arrived on, not the one it asked from. | A battle's pose is judged; a room that judges no pose answers nothing. A null is kept against the pixel it was asked from and asked again after `DRAGON_NONE_AGAIN_MS` (60 s). |
| D7 | B3 | bug | **Two players together saw different sites** in a cell across the Bay's edge when one had the land past the Bay off: 88 of 150 such cells on the freeware, 21 of them two fights. | The Bay's ground alone where the cell has any: every screen holds the Bay's scan. |
| D8 | B4 | risk | **A site, or none, was kept for good** though the countryside registers later: read before it, a square named another site. | `groundIn` answers nothing until the countryside's source stands; a cell with no ground is asked again. |
| D9 | B5 | risk | **A square was read on the frame**: 514 ms the first time, 13 to 95 after, on the freeware. | Read in the page's idle moments, a slice at a time, as the theatre scans are. |
| D10 | B8 | nit | A wild-zone filter on the Bay's scan never fired: the Bay's scan holds no open zone. | Gone, with its mutant. |
| D11 | A8, C4 | doc | "Holds the land at any fit", "two may stand", "about eight a day". | The shipped fits; up to four a watch; at most 8.9 a day. |
| D12 | A9, B6, C9 | test-gap | No pin read a told seed's siblings, the `in` probe or the re-asks. The re-run found DRAGON-HIDDEN-a-dragon-drawn-untold and DRAGON3-the-remains-forgotten-at-the-watchs-turn alive on main too. | Each pinned. `AUDIT-DRAGON-HIDDEN-A1-the-theatre-unchecked` now drops the cell's column check; its name is the record's. |

## F - the Find box

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| F1 | C6 | risk | **One name, many places.** 103 countryside places on the freeware are named Helbenar, and 38,661 of 83,179 rolled names are shared; two found ones showed as two "Helbenar, Morrowind" rows. | Homonyms past the Bay come nearest first, each with its way in the event board's own words ("8.2 km E"). |
| F2 | C7 | nit | A find read MAPS.BSA's 15,251 rows again: 67 to 155 ms on the next keystroke. | Those rows and the listed ones kept by the ink; a find reads the found rows alone. |
| F3 | C8 | doc | The Port-Ledger's BAY-LEFT-MAPS row did not name FIND-FOUND. | Named. |

Still open, older than either slice: a quest's reveal finds its place by name (`scenes/world.js` placeByName), so a
homonym the world already stood can take it.

Re-aimed by content and run, dead: fifteen records the fixes moved (nine of `dragoncell.json`, BLM-C9-the-rows-unread,
FIND-FOUND-the-box-unread, two of `dragonhidden.json`, WWGE-the-forced-slice-none, and the two D12 survivors' tests).
Retired with their code: DRAGON-CELL-the-site-the-wild-zone and -the-none-forgotten (AUDIT-DRAGON-CELL-D8-none-kept-for-good
holds the law reversed). PINS MOVED: `dragoncell`'s law, relay and client; `dragonhidden`'s tell; `dragon3_client`'s site;
`test/fakeRoom.mjs` writes a socket's `at` as `Room.fetch` does, so `test/placeWidest.mjs` measures the widest attachment with it
(`auditattach`'s two bounds hold).
